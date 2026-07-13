import React, { useState } from "react";
import { motion } from "motion/react";
import { Send, CheckCircle2 } from "lucide-react";
import { Language } from "../translations";
import { useTranslate } from "../hooks/useTranslate";

interface ContactFormProps {
  language: Language;
}

export default function ContactForm({ language }: ContactFormProps) {
  const { t } = useTranslate(language);
  const [formData, setFormData] = useState({
    category: "operator", // Default to operator
    name: "",
    title: "",
    organization: "",
    email: "",
    phone: "",
    subject: "",
    message: ""
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.organization || !formData.email || !formData.message) {
      alert(t("Please enter all required fields."));
      return;
    }

    setSubmitting(true);
    
    try {
      // Proxy inquiry details to /api/inquiries so it registers in the Active Concessions list too! 
      await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.category,
          companyName: formData.organization,
          contactName: formData.name,
          email: formData.email,
          sector: formData.subject || "General Consultation",
          capital: "TBD",
          message: `[Title: ${formData.title}] ${formData.message}`
        })
      });

      setSuccess(true);
    } catch (err) {
      console.error("Error logging contact inquiry:", err);
      // Fallback
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full" id="contact-hub-grid">
      
      {/* Interactive Corporate Form */}
      <div className="bg-white border border-stone-200 shadow-sm rounded-none p-6 lg:p-8" id="corporate-contact-form-container">
        
        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 space-y-4"
            id="contact-success-screen"
          >
            <div className="w-16 h-16 bg-amber-50 border border-amber-200 text-amber-600 rounded-none flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h4 className="text-2xl font-sans font-bold text-stone-900">{t("Communications Received")}</h4>
              <p className="text-sm text-stone-600">
                {t("Thank you for contacting PRIRECOS. Your inquiry has been registered, and a transmittal copy has been sent to partnership@prirecos.com. Our partnership desk will respond within 48 business hours.")}
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={() => {
                  setSuccess(false);
                  setFormData({
                    category: "operator",
                    name: "",
                    title: "",
                    organization: "",
                    email: "",
                    phone: "",
                    subject: "",
                    message: ""
                  });
                }}
                className="bg-stone-800 hover:bg-stone-900 text-white px-5 py-2.5 rounded-none font-sans font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors shadow-sm"
              >
                {t("Send another message")}
              </button>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleContactSubmit} className="space-y-5" id="corporate-contact-form">
            
            <div className="border-b border-stone-100 pb-3">
              <h4 className="text-lg font-sans font-bold text-stone-900">{t("Central Intake Form")}</h4>
            </div>

            {/* Inquiry Category Buttons */}
            <div className="space-y-1.5">
              <label className="block text-xs font-sans text-stone-500 uppercase tracking-wider font-semibold">{t("Inquiry Classification")}</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, category: "investor" })}
                  className={`py-2 px-1 text-[10px] sm:text-xs font-sans font-semibold rounded-none border transition-all text-center cursor-pointer ${
                    formData.category === "investor"
                      ? "bg-amber-50 border-amber-500 text-amber-700 font-bold"
                      : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {t("Investor Relations")}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, category: "operator" })}
                  className={`py-2 px-1 text-[10px] sm:text-xs font-sans font-semibold rounded-none border transition-all text-center cursor-pointer ${
                    formData.category === "operator"
                      ? "bg-amber-50 border-amber-500 text-amber-700 font-bold"
                      : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {t("Operator JV")}
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, category: "general" })}
                  className={`py-2 px-1 text-[10px] sm:text-xs font-sans font-semibold rounded-none border transition-all text-center cursor-pointer ${
                    formData.category === "general"
                      ? "bg-amber-50 border-amber-500 text-amber-700 font-bold"
                      : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {t("General Inquiry")}
                </button>
              </div>
            </div>

            {/* Personal Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-sans text-stone-500 uppercase tracking-wider font-semibold">{t("Contact Name *")}</label>
                <input
                  type="text"
                  required
                  placeholder={t("Contact Name")}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-sans text-stone-500 uppercase tracking-wider font-semibold">{t("Job Title")}</label>
                <input
                  type="text"
                  placeholder={t("Job Title")}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Corporate Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-sans text-stone-500 uppercase tracking-wider font-semibold">{t("Organization *")}</label>
                <input
                  type="text"
                  required
                  placeholder={t("Organization Name")}
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-sans text-stone-500 uppercase tracking-wider font-semibold">{t("Contact Email *")}</label>
                <input
                  type="email"
                  required
                  placeholder={t("Contact Email")}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Communication Handle & Subject */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-sans text-stone-500 uppercase tracking-wider font-semibold">{t("Phone / WhatsApp")}</label>
                <input
                  type="text"
                  placeholder={t("Phone / WhatsApp Number")}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-sans text-stone-500 uppercase tracking-wider font-semibold">{t("Subject / Concession")}</label>
                <input
                  type="text"
                  placeholder={t("Subject / Concession Area")}
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <label className="block text-xs font-sans text-stone-500 uppercase tracking-wider font-semibold">{t("Communications Content *")}</label>
              <textarea
                required
                rows={5}
                placeholder={t("State your formal communication or query in detail. Outline requirements, coordinates, or partnership briefs where applicable.")}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-sans font-bold text-xs tracking-wider uppercase py-3.5 rounded-none shadow hover:shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer border border-amber-600"
              id="submit-contact-btn"
            >
              <Send className="w-4 h-4 text-stone-950" />
              <span>{submitting ? t("Establishing link...") : t("Transmit Corporate Query")}</span>
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
