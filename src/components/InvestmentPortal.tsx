import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { resourceSectors } from "../data";
import { Inquiry, ChatMessage } from "../types";
import { 
  Building2, 
  Send, 
  Sparkles, 
  FileSpreadsheet, 
  Bot, 
  ArrowRight, 
  Coins, 
  Lock, 
  User,
  ChevronRight,
  RefreshCw,
  ArrowLeft,
  Wrench
} from "lucide-react";
import { Language } from "../translations";
import { useTranslate } from "../hooks/useTranslate";

interface InvestmentPortalProps {
  language: Language;
}

export default function InvestmentPortal({ language }: InvestmentPortalProps) {
  const { t } = useTranslate(language);
  
  // Selected Funnel: null (selection screen), 'investor', or 'operator'
  const [activeFunnel, setActiveFunnel] = useState<"investor" | "operator" | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    sector: "Mining & Minerals",
    capital: "$5M - $10M",
    message: ""
  });
  
  const [submittingForm, setSubmittingForm] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [newlySubmittedInquiry, setNewlySubmittedInquiry] = useState<Inquiry | null>(null);

  // AI Chat & Advisor Panel State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInputMessage, setUserInputMessage] = useState("");
  const [isAiResponding, setIsAiResponding] = useState(false);

  // Set default chat greetings when newlySubmittedInquiry changes
  useEffect(() => {
    if (newlySubmittedInquiry) {
      setChatMessages([
        {
          role: "assistant",
          content: `${t("Welcome, prospective partner. I have analyzed your corporate profile and Joint-Venture inquiry targeting")} **${t(newlySubmittedInquiry.sector)}** ${t("with capital strength/technical scale of")} **${t(newlySubmittedInquiry.capital)}**.\n\n${t("I am ready to perform a Joint-Venture Feasibility Match Assessment. I will map your organizational profile to target geological zones in Somalia, evaluate regulatory clearances, and outline structural milestones.")}\n\n${t("Click \"Initiate Feasibility Match\" below, or type any specific questions regarding land rights, regional ministries, or compliance.")}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    }
  }, [newlySubmittedInquiry, language]);

  // Handle Form Submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.contactName || !formData.email || !formData.message) {
      alert(t("Please fill in all required fields."));
      return;
    }

    setSubmittingForm(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeFunnel,
          companyName: formData.companyName,
          contactName: formData.contactName,
          email: formData.email,
          sector: formData.sector,
          capital: formData.capital,
          message: formData.message
        })
      });
      if (!res.ok) {
        throw new Error(`Server responded with status ${res.status}`);
      }
      const data = await res.json();
      if (data.success && data.inquiry) {
        setFormSuccess(true);
        setNewlySubmittedInquiry(data.inquiry);
      } else {
        throw new Error(data.error || "Form submission was not successful");
      }
    } catch (err) {
      console.error("Error submitting inquiry:", err);
      alert(t("Failed to submit partnership request. Please try again."));
    } finally {
      setSubmittingForm(false);
    }
  };

  // Trigger Advisor Gemini Match Assessment
  const handleInitiateFeasibilityCheck = async () => {
    if (!newlySubmittedInquiry) return;

    setIsAiResponding(true);
    
    const triggerMsg: ChatMessage = {
      role: "user",
      content: t("Initiate JV Feasibility Match Assessment & target regional recommendations."),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    setChatMessages(prev => [...prev, triggerMsg]);

    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Initiate full Joint-Venture Feasibility Match and state geographical recommendations.",
          inquiryContext: newlySubmittedInquiry,
          chatHistory: chatMessages.slice(-4),
          language: language // Localize Gemini response!
        })
      });

      const data = await res.json();
      
      const responseMsg: ChatMessage = {
        role: "assistant",
        content: data.text || t("I was unable to compile the analysis. Please check your network or credentials."),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setChatMessages(prev => [...prev, responseMsg]);
    } catch (err) {
      console.error("AI Error:", err);
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: t("Error establishing link with PRIRECOS' Advisory server. Please ensure the Gemini API key is configured."),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsAiResponding(false);
    }
  };

  // Handle Custom Message Chat with AI Advisor
  const handleSendCustomMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInputMessage.trim() || !newlySubmittedInquiry || isAiResponding) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: userInputMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setChatMessages(prev => [...prev, userMsg]);
    const messageToSend = userInputMessage;
    setUserInputMessage("");
    setIsAiResponding(true);

    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: messageToSend,
          inquiryContext: newlySubmittedInquiry,
          chatHistory: chatMessages.map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            content: m.content
          })).slice(-6),
          language: language // Localize Gemini response!
        })
      });

      const data = await res.json();

      const responseMsg: ChatMessage = {
        role: "assistant",
        content: data.text || t("Advisory engine experienced a lapse. Please retry your query."),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setChatMessages(prev => [...prev, responseMsg]);
    } catch (err) {
      console.error("AI Error:", err);
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: t("We encountered an issue communicating with the backend advisory model. Please check your API variables."),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsAiResponding(false);
    }
  };

  const resetPortal = () => {
    setActiveFunnel(null);
    setFormSuccess(false);
    setNewlySubmittedInquiry(null);
    setChatMessages([]);
  };

  return (
    <div className="space-y-12" id="investment-portal-container">
      
      <AnimatePresence mode="wait">
        
        {/* STEP 1: FUNNEL SELECTION SCREEN */}
        {activeFunnel === null && (
          <motion.div
            key="funnel-selection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
            id="funnels-split-selection"
          >
            {/* INVESTOR FUNNEL CARD */}
            <div className="bg-white border border-stone-200 rounded-none p-6 lg:p-8 flex flex-col justify-between hover:border-amber-500/40 transition-all shadow-sm group">
              <div className="space-y-6">
                <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-none flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
                  <Coins className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-sans font-bold text-stone-900">{t("Investor Outreach")}</h3>
                </div>
              </div>

              <button
                onClick={() => {
                  setFormData({ ...formData, capital: "$5M - $10M" });
                  setActiveFunnel("investor");
                }}
                className="w-full mt-8 bg-stone-900 hover:bg-stone-800 text-amber-500 font-sans font-bold text-xs tracking-wider uppercase py-3.5 rounded-none transition-all flex items-center justify-center gap-2 cursor-pointer group-hover:bg-amber-500 group-hover:text-stone-950"
              >
                <span>{t("Enter Investor Pipeline")}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* OPERATOR FUNNEL CARD */}
            <div className="bg-white border border-stone-200 rounded-none p-6 lg:p-8 flex flex-col justify-between hover:border-amber-500/40 transition-all shadow-sm group">
              <div className="space-y-6">
                <div className="w-12 h-12 bg-stone-100 border border-stone-200 rounded-none flex items-center justify-center text-stone-700 group-hover:scale-105 transition-transform">
                  <Wrench className="w-6 h-6 text-amber-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-sans font-bold text-stone-900">{t("Operator Partnerships")}</h3>
                </div>
              </div>

              <button
                onClick={() => {
                  setFormData({ ...formData, capital: "Exploratory Exploration" });
                  setActiveFunnel("operator");
                }}
                className="w-full mt-8 bg-stone-900 hover:bg-stone-800 text-amber-500 font-sans font-bold text-xs tracking-wider uppercase py-3.5 rounded-none transition-all flex items-center justify-center gap-2 cursor-pointer group-hover:bg-amber-500 group-hover:text-stone-950"
              >
                <span>{t("Enter Operator and partner Pipeline")}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: FORM REGISTRATION (IF SELECTED & NOT SUBMITTED YET) */}
        {activeFunnel !== null && !formSuccess && (
          <motion.div
            key="funnel-form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-none p-6 lg:p-8 shadow-sm space-y-6"
            id="funnel-registration-form-container"
          >
            {/* Header with back button */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveFunnel(null)}
                  className="p-2 rounded-none bg-stone-50 border border-stone-200 hover:bg-stone-100 text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                  title={t("Back to selection")}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-xl font-sans font-bold text-stone-900">
                    {activeFunnel === "investor" ? t("Investor Registration") : t("Technical Operator Registration")}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {activeFunnel === "investor" 
                      ? t("Submit institutional credentials to view priority allocations.") 
                      : t("Provide industrial operations profile to apply for active blocks.")}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-sans font-bold uppercase tracking-widest px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-none">
                {t(activeFunnel)}
              </span>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4" id="partnership-form">
              {/* Company / consortium Name */}
              <div className="space-y-1">
                <label className="block text-xs font-sans text-stone-500 uppercase tracking-wider font-semibold">
                  {activeFunnel === "investor" ? t("Investment Firm / Fund Name *") : t("Operating Firm *")}
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    required
                    placeholder={activeFunnel === "investor" ? t("Investor name/firm here") : t("Firm name")}
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-none px-3 py-2 pl-10 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Grid for Contact Name and Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-sans text-stone-500 uppercase tracking-wider font-semibold">{t("Authorized Contact *")}</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      required
                      placeholder={t("Full Name")}
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-none px-3 py-2 pl-10 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-sans text-stone-500 uppercase tracking-wider font-semibold">{t("Corporate Email *")}</label>
                  <input
                    type="email"
                    required
                    placeholder="contact@domain.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Sector and Scale/Capacity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-sans text-stone-500 uppercase tracking-wider font-semibold">{t("Target Resource Sector")}</label>
                  <select
                    value={formData.sector}
                    onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                  >
                    {resourceSectors.map((sector) => (
                      <option key={sector.id} value={sector.name}>
                        {t(sector.name)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="block text-xs font-sans text-stone-500 uppercase tracking-wider font-semibold">
                    {activeFunnel === "investor" ? t("Capital Capacity Allocation") : t("Operations Mobilization Level")}
                  </label>
                  {activeFunnel === "investor" ? (
                    <select
                      value={formData.capital}
                      onChange={(e) => setFormData({ ...formData, capital: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                    >
                      <option value="$1M - $5M">$1M - $5M USD</option>
                      <option value="$5M - $10M">$5M - $10M USD</option>
                      <option value="$10M+">$10M+ USD ({t("Industrial-Scale")})</option>
                      <option value="Other Amount">{t("Other Amount")}</option>
                    </select>
                  ) : (
                    <select
                      value={formData.capital}
                      onChange={(e) => setFormData({ ...formData, capital: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                    >
                      <option value="Exploratory Exploration">{t("Exploratory Phase Surveying")}</option>
                      <option value="Medium Commercial Extraction">{t("Medium-Scale Extraction & Supply")}</option>
                      <option value="Heavy Industrial Exploitation">{t("Heavy Industrial & Processing")}</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Message / Scope summary */}
              <div className="space-y-1">
                <label className="block text-xs font-sans text-stone-500 uppercase tracking-wider font-semibold">
                  {activeFunnel === "investor" ? t("Investment Mandate Summary *") : t("Technical Capability Summary *")}
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={
                    activeFunnel === "investor"
                      ? t("Detail your funding mandate, preferred coinvestment models, and structural joint-venture expectations.")
                      : t("Detail your heavy equipment logistics, current exploration leases in East Africa, and localized training program designs.")
                  }
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm text-stone-900 placeholder-stone-450 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={submittingForm}
                className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-sans font-bold text-xs tracking-wider uppercase py-3.5 rounded-none shadow active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer mt-4"
                id="submit-proposal-btn"
              >
                <FileSpreadsheet className="w-4 h-4 text-stone-950" />
                <span>{submittingForm ? t("Lodging credentials...") : t("Lodge Joint-Venture Credentials")}</span>
              </button>
            </form>

            <div className="text-[10px] text-stone-400 font-semibold flex items-center gap-2 border-t border-stone-100 pt-4">
              <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span>{t("Direct secure clearing channel. Data protected under PRIRECOS confidentiality statutes.")}</span>
            </div>
          </motion.div>
        )}

        {/* STEP 3: PRIVATE AI ASSESSOR CONSOLE (IF SUBMITTED SUCCESSFULLY) */}
        {formSuccess && newlySubmittedInquiry && (
          <motion.div
            key="assessor-console"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            id="private-ai-assessor"
          >
            {/* Left Col: Your Logged Proposal Dossier */}
            <div className="lg:col-span-4 bg-white border border-stone-200 rounded-none p-6 shadow-sm flex flex-col justify-between" id="user-proposal-dossier">
              <div className="space-y-6">
                <div className="border-b border-stone-100 pb-4">
                  <span className="text-[10px] font-sans text-amber-700 uppercase tracking-widest font-bold block">{t("Secure Record")}</span>
                  <h3 className="text-lg font-sans font-bold text-stone-900 mt-1">{t("Concession Dossier")}</h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">{t("Your submitted parameters are registered and routed to partnership@prirecos.com.")}</p>
                </div>

                <div className="space-y-4 text-xs font-sans">
                  <div className="grid grid-cols-2 gap-2 border-b border-stone-50 pb-2">
                    <span className="text-stone-500 font-semibold">{t("Reference ID:")}</span>
                    <span className="text-amber-700 font-bold text-right">{newlySubmittedInquiry.id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-b border-stone-50 pb-2">
                    <span className="text-stone-500 font-semibold">{t("Profile Type:")}</span>
                    <span className="text-stone-900 font-bold text-right uppercase text-[10px]">{t(newlySubmittedInquiry.type)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-b border-stone-50 pb-2">
                    <span className="text-stone-500 font-semibold">{t("Corporation:")}</span>
                    <span className="text-stone-900 font-semibold text-right">{newlySubmittedInquiry.companyName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-b border-stone-50 pb-2">
                    <span className="text-stone-500 font-semibold">{t("Authorized Contact:")}</span>
                    <span className="text-stone-900 text-right">{newlySubmittedInquiry.contactName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-b border-stone-50 pb-2">
                    <span className="text-stone-500 font-semibold">{t("Target Sector:")}</span>
                    <span className="text-stone-900 font-semibold text-right text-amber-800">{t(newlySubmittedInquiry.sector)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-b border-stone-50 pb-2">
                    <span className="text-stone-500 font-semibold">{t("Scale/Allocation:")}</span>
                    <span className="text-stone-900 font-bold text-right">{t(newlySubmittedInquiry.capital)}</span>
                  </div>
                  <div className="space-y-1.5 pt-2">
                    <span className="text-stone-500 font-semibold block">{t("Submission Brief:")}</span>
                    <p className="text-[11px] text-stone-600 bg-stone-50 rounded-none p-2.5 leading-relaxed font-medium italic border border-stone-100">
                      "{newlySubmittedInquiry.message}"
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={resetPortal}
                className="w-full mt-6 bg-stone-50 border border-stone-200 hover:bg-stone-100 text-stone-700 text-xs font-sans font-bold py-3 rounded-none transition-colors cursor-pointer"
              >
                {t("Submit New Clearance Proposal")}
              </button>
            </div>

            {/* Right Col: AI Feasibility Advisor */}
            <div className="lg:col-span-8 bg-white border border-stone-200 rounded-none p-6 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[500px]" id="private-ai-chat-console">
              {/* Gold Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600"></div>
              
              {/* Advisor Header */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-none bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                    <Bot className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-amber-700 uppercase tracking-widest block">{t("Direct Advisor Link")}</span>
                    <h4 className="text-sm font-sans font-bold text-stone-900 mt-0.5">
                      {t("Joint-Venture Feasibility Assessor")}
                    </h4>
                  </div>
                </div>
                
                <span className="text-[9px] font-sans font-semibold text-stone-500 bg-stone-50 border border-stone-200 px-2.5 py-1 rounded-none">
                  {t("Gemini 3.5 Ready")}
                </span>
              </div>

              {/* Chat Log Display */}
              <div className="flex-grow bg-stone-50/70 border border-stone-100 rounded-none p-4 h-96 overflow-y-auto space-y-4 mb-4 scrollbar-thin">
                {chatMessages.map((msg, idx) => {
                  const isAi = msg.role === "assistant";
                  return (
                    <div 
                      key={idx}
                      className={`flex gap-3 max-w-[85%] ${isAi ? "mr-auto" : "ml-auto flex-row-reverse"}`}
                    >
                      <div className={`w-7 h-7 rounded-none shrink-0 flex items-center justify-center text-[10px] font-bold border ${
                        isAi 
                          ? "bg-amber-50 border-amber-200 text-amber-700" 
                          : "bg-stone-900 border-stone-800 text-amber-400"
                      }`}>
                        {isAi ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                      </div>
                      <div className="space-y-1">
                        <div className={`p-3.5 rounded-none text-xs leading-relaxed ${
                          isAi 
                            ? "bg-white text-stone-800 border border-stone-200/50 shadow-sm" 
                            : "bg-amber-500 text-stone-950 font-medium"
                        }`}>
                          {msg.content.split("\n").map((line, lIdx) => (
                            <React.Fragment key={lIdx}>
                              {line}
                              <br />
                            </React.Fragment>
                          ))}
                        </div>
                        <span className="block text-[8px] text-stone-400 font-bold px-1">{msg.timestamp}</span>
                      </div>
                    </div>
                  );
                })}

                {isAiResponding && (
                  <div className="flex gap-3 mr-auto items-center">
                    <div className="w-7 h-7 rounded-none bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    </div>
                    <span className="text-[10px] text-amber-700 animate-pulse uppercase tracking-wider font-bold">{t("Mapping Concession Geology...")}</span>
                  </div>
                )}
              </div>

              {/* Initial Action CTA Deck */}
              {chatMessages.length === 1 && (
                <div className="mb-4">
                  <button
                    onClick={handleInitiateFeasibilityCheck}
                    disabled={isAiResponding}
                    className="w-full py-4 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 hover:border-amber-500 text-amber-700 font-sans font-bold text-xs tracking-wider uppercase rounded-none flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-99"
                    id="initiate-feasibility-btn"
                  >
                    <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
                    <span>{t("Compile Feasibility & Geological Match")}</span>
                    <ChevronRight className="w-4 h-4 text-amber-700" />
                  </button>
                </div>
              )}

              {/* Message Entry */}
              <form onSubmit={handleSendCustomMessage} className="flex gap-2" id="advisor-chat-input-form">
                <input
                  type="text"
                  disabled={isAiResponding}
                  placeholder={t("Ask advisor about ministry guidelines, land access, or mineral grades...")}
                  value={userInputMessage}
                  onChange={(e) => setUserInputMessage(e.target.value)}
                  className="flex-grow bg-stone-50 border border-stone-200 focus:bg-white rounded-none px-3 py-2 text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-amber-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={isAiResponding || !userInputMessage.trim()}
                  className="bg-stone-900 hover:bg-stone-800 text-amber-500 px-4 py-2 rounded-none transition-colors flex items-center justify-center cursor-pointer"
                  id="send-chat-msg-btn"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}
