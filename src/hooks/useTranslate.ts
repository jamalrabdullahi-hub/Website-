import { useState, useEffect } from "react";
import { Language } from "../translations";
import { staticTranslations } from "../staticTranslations";

// In-memory/localStorage cache to keep translations persistent and instant on second load
const getCache = (): Record<string, Record<string, string>> => {
  try {
    const cached = localStorage.getItem("prirecos_translation_cache");
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
};

const saveCache = (cache: Record<string, Record<string, string>>) => {
  try {
    localStorage.setItem("prirecos_translation_cache", JSON.stringify(cache));
  } catch {}
};

// Global pending set to prevent duplicate translation requests
const pendingTranslations = new Set<string>();

export function useTranslate(language: Language) {
  const [cache, setCache] = useState<Record<string, Record<string, string>>>(getCache);

  const t = (text: string): string => {
    if (!text || language === "en") return text;

    // 1. Check staticTranslations dictionary first (instant, 0ms network latency, zero-jank)
    const staticLangCache = staticTranslations[language];
    if (staticLangCache && staticLangCache[text]) {
      return staticLangCache[text];
    }

    // 2. Check localstorage cache
    const langCache = cache[language];
    if (langCache && langCache[text]) {
      return langCache[text];
    }

    // Load translation in background
    fetchTranslation(text);
    return text; // fallback to English during loading
  };

  // Helper to translate an array of strings
  const tArray = (texts: string[]): string[] => {
    if (!texts || texts.length === 0 || language === "en") return texts;

    const staticLangCache = staticTranslations[language] || {};
    const langCache = cache[language] || {};
    const missing: string[] = [];

    const results = texts.map((text) => {
      // 1. Check static translations
      if (staticLangCache[text]) {
        return staticLangCache[text];
      }
      // 2. Check local cache
      if (langCache[text]) {
        return langCache[text];
      }
      missing.push(text);
      return text;
    });

    if (missing.length > 0) {
      fetchTranslationsBatch(missing);
    }

    return results;
  };

  const fetchTranslation = async (text: string) => {
    if (language === "en" || !text) return;
    const key = `${language}_${text}`;
    if (pendingTranslations.has(key)) return;
    pendingTranslations.add(key);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLanguage: language }),
      });
      const data = await res.json();
      if (data.translatedText) {
        setCache((prev) => {
          const updated = {
            ...prev,
            [language]: {
              ...(prev[language] || {}),
              [text]: data.translatedText,
            },
          };
          saveCache(updated);
          return updated;
        });
      }
    } catch (err) {
      console.error("Translation failed for:", text, err);
    } finally {
      pendingTranslations.delete(key);
    }
  };

  const fetchTranslationsBatch = async (texts: string[]) => {
    if (language === "en" || !texts || texts.length === 0) return;

    // Filter out texts already being fetched
    const toFetch = texts.filter((text) => {
      const key = `${language}_${text}`;
      if (pendingTranslations.has(key)) return false;
      pendingTranslations.add(key);
      return true;
    });

    if (toFetch.length === 0) return;

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: toFetch, targetLanguage: language }),
      });
      const data = await res.json();
      if (data.translatedTexts && Array.isArray(data.translatedTexts)) {
        setCache((prev) => {
          const newLangCache = { ...(prev[language] || {}) };
          toFetch.forEach((original, idx) => {
            newLangCache[original] = data.translatedTexts[idx] || original;
          });

          const updated = {
            ...prev,
            [language]: newLangCache,
          };
          saveCache(updated);
          return updated;
        });
      }
    } catch (err) {
      console.error("Batch translation failed:", toFetch, err);
    } finally {
      toFetch.forEach((text) => {
        pendingTranslations.delete(`${language}_${text}`);
      });
    }
  };

  return { t, tArray };
}
