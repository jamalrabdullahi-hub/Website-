import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

/*
 =========================================================================
  CRITICAL CORE SECURITY & DOMAIN VERIFICATION DIRECTIVE:
  DO NOT REMOVE, RENAME, OR BYPASS THE FILE "/public/googled5ea5aab0d17435e.html"
  OR THE ASSOCIATED EXPRESS HANDLER BELOW.
  This file is required to maintain active Google Search Console domain ownership
  and verification status for the production domain: https://prirecos.com/
 =========================================================================
*/

dotenv.config();

const app = express();
const PORT = 3000;

// Explicit routing fallback to protect Google site verification against accidental deletions
app.get("/googled5ea5aab0d17435e.html", (req, res) => {
  res.header("Content-Type", "text/html");
  res.send("google-site-verification: googled5ea5aab0d17435e.html");
});

app.use(express.json());

// Canonical domain and SSL redirection middleware (safe for development environment)
app.use((req, res, next) => {
  const host = req.headers.host || "";
  const forwardedProto = req.headers["x-forwarded-proto"] || "http";
  
  // Bypass redirects for local development or AI Studio sandboxes/preview URLs to prevent loopbacks
  const isLocalOrSandbox = 
    host.includes("localhost") || 
    host.includes("127.0.0.1") || 
    host.includes("0.0.0.0") || 
    host.includes("us-west2.run.app") ||
    host.includes("ais-dev-") || 
    host.includes("ais-pre-");
    
  if (isLocalOrSandbox) {
    return next();
  }

  const hasWww = host.toLowerCase().startsWith("www.");
  const isHttp = forwardedProto === "http";

  if (hasWww || isHttp) {
    const cleanHost = host.replace(/^www\./i, "");
    const targetUrl = `https://${cleanHost}${req.originalUrl}`;
    console.log(`[SEO REDIRECT] Redirecting incoming request from "${forwardedProto}://${host}${req.originalUrl}" to "${targetUrl}"`);
    return res.redirect(301, targetUrl);
  }

  next();
});

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

// Helper function to send email notification to partnership@prirecos.com
async function sendInquiryEmail(inquiry: Inquiry) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpSecure = process.env.SMTP_SECURE === "true";
  const emailFrom = process.env.EMAIL_FROM || "partnership@prirecos.com";
  const emailTo = process.env.EMAIL_TO || "partnership@prirecos.com";

  const emailSubject = `[PRIRECOS INTAKE] ${inquiry.type.toUpperCase()}: ${inquiry.companyName} (${inquiry.sector})`;

  const emailHtml = `
    <div style="font-family: 'Inter', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e0; background-color: #ffffff;">
      <!-- Header -->
      <div style="background-color: #1c1917; padding: 24px; text-align: center; border-bottom: 3px solid #f59e0b;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 1px; font-weight: bold; text-transform: uppercase;">PRIRECOS Intake Portal</h1>
        <p style="color: #fbbf24; margin: 5px 0 0 0; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">Primary Resources Corporation of Somalia</p>
      </div>

      <!-- Content -->
      <div style="padding: 24px; color: #44403c; line-height: 1.6;">
        <h2 style="font-size: 16px; font-weight: bold; margin-top: 0; color: #1c1917; border-bottom: 1px solid #e7e5e4; padding-bottom: 8px;">
          New Form Submission: <span style="color: #d97706;">${inquiry.id}</span>
        </h2>

        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #78716c; width: 35%;">Classification:</td>
            <td style="padding: 8px 0; color: #1c1917; font-weight: bold; text-transform: uppercase;">${inquiry.type}</td>
          </tr>
          <tr style="border-top: 1px solid #f5f5f4;">
            <td style="padding: 8px 0; font-weight: bold; color: #78716c;">Organization:</td>
            <td style="padding: 8px 0; color: #1c1917; font-weight: bold;">${inquiry.companyName}</td>
          </tr>
          <tr style="border-top: 1px solid #f5f5f4;">
            <td style="padding: 8px 0; font-weight: bold; color: #78716c;">Contact Name:</td>
            <td style="padding: 8px 0; color: #1c1917;">${inquiry.contactName}</td>
          </tr>
          <tr style="border-top: 1px solid #f5f5f4;">
            <td style="padding: 8px 0; font-weight: bold; color: #78716c;">Contact Email:</td>
            <td style="padding: 8px 0; color: #2563eb; font-weight: bold;"><a href="mailto:${inquiry.email}" style="color: #2563eb; text-decoration: none;">${inquiry.email}</a></td>
          </tr>
          <tr style="border-top: 1px solid #f5f5f4;">
            <td style="padding: 8px 0; font-weight: bold; color: #78716c;">Target Sector:</td>
            <td style="padding: 8px 0; color: #1c1917;">${inquiry.sector}</td>
          </tr>
          <tr style="border-top: 1px solid #f5f5f4;">
            <td style="padding: 8px 0; font-weight: bold; color: #78716c;">Capacity / Allocation:</td>
            <td style="padding: 8px 0; color: #1c1917; font-weight: bold; color: #b45309;">${inquiry.capital}</td>
          </tr>
          <tr style="border-top: 1px solid #f5f5f4;">
            <td style="padding: 8px 0; font-weight: bold; color: #78716c;">Submitted At:</td>
            <td style="padding: 8px 0; color: #78716c; font-family: monospace;">${inquiry.submittedAt}</td>
          </tr>
        </table>

        <div style="margin-top: 24px; padding: 16px; background-color: #fafaf9; border-left: 3px solid #d97706;">
          <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: bold; color: #1c1917; text-transform: uppercase; letter-spacing: 0.5px;">Message Content</h3>
          <p style="margin: 0; font-size: 13px; color: #44403c; white-space: pre-wrap;">${inquiry.message}</p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #fafaf9; padding: 16px; border-top: 1px solid #e7e5e4; text-align: center; font-size: 11px; color: #78716c;">
        <p style="margin: 0;">This email was automatically generated and routed by the PRIRECOS Central Intake Portal.</p>
        <p style="margin: 5px 0 0 0;">Do not reply directly to this automated email. Use the contact details provided above.</p>
      </div>
    </div>
  `;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: `"${inquiry.companyName} via PriRecos" <${emailFrom}>`,
        to: emailTo,
        subject: emailSubject,
        html: emailHtml,
        replyTo: inquiry.email
      });

      console.log(`[EMAIL ROUTER] Real email sent successfully: ${info.messageId}`);
      return { success: true, messageId: info.messageId, mode: "real" };
    } catch (error) {
      console.error("[EMAIL ROUTER] Error sending real email via SMTP:", error);
      return { success: false, error: (error as Error).message, mode: "real" };
    }
  } else {
    console.log("=========================================================");
    console.log("   [EMAIL ROUTER] FORWARDING TO AUTOROUTER (FORMSUBMIT)   ");
    console.log("=========================================================");
    console.log(`To:      ${emailTo}`);
    console.log(`From:    "${inquiry.companyName} via PriRecos" <${emailFrom}>`);
    console.log(`Subject: ${emailSubject}`);
    
    try {
      const formsubmitUrl = `https://formsubmit.co/ajax/${emailTo}`;
      const payload = {
        _subject: emailSubject,
        _replyto: inquiry.email,
        "Submission ID": inquiry.id,
        "Classification": inquiry.type.toUpperCase(),
        "Organization": inquiry.companyName,
        "Contact Name": inquiry.contactName,
        "Contact Email": inquiry.email,
        "Target Resource Sector": inquiry.sector,
        "Capacity or Allocation": inquiry.capital,
        "Submission Date (UTC)": inquiry.submittedAt,
        "Inquiry Details / Message": inquiry.message,
        "_honey": "", // honeypot spam protection
        "_template": "box" // clean box layout table template
      };

      const formsubmitResponse = await fetch(formsubmitUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (formsubmitResponse.ok) {
        const result = await formsubmitResponse.json();
        console.log("[EMAIL ROUTER] Formsubmit.co auto-forwarding succeeded:", result);
        return { success: true, mode: "formsubmit" };
      } else {
        const errorText = await formsubmitResponse.text();
        console.error("[EMAIL ROUTER] Formsubmit.co auto-forwarding failed with status:", formsubmitResponse.status, errorText);
        return { success: false, error: `Formsubmit returned status ${formsubmitResponse.status}`, mode: "formsubmit" };
      }
    } catch (fsError) {
      console.error("[EMAIL ROUTER] Failed to dispatch via Formsubmit auto-router:", fsError);
      return { success: false, error: (fsError as Error).message, mode: "formsubmit" };
    }
  }
}

// Submit a new inquiry
app.post("/api/inquiries", async (req, res) => {
  try {
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

    // Trigger automated background email routing in a non-blocking way (fire-and-forget)
    sendInquiryEmail(newInquiry).catch((emailError) => {
      console.error("[EMAIL ROUTER] Critical failure executing sendInquiryEmail task:", emailError);
    });

    res.status(201).json({ success: true, inquiry: newInquiry });
  } catch (error: any) {
    console.error("[API] Error in POST /api/inquiries:", error);
    res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
  }
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
    // Since server.ts compiles to dist/server.cjs, __dirname is the dist directory.
    // If running in another fashion, fallback to process.cwd() / dist.
    const distPath = __dirname.endsWith("dist") ? __dirname : path.join(process.cwd(), "dist");
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
