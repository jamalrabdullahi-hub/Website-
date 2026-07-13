import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY is not defined.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

// Curated list of all 100% human-visible UI strings across Navbar, Footer, Hero, Stats, Sectors, Maps, Portals, Advisor, and Forms.
const stringsList = [
  // Navigation & Page headers
  "Primary Resources",
  "Economic Mandate",
  "Concession Maps",
  "Investor Portal",
  "Legal Framework",
  "Contact Us",
  "Joint-Venture Portal",
  "Primary Resources Corp of Somalia",

  // Hero Section
  "Primary Resources of Somalia",
  "PriRecos is the premier national natural resource development enterprise, coordinating with global energy, mineral, agricultural, and maritime operators to de-risk and unlock Somalia's extensive primary resource geology.",
  "Foreign Investment Law Compliant",
  "Official Partner & JV Coordinator",
  "Explore Resources",
  "Initiate Partnership",

  // Stats Counters & Home Page
  "Coastline Access",
  "3,333 km",
  "Africa's longest mainland coast",
  "Total EEZ Area",
  "825,000 km²",
  "Exclusive Economic Zone",
  "Arable Land",
  "8.1M ha",
  "Dual alluvial river systems",
  "Read our core economic pillars",
  "By organizing, securing, and properly extracting mining ores, marine stocks, alluvial soils, and energy pockets, we lay the baseline capitalization and infrastructure needed to support future manufacturing and industrialization.",

  // Strategic Advantage
  "Strategic Advantage",
  "Why Invest in Somalia Now?",
  "As global manufacturing centers seek diversified supplies of critical ores and seafood products, Somalia stands as the final underexplored frontier.",
  "Strategic Geopolitical Positioning",
  "Positioned directly on the Gulf of Aden and Indian Ocean sea lanes. Somalia offers fast, direct sea routes to major commodity markets in the Middle East, India, and East Asia.",
  "Highly Favorable Regulatory Environment",
  "The Foreign Investment Law offers full capital repatriation, 10-year tax holidays for primary infrastructure, and standard joint-venture structures protecting international operators.",
  "Untapped First-Mover Advantage",
  "Somalia is one of the last frontiers for high-purity minerals and vast oceanic fisheries. Early movers secure prime concessions, high-grade deposits, and exclusive regional permissions.",
  "Active Institutional Backing",
  "Multi-lateral institutions including the World Bank and IFC are actively funding infrastructure, port modernizations, and energy transmission lines across key commercial nodes.",

  // Sectors / Geological Inventory Tabs
  "Geological Inventory",
  "Resource Sectors & Verified Deposited Geologies",
  "Our comprehensive geological inventory maps verified mineral veins, riverine agricultural basins, blue ocean fisheries, and sedimentary energy structures.",
  "Mining & Minerals",
  "Agriculture & Land",
  "Fisheries & Marine",
  "Energy & Hydrocarbons",
  "Unearthing Diverse Mineral Wealth",
  "Nourishing Regional Markets",
  "Harvesting Pristine Blue Waters",
  "Powering Phased Development",
  "Somalia hosts highly promising, underexplored crystalline basement rocks containing high-grade ores, base metals, and extensive industrial material deposits.",
  "With millions of hectares of arable soil and permanent river basins, Somalia represents a strategic agricultural hub for cash crops and food security.",
  "Bordering the Gulf of Aden and the Indian Ocean, Somalia's exclusive economic zone is home to rich pelagic fish stocks and sustainable fisheries.",
  "From onshore sedimentary basins to coastal wind and high-irradiance solar corridors, Somalia's energy profile offers massive dual-transition potential.",

  // Extended Sector Geologies & Descriptions
  "Unlocking High-Yield Agro-Industrial Basins",
  "With over 8 million hectares of arable land and major river systems, Somalia offers fertile ground for commercial agriculture, sesame, and high-value fruit exports.",
  "The southern regions of Somalia are traversed by the Jubba and Shabelle rivers, forming highly fertile alluvial basins. Historically a major global banana exporter, the region possesses massive untapped potential for commercial farming, modern irrigation schemes, agro-processing, and oilseed cultivation to serve Middle Eastern and European markets.",
  "Capitalizing on Africa's Longest Coastline",
  "Operating near highly productive marine upwelling zones, our fishery sector accesses massive pelagic and demersal fish stocks in the Indian Ocean and Gulf of Aden.",
  "Somalia enjoys a 3,333 km coastline—the longest in mainland Africa. The combination of the strong seasonal monsoon winds and deep ocean upwellings drives high nutrient concentrations, supporting exceptionally rich populations of yellowfin tuna, skipjack, kingfish, lobster, and deep-sea snappers, representing an elite, highly lucrative blue economy frontier.",
  "Unlocking Onshore & Offshore Hydrocarbon Reservoirs",
  "Somalia stands on the cusp of an energy revolution, possessing premier onshore/offshore oil & gas basins alongside world-class solar and wind energy potential.",
  "The sedimentary basins of Somalia (Mugdisho, Coriole, and Mudug) contain oil and gas structures directly analogous to those in Yemen and East Africa's oil provinces. Simultaneously, Somalia has some of the highest wind speed profiles in Africa and consistent high solar irradiance, offering outstanding hybrid microgrid and utility-scale green energy transition projects.",

  // Sector Resources
  "High-Purity Gypsum",
  "Copper Ores",
  "Gold Quartz",
  "Iron Ore",
  "Lead-Zinc",
  "Quartz & Feldspar",
  "Gemstones (Emerald, Sapphire)",
  "Premium Sesame Seeds",
  "Bananas (Cavendish)",
  "Citrus & Lemons",
  "Sesame Oil",
  "Sugar Cane",
  "Maize & Sorghum",
  "Livestock Feed",
  "Yellowfin Tuna",
  "Skipjack Tuna",
  "Spiny Lobster",
  "Mackerel & Sardines",
  "Red Snapper",
  "Grouper",
  "Marine Algae",
  "Offshore Oil & Gas Blocks",
  "Onshore Hydrocarbon Basins",
  "Utility-Scale Solar PV",
  "High-Velocity Wind Power",
  "Geothermal Reservoirs",
  "Verified Primary Resources",

  // Sector Specs
  "Gypsum Purity",
  "95% - 99%",
  "Estimated Deposits",
  "Billions of Tons",
  "JV Licensing Mode",
  "Concession / PSA",
  "Key Export Crop",
  "Sesame (Top Global tier)",
  "River Length",
  "Over 1,100 km",
  "Coastline Length",
  "3,333 Kilometers",
  "Annual Sustainable Yield",
  "200k+ Metric Tons",
  "Exclusive Economic Zone Area",
  "1M+ Square km",
  "Offshore Oil Potential",
  "Estimated Billions of Barrels",
  "Average Wind Speed",
  "8.5 - 11.0 m/s (Coastal)",
  "Solar Irradiance",
  "5.8 - 6.5 kWh/m²/day",
  "8.1M Hectares",

  // Development Philosophy Section
  "Our Development Philosophy",
  "Primary Foundations & Phased Development",
  "We believe that a nation cannot leapfrog into high-technology or complex service sectors without first securing and capitalizing its foundational primary industries. The rich geological, agricultural, and marine geologies of Somalia represent our immediate and most valuable economic strength.",
  "From a basic economic standpoint, primary resource development is the single most valuable catalyst for the Somali economy. True industrial progress requires baby-stepping economic growth by mastering our primary assets first.",
  "By coordinating transparent, de-risked joint-venture opportunities with international expertise, we focus on baby-stepping development. We start with the extractive and agricultural primaries to build regional infrastructure, technical skills, and domestic savings, creating a secure bedrock for future industrial stages.",
  "Legal Framework Notice:",
  "All contracts and agreements brokered by PRIRECOS operate in strict coordination with the Somali Federal Ministry of Petroleum & Mineral Resources, the Ministry of Fisheries & Blue Economy, the Ministry of Agriculture & Irrigation, and the Ministry of Commerce & Industry, ensuring compliance with both federal statutes and regional state legislation.",
  "Local Market Knowledge",
  "Deep operational history in geological mapping, land easement structures, and community mediation.",
  "Government Channels",
  "Relationships with federal ministries and regional member-state cabinets to secure licensing.",
  "Project Origination",
  "Identification of blocks, oceanic stocks, and fertile floodplains backed by structural survey briefs.",
  "Joint Venture Networks",
  "Sophisticated corporate structuring aligning foreign capital, expert technical operators, and domestic permits.",

  // Corporate Footer Extras
  "Corporate Governance",
  "Corporate Overview",
  "Executive Leadership & About Us",
  "Sectors & Geologies",
  "Investor & Operator Portal",
  "Core Sectors",
  "Mining & Mineral Ores",
  "Agriculture & Land Basins",
  "Fisheries & Oceanic Blue Economy",
  "Offshore Hydrocarbons & Energy",
  "Contact Channel",
  "PRIRECOS (Primary Resources Corporation of Somalia). All Rights Reserved.",

  // Concession Maps & Registry (Fallback)
  "Registry ID:",
  "Status:",
  "State:",
  "Key Assets:",
  "Coordinates:",
  "Inquire About This Block",
  "Under Review",
  "Partner Matched",
  "Information Requested",
  "Approved",
  "Puntland",
  "North West State",
  "Galmudug",
  "Hirshabelle",
  "Banadir",
  "South West State",
  "Jubaland",
  "Active Registry & Transparency Index",
  "Explore regional resource distributions, verified geological maps, and ministerial contact offices.",
  "Interactive Concession Registry",
  "Interactive Geological Map",
  "Regional Allocation Map",
  "Select Concession Sector",
  "Select Federal Member State",
  "All Sectors",
  "All Regions",
  "Active Concession Registry",

  // Joint-Venture Portal Selection
  "Secure Strategic Ingestion",
  "Select Your Partnership Route",
  "Sovereign/Corporate Investor",
  "Access pre-feasibility briefings, geological survey portfolios, and minister-approved joint venture frameworks.",
  "Technical JV Operator",
  "Propose technical execution briefs, equipment deployment timelines, and local content structures.",
  "Submit Partnership Proposal",
  "Propose Technical Operation",
  "Submit New Clearance Proposal",
  "Direct Advisor Link",
  "Joint-Venture Feasibility Assessor",
  "Ask advisor about ministry guidelines, land access, or mineral grades...",
  "Initiate Feasibility Match",
  "Compiling Match...",
  "Feasibility Report Compiled",
  "Reference ID:",
  "Target Sector:",
  "Scale/Allocation:",
  "Authorized Contact:",
  "Corporation:",
  "Profile Type:",
  "Submission Brief:",
  "Your submitted parameters are registered and routed to partnership@prirecos.com.",
  "Concession Dossier",
  "Secure Record",
  "Establishing link...",
  "Transmit Corporate Query",
  "Transmitting...",
  "investor",
  "operator",
  "general",

  // Partner Portal Forms & Inputs
  "Investor Outreach",
  "Enter Investor Pipeline",
  "Operator Partnerships",
  "Enter Operator and partner Pipeline",
  "Other Amount",
  "Back to selection",
  "Investor Registration",
  "Technical Operator Registration",
  "Submit institutional credentials to view priority allocations.",
  "Provide industrial operations profile to apply for active blocks.",
  "Investment Firm / Fund Name *",
  "Operating Firm *",
  "Investor name/firm here",
  "Firm name",
  "Authorized Contact *",
  "Full Name",
  "Corporate Email *",
  "Target Resource Sector",
  "Capital Capacity Allocation",
  "Operations Mobilization Level",
  "Industrial-Scale",
  "Exploratory Phase Surveying",
  "Medium-Scale Extraction & Supply",
  "Heavy Industrial & Processing",
  "Investment Mandate Summary *",
  "Technical Capability Summary *",
  "Detail your funding mandate, preferred coinvestment models, and structural joint-venture expectations.",
  "Detail your heavy equipment logistics, current exploration leases in East Africa, and localized training program designs.",
  "Lodge Joint-Venture Credentials",
  "Lodging credentials...",
  "Direct secure clearing channel. Data protected under PRIRECOS confidentiality statutes.",
  "Gemini 3.5 Ready",
  "Mapping Concession Geology...",
  "Compile Feasibility & Geological Match",

  // Chat Advisor Specifics & Responses
  "Welcome, prospective partner. I have analyzed your corporate profile and Joint-Venture inquiry targeting",
  "with capital strength/technical scale of",
  "I am ready to perform a Joint-Venture Feasibility Match Assessment. I will map your organizational profile to target geological zones in Somalia, evaluate regulatory clearances, and outline structural milestones.",
  "Click \"Initiate Feasibility Match\" below, or type any specific questions regarding land rights, regional ministries, or compliance.",
  "Initiate JV Feasibility Match Assessment & target regional recommendations.",
  "I was unable to compile the analysis. Please check your network or credentials.",
  "Error establishing link with PRIRECOS' Advisory server. Please ensure the Gemini API key is configured.",
  "Advisory engine experienced a lapse. Please retry your query.",
  "We encountered an issue communicating with the backend advisory model. Please check your API variables.",

  // Contact Form & General Intake
  "Central Intake Form",
  "Inquiry Classification",
  "Investor Relations",
  "Operator JV",
  "General Inquiry",
  "Contact Name *",
  "Contact Name",
  "Job Title",
  "Organization *",
  "Organization Name",
  "Contact Email *",
  "Contact Email",
  "Phone / WhatsApp",
  "Phone / WhatsApp Number",
  "Subject / Concession",
  "Subject / Concession Area",
  "Communications Content *",
  "State your formal communication or query in detail. Outline requirements, coordinates, or partnership briefs where applicable.",
  "Communications Received",
  "Thank you for contacting PRIRECOS. Your inquiry has been registered, and a transmittal copy has been sent to partnership@prirecos.com. Our partnership desk will respond within 48 business hours.",
  "Send another message",
  "Please fill in all required fields.",
  "Failed to submit partnership request. Please try again.",
  "Please enter all required fields."
];

async function translateAllStrings(texts, targetLanguage) {
  if (!texts || texts.length === 0) return {};

  const systemInstruction = `You are an expert translator specializing in legal, corporate, and natural resource geologies.
Translate the input JSON object's English values into "${targetLanguage}".
Keep the exact same JSON keys (which are the original English strings) and translate only the values.
Do not translate the JSON keys themselves, only translate the values.
Provide accurate, natural, and high-quality translations in "${targetLanguage}".
Output ONLY the resulting valid JSON object. Do not wrap in markdown or write any explanations.`;

  const objToTranslate = {};
  texts.forEach((text) => {
    objToTranslate[text] = "";
  });

  const prompt = `Translate all values in this JSON object into "${targetLanguage}". Keep the keys in English. Output ONLY the resulting valid JSON object:

${JSON.stringify(objToTranslate)}`;

  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    console.log(`Calling Gemini to translate ALL ${texts.length} strings to "${targetLanguage}" (Attempt ${attempt}/${maxRetries})...`);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });

      const textOut = response.text;
      if (!textOut) {
        throw new Error("Empty response from Gemini SDK");
      }

      const cleanedText = textOut.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleanedText);
      
      const resultMap = {};
      texts.forEach((orig) => {
        resultMap[orig] = parsed[orig] || orig;
      });
      return resultMap;
    } catch (err) {
      console.warn(`  Attempt ${attempt} failed for ${targetLanguage}:`, err.message);
      
      const isRateLimit = err.message.includes("quota") || err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED");
      if (isRateLimit && attempt < maxRetries) {
        console.log(`  Rate limit encountered. Sleeping for 15 seconds before retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 15000));
        continue;
      }
      
      if (attempt >= maxRetries) {
        console.error(`  All retry attempts exhausted for ${targetLanguage}. Falling back to original strings.`);
        const fallbackMap = {};
        texts.forEach((t) => {
          fallbackMap[t] = t;
        });
        return fallbackMap;
      }
    }
  }
}

async function run() {
  console.log("Starting high-efficiency single-request static translations builder...");
  console.log(`Using curated list of ${stringsList.length} core UI strings.`);

  const targetLanguages = ["so"];
  const dictionary = {};

  // For safety against rate limits, we execute translations sequentially
  // Since we only make 9 requests in total, we will stay well within all daily and per-minute quotas.
  for (const lang of targetLanguages) {
    dictionary[lang] = await translateAllStrings(stringsList, lang);
    console.log(`  Finished language: ${lang}`);
    
    // 3 second delay to remain incredibly polite to the API
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  // Write output to src/staticTranslations.ts
  const outputPath = path.join(__dirname, "src/staticTranslations.ts");
  const fileContent = `// THIS FILE IS AUTO-GENERATED BY create-static-translations.js
// It contains static translations for 1:1 dynamic mapping to bypass API latency and eliminate jank.

export const staticTranslations: Record<string, Record<string, string>> = ${JSON.stringify(dictionary, null, 2)};
`;

  fs.writeFileSync(outputPath, fileContent, "utf-8");
  console.log(`Successfully compiled static translations to: ${outputPath}`);
}

run().catch(console.error);
