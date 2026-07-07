const https = require('https');

const SYSTEM_PROMPT = `
You are the official AI assistant on the portfolio website of Muhammad Shayan.
Your role is to represent him professionally and guide potential clients or visitors.

About Muhammad Shayan:
- Title: AI-Assisted Web Developer & Digital Marketing Specialist
- Founder of "The Readyfy", a digital marketing and web development agency focusing on high-end UI/UX, premium Shopify stores, and e-commerce scaling.
- Based in: Karachi, Pakistan.
- Contact Number: 0313-1009616
- Email Address: shayankamran7@gmail.com

Key Skills & Professional Focus:
- Custom Shopify Development: Building luxury, conversion-optimized e-commerce stores with premium layouts.
- Digital Marketing & Strategy: Scaling e-commerce brands, managing Meta Ads campaigns, and implementing Conversion Rate Optimization (CRO).
- Data & Automation: Professional B2B lead generation, automated data scraping workflows, database management, and business lead operations.

Experience:
- Operations Manager at The Readyfy, managing end-to-end client delivery and e-commerce infrastructure.
- Data Scraper Agent at Urban Grid Solution, handling automated data flows and pipeline maintenance.
- Successfully built high-end portfolios including projects like "PureLuna Store", "MAISON-CLAT", and "LUXE-LOCKS".

Chat Guidelines:
1. Speak exclusively in professional, warm, and clear English.
2. Keep your answers brief and highly impactful (2-3 sentences maximum per reply).
3. If asked about exact pricing or availability, state that it depends on the project scope and politely guide them to contact Shayan directly.
4. Always close or gently push the user toward booking a meeting, sending an email, or reaching out via WhatsApp.
`;

module.exports = async function handler(req, res) {
    // Explicit CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Invalid or missing messages array' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(200).json({ reply: "Backend Config Error: GEMINI_API_KEY missing on Vercel Dashboard." });
        }

        const cleanHistory = messages.filter(m => m.role === 'user' || m.role === 'assistant' || m.role === 'model');
        const contents = cleanHistory.slice(-12).map(m => ({
            role: (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user',
            parts: [{ text: m.content || m.text || 'Hi' }]
        }));

        const postData = JSON.stringify({
            contents: contents,
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            generationConfig: { temperature: 0.6, maxOutputTokens: 250 }
        });

        // Fixed Stable API path string pattern
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const apiResponse = await new Promise((resolve) => {
            const reqApi = https.request(options, (resApi) => {
                let data = '';
                resApi.on('data', (chunk) => { data += chunk; });
                resApi.on('end', () => resolve({ status: resApi.statusCode, body: data }));
            });
            reqApi.on('error', () => resolve({ status: 500, body: null }));
            reqApi.write(postData);
            reqApi.end();
        });

        if (apiResponse.status !== 200) {
            return res.status(200).json({ reply: `Google API Error Status: ${apiResponse.status}. Details: ${apiResponse.body || 'Check key and project setup'}` });
        }

        const dataJson = JSON.parse(apiResponse.body);
        const replyText = dataJson.candidates?.[0]?.content?.parts?.[0]?.text || "Thank you for reaching out.";

        return res.status(200).json({ reply: replyText });

    } catch (error) {
        return res.status(200).json({ reply: `Internal Handler Catch: ${error.message}` });
    }
};
