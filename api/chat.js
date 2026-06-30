/* ============================================================================
   /api/chat.js — Vercel Serverless Function
   ----------------------------------------------------------------------------
   Yeh function aapki API key ko 100% server-side rakhta hai. Frontend (GitHub
   Pages) sirf user ka message yahan bhejta hai; yeh function khud DeepSeek ya
   OpenAI ko call karta hai using a secret environment variable, aur sirf
   AI ka reply wapas frontend ko bhejta hai.

   Deployment steps neeche di gayi instructions mein hain.
   ============================================================================ */

// -----------------------------------------------------------------------------
// 1. CONFIG — apni settings yahan adjust karein
// -----------------------------------------------------------------------------

// Apni GitHub Pages domain yahan daalein (https:// ke saath, trailing slash NAHI).
// Yeh CORS ko restrict karta hai taake sirf aapki site is API ko call kar sake.
const ALLOWED_ORIGIN = "https://your-github-username.github.io";

// Provider switch — environment variable se control hota hai (Vercel dashboard
// mein set karein). Default "deepseek" hai agar set na ho.
const PROVIDER = (process.env.AI_PROVIDER || "deepseek").toLowerCase();

const PROVIDER_CONFIG = {
  deepseek: {
    url: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
    apiKey: process.env.DEEPSEEK_API_KEY,
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
  },
};

// System prompt server-side rakha gaya hai — frontend isay override nahi kar
// sakta, chahe DevTools se request tamper bhi ki jaye.
const SYSTEM_PROMPT = `
You are the official AI assistant on the portfolio website of Muhammad Shayan.
You answer on his behalf, representing him professionally, e.g. "Shayan
specializes in..." or "He can help you with...".

About Muhammad Shayan:
- Title: AI-Assisted Web Developer & Digital Marketing Specialist
- Founder of The Readyfy
- Based in Karachi, Pakistan
- Email: shayankamran7@gmail.com
- Phone: 0313-1009616

Skills:
- AI & Development: AI-Assisted Web Development, Shopify Customization, Store Optimization
- Marketing & Strategy: Meta Ads, Digital Marketing, Conversion Rate Optimization (CRO)
- Data & Automation: Automated Data Scraping, Database Management, Workflow Automation

Experience:
- Manager at The Readyfy — operations, project timelines, client delivery, e-commerce infrastructure
- Data Scraper Agent at Urban Grid Solution — automated scraping workflows, data cleaning, pipeline maintenance
- E-Commerce Assistant — Shopify management, product listings, Meta Ad campaigns

Featured projects:
- PureLuna Store — Premium E-Commerce UX/UI
- MAISON-CLAT — Luxury Shopify Setup
- LUXE-LOCKS — Conversion-Optimized Brand Store

Guidelines:
- Be warm, professional, and concise (2-4 sentences per reply unless asked for detail).
- If asked about pricing or exact availability, say it depends on project scope and
  encourage the visitor to share their requirements via the contact form or email/phone.
- If you don't know something specific, be honest and suggest they contact Shayan
  directly at shayankamran7@gmail.com.
- Reply in English, Urdu, or Roman Urdu — match the visitor's language.
- Never invent fake testimonials, fake stats, or commitments Shayan hasn't made.
`.trim();

// -----------------------------------------------------------------------------
// 2. HANDLER
// -----------------------------------------------------------------------------
module.exports = async function handler(req, res) {
  // --- CORS headers (every response needs these, including errors) ---
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight request — browser pehle yeh bhejta hai POST se pehle
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { messages } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "`messages` array is required." });
    }

    // Safety: sirf user/assistant messages frontend se accept karein —
    // koi bhi "system" role jo client ne bhejne ki koshish ki ho, drop kar dein.
    // Phir apna trusted system prompt khud prepend karein.
    const cleanHistory = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
      .slice(-20); // sirf last 20 messages rakhein — token cost aur abuse dono control hota hai

    if (cleanHistory.length === 0) {
      return res.status(400).json({ error: "No valid messages found." });
    }

    // Basic length guard per message (avoid huge payload abuse)
    for (const m of cleanHistory) {
      if (m.content.length > 2000) {
        return res.status(400).json({ error: "Message too long." });
      }
    }

    const finalMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...cleanHistory];

    const provider = PROVIDER_CONFIG[PROVIDER];
    if (!provider) {
      return res.status(500).json({ error: `Unknown AI_PROVIDER: ${PROVIDER}` });
    }
    if (!provider.apiKey) {
      return res.status(500).json({
        error: `Server misconfigured: missing API key for "${PROVIDER}". Set it in Vercel Environment Variables.`,
      });
    }

    const aiRes = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: finalMessages,
        temperature: 0.6,
        max_tokens: 400,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error(`[${PROVIDER}] upstream error:`, aiRes.status, errText);
      return res.status(502).json({ error: "Upstream AI service error. Try again shortly." });
    }

    const data = await aiRes.json();
    const reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({ error: "AI service returned no reply." });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
};
