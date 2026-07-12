import React, { useState, useRef, useEffect } from "react";
import { Menu, X, Globe, BarChart3, ChevronDown } from "lucide-react";
import Logo from "./Logo";
import { Language, translations, languages } from "../translations";
import { useTranslate } from "../hooks/useTranslate";

interface NavbarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
}

function LanguageDropdown({ currentLanguage, setLanguage }: { currentLanguage: Language; setLanguage: (lang: Language) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const activeLang = languages.find(l => l.code === currentLanguage) || languages[0];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} id="language-dropdown-wrapper">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-3 py-2 text-xs font-sans font-bold text-stone-600 hover:text-stone-900 hover:bg-stone-50 border border-stone-200 bg-white transition-all cursor-pointer h-10 shadow-sm"
        id="language-dropdown-trigger"
      >
        <Globe className="w-4 h-4 text-stone-500" />
        <span className="uppercase">{activeLang.code}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-stone-200 shadow-lg py-1 z-50 divide-y divide-stone-100" id="language-dropdown-menu">
          <div className="py-1">
            {languages.map((lang) => {
              const isSelected = currentLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between w-full text-left px-4 py-2 text-xs font-sans font-bold transition-all ${
                    isSelected
                      ? "bg-amber-50 text-amber-900 font-extrabold"
                      : "text-stone-600 hover:text-stone-950 hover:bg-stone-50 font-semibold"
                  } cursor-pointer`}
                  id={`dropdown-lang-${lang.code}`}
                >
                  <div className="flex items-center space-x-2">
                    <span>{lang.name}</span>
                  </div>
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Navbar({ currentPage, setCurrentPage, language, setLanguage }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const t = translations[language];
  const { t: translate } = useTranslate(language);

  const navItems = [
    { id: "home", label: t.nav_home },
    { id: "about", label: t.nav_about },
    { id: "sectors", label: t.nav_sectors },
    { id: "investment", label: t.nav_portal },
    { id: "contact", label: t.nav_contact },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-stone-200/80 text-stone-800 shadow-sm" id="nav-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => { setCurrentPage("home"); setIsOpen(false); }}
            id="nav-logo-btn"
          >
            <div className="flex items-center justify-center w-11 h-11 bg-stone-50 border border-stone-200 shadow-inner group-hover:border-amber-400/80 transition-all duration-300">
              <Logo size="lg" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-sans font-extrabold text-xl tracking-tight text-stone-900 uppercase">PRIRECOS</span>
              </div>
              <p className="text-[10px] font-sans text-stone-500 tracking-wider uppercase font-medium">{translate("Primary Resources Corp of Somalia")}</p>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex space-x-1 lg:space-x-2" id="desktop-nav">
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  onClick={() => setCurrentPage(item.id)}
                  className={`px-4 py-2 text-sm font-sans font-semibold tracking-wide rounded-none transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "text-amber-700 bg-amber-50/70 border-b-2 border-amber-500 rounded-none"
                      : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Desktop Actions Area (Dropdown + CTA) */}
          <div className="hidden md:flex items-center space-x-3" id="desktop-actions">
            <LanguageDropdown currentLanguage={language} setLanguage={setLanguage} />
            
            <div className="hidden lg:block">
              <button
                onClick={() => setCurrentPage("investment")}
                className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-sans font-bold text-xs tracking-wider uppercase px-4.5 py-2.5 rounded-none shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 cursor-pointer"
                id="cta-invest-btn"
              >
                <BarChart3 className="w-4 h-4 text-stone-950" />
                <span>{t.nav_portal}</span>
              </button>
            </div>
          </div>

          {/* Mobile Actions Area (Dropdown + Hamburger Button) */}
          <div className="md:hidden flex items-center space-x-2" id="mobile-actions">
            <LanguageDropdown currentLanguage={language} setLanguage={setLanguage} />
            
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-stone-500 hover:text-stone-800 hover:bg-stone-50 focus:outline-none cursor-pointer"
              aria-expanded="false"
              id="mobile-menu-toggle"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {isOpen && (
        <div className="md:hidden bg-white border-b border-stone-200" id="mobile-drawer">
          <div className="px-2 pt-2 pb-4 space-y-1 sm:px-3">
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  id={`mobile-nav-item-${item.id}`}
                  onClick={() => {
                    setCurrentPage(item.id);
                    setIsOpen(false);
                  }}
                  className={`block w-full text-left px-4 py-3 rounded-none text-base font-sans font-semibold tracking-wide transition-all ${
                    isActive
                      ? "text-amber-700 bg-amber-50 border-l-4 border-amber-500"
                      : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <div className="pt-4 pb-2 border-t border-stone-200 px-4">
              <button
                onClick={() => {
                  setCurrentPage("investment");
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-sans font-bold text-sm tracking-wider uppercase py-3 rounded-none shadow"
                id="mobile-cta-btn"
              >
                <BarChart3 className="w-4 h-4 text-stone-950" />
                <span>{t.nav_portal}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
