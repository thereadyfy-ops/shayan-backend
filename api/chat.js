/* ============================================================================
   /api/chat.js — Vercel Serverless Function (Google Gemini 1.5 Flash)
   ----------------------------------------------------------------------------
   Is version mein CORS headers har request ke liye SABSE PEHLE set hote hain
   — chahe request GET ho, POST ho, ya OPTIONS preflight ho. Yeh "preflight
   failed" / "CORS error" issues ka sabse common fix hai: agar OPTIONS request
   par headers set karne se pehle hi function kisi aur logic (jaise body
   parsing) mein chala jaye ya crash ho jaye, browser preflight ko fail
   samajh leta hai aur asal POST request kabhi bhejta hi nahi.
   ============================================================================ */

// -----------------------------------------------------------------------------
// 1. CONFIG
// -----------------------------------------------------------------------------

// Apni GitHub Pages domain (https:// ke saath, trailing slash NAHI).
const ALLOWED_ORIGIN = "https://thereadyfy-ops.github.io";

const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT =
  "You are the official AI assistant on the portfolio website of Muhammad Shayan. " +
  "Speak exclusively in professional, warm, and clear English. Keep answers highly " +
  "impactful and brief (max 2-3 sentences). Guide users to reach out via WhatsApp " +
  "(0313-1009616) or email (shayankamran7@gmail.com) for custom Shopify development " +
  "or digital marketing inquiries.";

// -----------------------------------------------------------------------------
// 2. HANDLER
// -----------------------------------------------------------------------------
module.exports = async function handler(req, res) {
  // ---- STEP 1: CORS headers — ALWAYS FIRST, before any other logic runs ----
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400"); // cache preflight for 24h

  // ---- STEP 2: Preflight — reply immediately, do nothing else ----
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // ---- STEP 3: Only POST is allowed for the actual chat call ----
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    // ---- STEP 4: Validate the API key exists ----
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: "Server misconfigured: GEMINI_API_KEY is missing in Vercel Environment Variables.",
      });
      return;
    }

    // ---- STEP 5: Validate incoming payload ----
    const { messages } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "`messages` array is required." });
      return;
    }

    // Keep only well-formed user/assistant turns, cap length & count
    const cleanHistory = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
      .slice(-20)
      .map((m) => ({
        ...m,
        content: m.content.length > 2000 ? m.content.slice(0, 2000) : m.content,
      }));

    if (cleanHistory.length === 0) {
      res.status(400).json({ error: "No valid messages found." });
      return;
    }

    // ---- STEP 6: Map to Gemini's required `contents` format ----
    // Gemini only accepts role: "user" or "model" (never "assistant" or "system").
    const contents = cleanHistory.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Gemini requires the conversation to start with a "user" turn.
    if (contents[0].role !== "user") {
      contents.unshift({ role: "user", parts: [{ text: "Hello" }] });
    }

    const geminiPayload = {
      systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 300,
      },
    };

    // ---- STEP 7: Call Gemini ----
    const aiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("Gemini upstream error:", aiRes.status, errText);
      res.status(502).json({ error: "Upstream AI service error. Please try again shortly." });
      return;
    }

    const data = await aiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      // Common cause: response blocked by safety filters
      const blockReason = data?.promptFeedback?.blockReason;
      console.error("Gemini returned no reply.", blockReason ? `Block reason: ${blockReason}` : data);
      res.status(502).json({ error: "AI service returned no reply." });
      return;
    }

    res.status(200).json({ reply: reply.trim() });
  } catch (err) {
    console.error("Handler error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
};
