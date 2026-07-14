import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import InvestmentPortal from "./components/InvestmentPortal";
import ContactForm from "./components/ContactForm";
import { useTranslate } from "./hooks/useTranslate";

import { resourceSectors, partnershipPhases, whySomaliaReasons } from "./data";
import { 
  Building2, 
  ArrowRight, 
  Coins, 
  Award, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowUpRight, 
  Layers, 
  Briefcase, 
  ChevronRight, 
  Info,
  Globe,
  Drill,
  MapPin,
  Flame,
  Fish,
  Trees,
  Gem,
  ExternalLink,
  Target,
  Handshake,
  Users,
  Landmark
} from "lucide-react";
import Logo from "./components/Logo";
import { Language, languages, translations } from "./translations";

export default function App() {
  // Path-based clean URL routing synchronizer
  const getInitialPage = (): string => {
    const path = window.location.pathname.replace(/^\/|\/$/g, "").toLowerCase();
    if (path === "aboutus" || path === "about-us" || path === "about") return "about";
    if (path === "sectors" || path === "blocks") return "sectors";
    if (path === "partner-portal" || path === "investment" || path === "portal" || path === "invest") return "investment";
    if (path === "contact") return "contact";
    return "home";
  };

  const [currentPage, setCurrentPageState] = React.useState<string>(getInitialPage());
  const [currentLanguage, setCurrentLanguage] = useState<Language>("en");
  const [funnelEmail, setFunnelEmail] = useState("");
  const [funnelSuccess, setFunnelSuccess] = useState(false);
  const [funnelSubmitting, setFunnelSubmitting] = useState(false);

  const setCurrentPage = (page: string) => {
    setCurrentPageState(page);
    let path = "/";
    if (page === "about") path = "/aboutus";
    else if (page === "sectors") path = "/sectors";
    else if (page === "investment") path = "/partner-portal";
    else if (page === "contact") path = "/contact";
    
    // Smoothly push history state so URL stays clean and mapped to active view
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
  };

  // Support native browser backward/forward navigation
  React.useEffect(() => {
    const handlePopState = () => {
      setCurrentPageState(getInitialPage());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const t = translations[currentLanguage];
  const { t: translate } = useTranslate(currentLanguage);

  const handleFunnelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!funnelEmail.trim()) return;
    setFunnelSubmitting(true);
    // Simulate API registration
    setTimeout(() => {
      setFunnelSubmitting(false);
      setFunnelSuccess(true);
      setFunnelEmail("");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-850 flex flex-col font-sans" id="app-root">
      


      {/* Corporate Header */}
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} language={currentLanguage} setLanguage={setCurrentLanguage} />

      {/* Main Content Area */}
      <main className="flex-grow" id="main-content">
        <AnimatePresence mode="wait">
          
          {/* OVERVIEW / HOMEPAGE */}
          {currentPage === "home" && (
            <motion.div
              key="home-page"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-20 pb-20"
              id="home-view"
            >
              {/* Premium Hero Banner Section */}
              <section className="relative min-h-[550px] lg:min-h-[640px] flex items-center bg-stone-100 overflow-hidden" id="hero-banner-section">
                
                {/* Background Image Layer with Heavy Bright/Gold Overlay */}
                <div className="absolute inset-0 z-0">
                  <img
                    src="/assets/images/hero_natural_resources.jpg"
                    alt="PriRecos Natural Resource Site"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-25 filter brightness-105 contrast-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#faf8f5] via-[#faf8f5]/85 to-transparent"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#faf8f5] via-[#faf8f5]/60 to-transparent"></div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-20">

                  <div className="max-w-3xl space-y-6">
                    
                    {/* Editorial Tag */}
                    <div className="inline-flex items-center space-x-2 bg-amber-100 border border-amber-200 px-3 py-1 rounded-none text-xs font-sans text-amber-850 uppercase tracking-wider font-bold">
                      <Award className="w-3.5 h-3.5 text-amber-600" />
                      <span>{t.hero_tag}</span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-sans font-extrabold tracking-tight text-stone-900 leading-[1.1]">
                      {t.hero_title_part1} <br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700">
                        {t.hero_title_part2}
                      </span>
                    </h1>

                    <p className="text-base sm:text-lg text-stone-700 leading-relaxed max-w-2xl font-medium">
                      {t.hero_desc}
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <button
                        onClick={() => setCurrentPage("sectors")}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-sans font-bold text-xs tracking-wider uppercase px-6 py-3.5 rounded-none shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer border border-amber-600"
                        id="hero-explore-btn"
                      >
                        <span>{t.hero_btn_explore}</span>
                        <ArrowRight className="w-4 h-4 text-stone-950" />
                      </button>
                      <button
                        onClick={() => setCurrentPage("investment")}
                        className="bg-white hover:bg-stone-50 text-stone-800 hover:text-stone-950 border border-stone-200 hover:border-amber-500/40 font-sans font-bold text-xs tracking-wider uppercase px-6 py-3.5 rounded-none shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
                        id="hero-portal-btn"
                      >
                        <span>{t.hero_btn_portal}</span>
                        <ArrowUpRight className="w-4 h-4 text-stone-600" />
                      </button>
                    </div>

                  </div>
                </div>

                {/* Subtle bottom border accent */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent"></div>
              </section>

              {/* Core Institutional Mandate */}
              <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center" id="homepage-mandate-block">
                
                <div className="lg:col-span-5 space-y-4">
                  <h2 className="text-3xl font-sans font-extrabold text-stone-900 tracking-tight">
                    {t.mandate_subtitle}
                  </h2>
                  <p className="text-sm text-stone-600 leading-relaxed font-sans font-medium">
                    {t.mandate_desc}
                  </p>
                  <p className="text-xs text-stone-500 leading-relaxed font-sans">
                    {translate("By organizing, securing, and properly extracting mining ores, marine stocks, alluvial soils, and energy pockets, we lay the baseline capitalization and infrastructure needed to support future manufacturing and industrialization.")}
                  </p>
                  
                  <div className="pt-2">
                    <button
                      onClick={() => setCurrentPage("about")}
                      className="text-xs font-sans font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1.5 cursor-pointer hover:underline"
                    >
                      {translate("Read our core economic pillars")}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Three Stats Cards Grid (7 Cols) */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6" id="overview-metrics-grid">
                  
                  <div className="bg-white p-6 rounded-none border border-stone-200/80 text-center space-y-2 shadow-sm">
                    <span className="block text-[11px] font-sans font-bold text-stone-500 uppercase">{translate("Coastline Access")}</span>
                    <span className="text-3xl font-sans font-black text-amber-700 block">{translate("3,333 km")}</span>
                    <span className="block text-[10px] text-stone-600 font-medium">{translate("Africa's longest mainland coast")}</span>
                  </div>

                  <div className="bg-white p-6 rounded-none border border-stone-200/80 text-center space-y-2 shadow-sm">
                    <span className="block text-[11px] font-sans font-bold text-stone-500 uppercase">{translate("Total EEZ Area")}</span>
                    <span className="text-3xl font-sans font-black text-amber-700 block">{translate("825,000 km²")}</span>
                    <span className="block text-[10px] text-stone-600 font-medium">{translate("Exclusive Economic Zone")}</span>
                  </div>

                  <div className="bg-white p-6 rounded-none border border-stone-200/80 text-center space-y-2 shadow-sm">
                    <span className="block text-[11px] font-sans font-bold text-stone-500 uppercase">{translate("Arable Land")}</span>
                    <span className="text-3xl font-sans font-black text-amber-700 block">{translate("8.1M ha")}</span>
                    <span className="block text-[10px] text-stone-600 font-medium">{translate("Dual alluvial river systems")}</span>
                  </div>

                </div>

              </section>

              {/* WHY SOMALIA - Geopolitical & Economic Advantages */}
              <section className="bg-stone-50 border-y border-stone-200/60 py-16" id="why-somalia-section">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                  
                  <div className="text-center max-w-3xl mx-auto space-y-2">
                    <span className="text-xs font-sans text-amber-700 uppercase tracking-widest font-bold block">{translate("Strategic Advantage")}</span>
                    <h2 className="text-3xl font-sans font-extrabold text-stone-900 tracking-tight">
                      {translate("Why Invest in Somalia Now?")}
                    </h2>
                    <p className="text-sm text-stone-600 leading-relaxed font-medium">
                      {translate("As global manufacturing centers seek diversified supplies of critical ores and seafood products, Somalia stands as the final underexplored frontier.")}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="why-somalia-cards">
                    {whySomaliaReasons.map((reason, idx) => (
                      <div key={idx} className="bg-white border border-stone-200/80 p-6 rounded-none hover:border-amber-500/40 transition-all space-y-3 shadow-sm">
                        <div className="w-8 h-8 rounded-none bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-sans text-sm font-bold">
                          0{idx + 1}
                        </div>
                        <h4 className="text-stone-900 font-sans font-bold text-sm tracking-tight">{translate(reason.title)}</h4>
                        <p className="text-xs text-stone-600 leading-relaxed font-sans">{translate(reason.description)}</p>
                      </div>
                    ))}
                  </div>

                </div>
              </section>

              {/* OUR SECTORS OVERVIEW DECK */}
              <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10" id="homepage-sectors-section">
                
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 pb-5">
                  <div>
                    <span className="text-xs font-sans text-amber-700 uppercase tracking-widest font-bold block">{t.sectors_section_title}</span>
                    <h2 className="text-lg font-sans font-bold text-stone-900 mt-1 tracking-tight max-w-xl">{t.sectors_section_subtitle}</h2>
                  </div>
                  <button
                    onClick={() => setCurrentPage("sectors")}
                    className="text-xs font-sans font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer hover:underline self-start sm:self-end"
                  >
                    {t.sectors_explore_btn}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="sectors-overview-deck">
                  {resourceSectors.slice(0, 4).map((sec) => {
                    
                    // Simple icon selection based on ID
                    let IconComponent = Gem;
                    if (sec.id === "agriculture") IconComponent = Trees;
                    if (sec.id === "fisheries") IconComponent = Fish;
                    if (sec.id === "energy") IconComponent = Flame;

                    return (
                      <div key={sec.id} className="bg-white border border-stone-200/80 rounded-none overflow-hidden group hover:border-amber-500/40 transition-all flex flex-col justify-between shadow-sm">
                        
                        <div className="h-44 relative overflow-hidden bg-stone-100 border-b border-stone-100">
                          <img
                            src={sec.image}
                            alt={sec.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-transparent to-transparent"></div>
                        </div>

                        <div className="p-5 space-y-4 flex-grow flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <h4 className="text-base font-sans font-bold text-stone-900 tracking-tight group-hover:text-amber-700 transition-colors">
                              {translate(sec.name)}
                            </h4>
                            <p className="text-xs text-stone-600 leading-relaxed font-sans line-clamp-3">
                              {translate(sec.description)}
                            </p>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>

              </section>



              {/* FINAL CALL-TO-ACTION CARD */}
              <section className="max-w-5xl mx-auto px-4 space-y-6" id="overview-final-cta">
                <div className="bg-white border border-stone-200 rounded-none p-8 lg:p-12 shadow-sm relative overflow-hidden">
                  
                  {/* Glowing gold dot pattern */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(217,119,6,0.03),transparent_60%)]"></div>

                  <div className="relative z-10 max-w-2xl mx-auto">
                    <div className="text-center space-y-3 mb-8">
                      <h3 className="text-2xl sm:text-3xl font-sans font-extrabold text-stone-900 tracking-tight">
                        {translate("Contact Us")}
                      </h3>
                      <p className="text-sm text-stone-600 leading-relaxed max-w-lg mx-auto font-sans font-medium">
                        {translate("Reach out directly to establish communications with our joint-venture coordinates, technical verification boards, or investment departments.")}
                      </p>
                    </div>
                    <ContactForm language={currentLanguage} />
                  </div>

                </div>
              </section>

            </motion.div>
          )}

          {/* ABOUT US PAGE */}
          {currentPage === "about" && (
            <motion.div
              key="about-page"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 space-y-16"
              id="about-view"
            >
              
              {/* Header Dossier */}
              <div className="border-b border-stone-200 pb-6 max-w-3xl">
                <span className="text-xs font-sans text-amber-700 uppercase tracking-widest font-bold block">{translate("Economic Mandate")}</span>
                <h2 className="text-4xl font-sans font-extrabold text-stone-900 mt-2 tracking-tight">
                  {translate("Primary Foundations & Phased Development")}
                </h2>
                <p className="text-sm text-stone-600 mt-2 leading-relaxed font-medium">
                  {translate("From a basic economic standpoint, primary resource development is the single most valuable catalyst for the Somali economy. True industrial progress requires baby-stepping economic growth by mastering our primary assets first.")}
                </p>
              </div>

              {/* Column Layout: Vision & Pillars */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start" id="about-pillars-grid">
                
                {/* Executive Vision */}
                <div className="space-y-4">
                  <h3 className="text-xl font-sans font-bold text-stone-900 flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-600" />
                    {translate("Our Development Philosophy")}
                  </h3>
                  <p className="text-sm text-stone-700 leading-relaxed font-sans font-medium">
                    {translate("We believe that a nation cannot leapfrog into high-technology or complex service sectors without first securing and capitalizing its foundational primary industries. The rich geological, agricultural, and marine geologies of Somalia represent our immediate and most valuable economic strength.")}
                  </p>
                  <p className="text-sm text-stone-600 leading-relaxed font-sans">
                    {translate("By coordinating transparent, de-risked joint-venture opportunities with international expertise, we focus on baby-stepping development. We start with the extractive and agricultural primaries to build regional infrastructure, technical skills, and domestic savings, creating a secure bedrock for future industrial stages.")}
                  </p>
                  
                  <div className="bg-amber-50 border border-amber-100 rounded-none p-5 flex items-start gap-3 mt-4">
                    <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <p className="text-xs text-stone-700 font-sans leading-relaxed">
                      <strong>{translate("Legal Framework Notice:")}</strong> {translate("All contracts and agreements brokered by PRIRECOS operate in strict coordination with the Somali Federal Ministry of Petroleum & Mineral Resources, the Ministry of Fisheries & Blue Economy, the Ministry of Agriculture & Irrigation, and the Ministry of Commerce & Industry, ensuring compliance with both federal statutes and regional state legislation.")}
                    </p>
                  </div>
                </div>

                {/* The 4 Highlights/Pillars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" id="about-highlights-deck">
                  
                  <div className="bg-white border border-stone-200 p-5 rounded-none space-y-2.5 shadow-sm">
                    <div className="w-8 h-8 rounded-none bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shadow-inner">
                      <Logo size={18} />
                    </div>
                    <h4 className="text-stone-900 font-sans font-bold text-sm tracking-tight">{translate("Local Market Knowledge")}</h4>
                    <p className="text-xs text-stone-600 leading-relaxed font-sans">
                      {translate("Deep operational history in geological mapping, land easement structures, and community mediation.")}
                    </p>
                  </div>

                  <div className="bg-white border border-stone-200 p-5 rounded-none space-y-2.5 shadow-sm">
                    <div className="w-8 h-8 rounded-none bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shadow-inner">
                      <Landmark className="w-4.5 h-4.5" />
                    </div>
                    <h4 className="text-stone-900 font-sans font-bold text-sm tracking-tight">{translate("Government Channels")}</h4>
                    <p className="text-xs text-stone-600 leading-relaxed font-sans">
                      {translate("Relationships with federal ministries and regional member-state cabinets to secure licensing.")}
                    </p>
                  </div>

                  <div className="bg-white border border-stone-200 p-5 rounded-none space-y-2.5 shadow-sm">
                    <div className="w-8 h-8 rounded-none bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shadow-inner">
                      <Drill className="w-4.5 h-4.5" />
                    </div>
                    <h4 className="text-stone-900 font-sans font-bold text-sm tracking-tight">{translate("Project Origination")}</h4>
                    <p className="text-xs text-stone-600 leading-relaxed font-sans">
                      {translate("Identification of blocks, oceanic stocks, and fertile floodplains backed by structural survey briefs.")}
                    </p>
                  </div>

                  <div className="bg-white border border-stone-200 p-5 rounded-none space-y-2.5 shadow-sm">
                    <div className="w-8 h-8 rounded-none bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shadow-inner">
                      <Handshake className="w-4.5 h-4.5" />
                    </div>
                    <h4 className="text-stone-900 font-sans font-bold text-sm tracking-tight">{translate("Joint Venture Networks")}</h4>
                    <p className="text-xs text-stone-600 leading-relaxed font-sans">
                      {translate("Sophisticated corporate structuring aligning foreign capital, expert technical operators, and domestic permits.")}
                    </p>
                  </div>

                </div>

              </div>

            </motion.div>
          )}

          {/* SECTORS DOSSIER PAGE */}
          {currentPage === "sectors" && (
            <motion.div
              key="sectors-page"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 space-y-16"
              id="sectors-view"
            >
              
              {/* Header */}
              <div className="border-b border-stone-200 pb-6 max-w-3xl">
                <span className="text-xs font-sans text-amber-700 uppercase tracking-widest font-bold block">{translate("Geological Inventory")}</span>
                <h2 className="text-4xl font-sans font-extrabold text-stone-900 mt-2 tracking-tight">
                  {translate("Resource Sectors & Verified Deposited Geologies")}
                </h2>
                <p className="text-sm text-stone-600 mt-2 leading-relaxed font-medium">
                  {translate("Our comprehensive geological inventory maps verified mineral veins, riverine agricultural basins, blue ocean fisheries, and sedimentary energy structures.")}
                </p>
              </div>

              {/* Main sector cards column list - High density layout */}
              <div className="space-y-16" id="sectors-dossier-list">
                {resourceSectors.map((sec, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <div 
                      key={sec.id}
                      className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white p-6 sm:p-8 rounded-none border border-stone-200 shadow-sm"
                      id={`sector-dossier-${sec.id}`}
                    >
                      
                      {/* Image block (5 Cols) */}
                      <div className={`lg:col-span-5 relative h-64 sm:h-80 rounded-none overflow-hidden border border-stone-200 bg-stone-100 shadow-inner ${
                        isEven ? "lg:order-1" : "lg:order-2"
                      }`}>
                        <img 
                          src={sec.image} 
                          alt={translate(sec.name)} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover filter brightness-105 saturate-90"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
                      </div>

                      {/* Content block (7 Cols) */}
                      <div className={`lg:col-span-7 space-y-4 ${
                        isEven ? "lg:order-2" : "lg:order-1"
                      }`}>
                        
                        <div>
                          <span className="text-[10px] font-sans text-amber-600 uppercase tracking-widest font-bold">{translate(sec.name)}</span>
                          <h3 className="text-2xl font-sans font-extrabold text-stone-900 mt-1 tracking-tight">{translate(sec.title)}</h3>
                        </div>

                        <p className="text-sm text-stone-600 leading-relaxed font-sans">
                          {translate(sec.detailedDescription)}
                        </p>

                        {/* Resource tags list */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-sans text-stone-500 uppercase tracking-wider block font-bold">{translate("Verified Primary Resources")}</span>
                          <div className="flex flex-wrap gap-2">
                            {sec.resources.map((res, rIdx) => (
                              <span key={rIdx} className="bg-stone-50 border border-stone-200 text-stone-700 text-xs px-2.5 py-1 rounded-none font-medium">
                                {translate(res)}
                              </span>
                            ))}
                          </div>
                        </div>

                      </div>

                    </div>
                  );
                })}
              </div>

            </motion.div>
          )}



          {/* PORTAL & INVESTMENT OPPORTUNITIES */}
          {currentPage === "investment" && (
            <motion.div
              key="investment-page"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20"
              id="investment-view"
            >
              <InvestmentPortal language={currentLanguage} />
            </motion.div>
          )}

          {/* CONTACT PAGE */}
          {currentPage === "contact" && (
            <motion.div
              key="contact-page"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20"
              id="contact-view"
            >
              <ContactForm language={currentLanguage} />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Corporate Footnote */}
      <Footer setCurrentPage={setCurrentPage} language={currentLanguage} />

    </div>
  );
}
