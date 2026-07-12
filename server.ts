import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory database for inquiries
interface Inquiry {
  id: string;
  type: "investor" | "operator" | "general";
  companyName: string;
  contactName: string;
  email: string;
  sector: string;
  capital: string; // e.g. "$1M - $5M"
  message: string;
  status: "Under Review" | "Partner Matched" | "Information Requested" | "Approved";
  submittedAt: string;
  responseCount: number;
}

const inquiries: Inquiry[] = [
  {
    id: "INQ-1002",
    type: "operator",
    companyName: "Global Minerals Group",
    contactName: "Sarah Jenkins",
    email: "sjenkins@globalminerals.com",
    sector: "Mining and minerals",
    capital: "$10M+",
    message: "Interested in establishing a joint venture for copper exploration in the northern regions. We provide deep technical expertise and offshore equipment.",
    status: "Partner Matched",
    submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    responseCount: 1,
  },
  {
    id: "INQ-1001",
    type: "investor",
    companyName: "Nordic AgroFund",
    contactName: "Lars Sorensen",
    email: "investment@nordicagro.no",
    sector: "Agriculture and land development",
    capital: "$5M - $10M",
    message: "Seeking commercial farming partnerships in Shabelle river basin. Looking for local logistics and land tenure facilitation.",
    status: "Under Review",
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    responseCount: 0,
  }
];

// Lazy initialize Gemini AI client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing from secrets. Please add it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// ---------------------- API ROUTES ----------------------

// Get all inquiries
app.get("/api/inquiries", (req, res) => {
  res.json({ inquiries });
});

// Submit a new inquiry
app.post("/api/inquiries", (req, res) => {
  const { type, companyName, contactName, email, sector, capital, message } = req.body;

  if (!companyName || !contactName || !email || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const newInquiry: Inquiry = {
    id: `INQ-${Math.floor(1000 + Math.random() * 9000)}`,
    type: type || "general",
    companyName,
    contactName,
    email,
    sector: sector || "General Inquiry",
    capital: capital || "N/A",
    message,
    status: "Under Review",
    submittedAt: new Date().toISOString(),
    responseCount: 0,
  };

  inquiries.unshift(newInquiry);
  res.status(201).json({ success: true, inquiry: newInquiry });
});

// AI Advisor Matcher endpoint
app.post("/api/advisor", async (req, res) => {
  const { prompt, chatHistory, inquiryContext, language } = req.body;

  try {
    const ai = getGeminiClient();
    
    // Construct system instructions explaining PriRecos and Somalia's resource landscape
    let systemInstruction = `You are the Lead Investment & Partnership Advisor for PriRecos (Primary Resources Corporation of Somalia).
PriRecos is a Somali natural resources development company focused on identifying, structuring, and developing primary resource projects through partnerships with international operators and investors.

Somalia is strategically positioned with tremendous unlocked primary resources:
1. Mining and minerals: High-grade copper, gold quartz, uranium, iron ore, gemstones, high-purity gypsum (world's largest deposits in north-central), limestone.
2. Agriculture and land development: 8.1 million hectares of fertile land, particularly around the Jubba and Shabelle river basins. Main exports are sesame, bananas, lemon, livestock (camels, sheep, goats).
3. Fisheries and marine resources: The longest coastline in mainland Africa (3,333 km), situated near highly productive upwelling zones with massive stocks of yellowfin tuna, skipjack, kingfish, lobster, and red snapper.
4. Energy resources: Significant onshore and offshore hydrocarbon basins (estimated billions of barrels of oil), alongside world-class wind speed and solar irradiance potential for renewable transitions.
5. Industrial materials: Extensive reserves of high-quality limestone, silica sand, and clay for domestic cement and glass production.

Your role:
- Speak in a highly professional, welcoming, institutional, and investment-grade corporate tone.
- Help prospective international partners, operators, and institutional investors analyze opportunities in Somalia.
- Guide them on joint-venture models, project development processes, local compliance, government relationships, and infrastructure readiness.
- Address concerns with transparency, detailing how PriRecos serves as the ultimate local joint-venture partner to de-risk operations, secure land permits, and align with federal and regional ministries.
- If inquiryContext is provided (representing a user's submitted partnership proposal), actively evaluate their proposal and provide a professional, constructive initial feasibility matching assessment! Be encouraging, suggest next structural steps, and offer specific geographical recommendations (e.g. the Shabelle basin for agriculture, Puntland/North West State for minerals, Hobyo or Kismayo for fisheries, etc.).

Keep answers structured, elegant, concise, and focused on investment-grade advisory.`;

    if (language && language !== "en") {
      systemInstruction += `\n\nCRITICAL LOCALIZATION DIRECTIVE: The user's active language is "${language}". You MUST write your entire response in that language (${language}). Translate all concepts, titles, geographic terms, and technical terms to match standard usage in "${language}". Do NOT output any English unless it's a specific brand name like "PriRecos".`;
    }

    // Map history to standard contents structure if provided
    const contents: any[] = [];
    
    if (chatHistory && Array.isArray(chatHistory)) {
      chatHistory.forEach((msg: any) => {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }]
        });
      });
    }

    // Add current context
    let finalPrompt = prompt;
    if (inquiryContext) {
      finalPrompt = `Below is our partnership proposal submitted to PriRecos:
- Company Name: ${inquiryContext.companyName}
- Contact Name: ${inquiryContext.contactName}
- Sector of Interest: ${inquiryContext.sector}
- Capital/Expertise scale: ${inquiryContext.capital}
- Description: ${inquiryContext.message}

Please perform a "Joint Venture Feasibility Match" for this proposal. Analyze how PriRecos can help, identify target regions or geological zones in Somalia matching this, and outline the typical development phases from coordination to operation.
User query: ${prompt || "Perform the assessment and list the next steps"}`;
    }

    contents.push({
      role: "user",
      parts: [{ text: finalPrompt }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ 
      error: error.message || "Failed to process advisory request.", 
      details: "Check if GEMINI_API_KEY is configured in your secrets." 
    });
  }
});

// Real-Time Dynamic Translation Route using Gemini
app.post("/api/translate", async (req, res) => {
  const { text, texts, targetLanguage } = req.body;

  if (!targetLanguage || targetLanguage === "en") {
    if (texts) return res.json({ translatedTexts: texts });
    return res.json({ translatedText: text });
  }

  try {
    const ai = getGeminiClient();
    const systemInstruction = `You are an expert technical translator specializing in Natural Resources, Geology, Energy, Maritime and investment terminology.
Translate the input precisely into the requested language (language code: "${targetLanguage}").
Do NOT write any notes, greetings, or explanations. Just output the translation itself.
If the input is a JSON array of strings, output a valid JSON array containing their exact translations in the same order, and nothing else. No markdown wraps.`;

    if (texts && Array.isArray(texts)) {
      const prompt = `Translate this JSON array of strings to target language code "${targetLanguage}".
Output ONLY the resulting valid JSON array of strings, with no markdown code blocks or wrapper:

${JSON.stringify(texts)}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          temperature: 0.1,
        },
      });

      let responseText = response.text.trim();
      if (responseText.startsWith("```")) {
        responseText = responseText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }

      try {
        const translatedTexts = JSON.parse(responseText);
        res.json({ translatedTexts });
      } catch (parseErr) {
        console.error("JSON parsing translation error:", responseText, parseErr);
        res.json({ translatedTexts: texts });
      }
    } else if (text) {
      const prompt = `Translate this text precisely into the target language code "${targetLanguage}":\n\n${text}`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          temperature: 0.1,
        },
      });
      res.json({ translatedText: response.text.trim() });
    } else {
      res.status(400).json({ error: "Missing text or texts to translate" });
    }
  } catch (error: any) {
    console.error("Dynamic Translation error:", error);
    if (texts) res.json({ translatedTexts: texts });
    else res.json({ translatedText: text });
  }
});

// ---------------------- VITE / STATIC ROUTING ----------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Corporate Server running on http://localhost:${PORT}`);
  });
}

startServer();
