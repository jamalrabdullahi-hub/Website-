import React from "react";
import { Mail, MapPin, Phone, Award, ShieldCheck } from "lucide-react";
import Logo from "./Logo";
import { Language, translations } from "../translations";
import { useTranslate } from "../hooks/useTranslate";

interface FooterProps {
  setCurrentPage: (page: string) => void;
  language: Language;
}

export default function Footer({ setCurrentPage, language }: FooterProps) {
  const t = translations[language];
  const { t: translate } = useTranslate(language);

  return (
    <footer className="bg-stone-100 border-t border-stone-200 text-stone-600" id="corporate-footer">
      
      {/* Upper Footer: Branding and Quick Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          
          {/* Brand Col */}
          <div className="space-y-4" id="footer-brand-col">
            <div 
              className="flex items-center space-x-3 cursor-pointer group"
              onClick={() => setCurrentPage("home")}
            >
              <div className="flex items-center justify-center w-9 h-9 bg-white border border-stone-200 shadow-inner group-hover:border-amber-400/80 transition-all duration-300">
                <Logo size="sm" />
              </div>
              <div>
                <span className="font-sans font-bold text-lg tracking-wider text-stone-900 uppercase">PRIRECOS</span>
                <p className="text-[9px] font-sans text-stone-500 tracking-wider uppercase font-semibold">{translate("Primary Resources of Somalia")}</p>
              </div>
            </div>
            
            <p className="text-sm text-stone-600 leading-relaxed font-sans">
              {translate("PriRecos is the premier national natural resource development enterprise, coordinating with global energy, mineral, agricultural, and maritime operators to de-risk and unlock Somalia's extensive primary resource geology.")}
            </p>

            <div className="pt-2 flex flex-col space-y-1.5 text-xs text-stone-500">
              <div className="flex items-center space-x-2">
                <Award className="w-3.5 h-3.5 text-amber-600" />
                <span>{translate("Foreign Investment Law Compliant")}</span>
              </div>
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>{translate("Official Partner & JV Coordinator")}</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4" id="footer-links-col">
            <h4 className="text-stone-800 font-sans font-semibold text-xs tracking-wider uppercase border-b border-stone-200 pb-2">
              {translate("Corporate Governance")}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button onClick={() => setCurrentPage("home")} className="hover:text-amber-600 transition-colors cursor-pointer text-left text-stone-600 font-medium">
                  {translate("Corporate Overview")}
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentPage("about")} className="hover:text-amber-600 transition-colors cursor-pointer text-left text-stone-600 font-medium">
                  {translate("Executive Leadership & About Us")}
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentPage("sectors")} className="hover:text-amber-600 transition-colors cursor-pointer text-left text-stone-600 font-medium">
                  {translate("Sectors & Geologies")}
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentPage("investment")} className="hover:text-amber-600 transition-colors cursor-pointer text-left text-stone-600 font-medium">
                  {translate("Investor & Operator Portal")}
                </button>
              </li>
            </ul>
          </div>

          {/* Sectors Quick Selection */}
          <div className="space-y-4" id="footer-sectors-col">
            <h4 className="text-stone-800 font-sans font-semibold text-xs tracking-wider uppercase border-b border-stone-200 pb-2">
              {translate("Core Sectors")}
            </h4>
            <ul className="space-y-2 text-sm text-stone-600">
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-none"></span>
                <span>{translate("Mining & Mineral Ores")}</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-none"></span>
                <span>{translate("Agriculture & Land Basins")}</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-none"></span>
                <span>{translate("Fisheries & Oceanic Blue Economy")}</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-none"></span>
                <span>{translate("Offshore Hydrocarbons & Energy")}</span>
              </li>
            </ul>
          </div>

          {/* Contact and Contact Channel */}
          <div className="space-y-4" id="footer-contact-col">
            <h4 className="text-stone-800 font-sans font-semibold text-xs tracking-wider uppercase border-b border-stone-200 pb-2">
              {translate("Contact Channel")}
            </h4>
            <ul className="space-y-3.5 text-xs text-stone-600">
              <li className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-amber-500" />
                <span className="hover:text-amber-600 transition-colors">partnership@prirecos.com</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Lower Regulatory Badges */}
        <div className="mt-12 pt-8 border-t border-stone-200 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="flex flex-wrap gap-4 text-xs text-stone-500 font-semibold">
            <span>{t.footer_compliancy}</span>
          </div>
        </div>

        {/* Legal Disclaimer */}
        <div className="mt-4 text-xs text-stone-500 leading-relaxed max-w-4xl border-t border-stone-200/50 pt-4">
          <p>{t.footer_disclaimer}</p>
        </div>

        {/* Copyright */}
        <div className="mt-6 text-center text-xs text-stone-400 font-medium">
          <p>© {new Date().getFullYear()} {translate("PRIRECOS (Primary Resources Corporation of Somalia). All Rights Reserved.")}</p>
        </div>

      </div>
    </footer>
  );
}
