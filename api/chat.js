// Server-side system prompt for Muhammad Shayan's Portfolio Chatbot
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
    // Handle CORS preflight request
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust this to your specific domain if you want to restrict access
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Invalid or missing messages array' });
        }

        // Use DeepSeek Key or fallback to OpenAI Key from environment variables
        const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key is missing in Vercel Environment Variables.' });
        }

        // Setup clean message history and injection of System Prompt
        const cleanHistory = messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-15);
        const finalMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...cleanHistory];

        // Determine API Endpoint (Defaults to DeepSeek chat completions)
        const url = process.env.DEEPSEEK_API_KEY 
            ? 'https://api.deepseek.com/v1/chat/completions' 
            : 'https://api.openai.com/v1/chat/completions';

        const modelName = process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';

        // Direct fetch call
        const aiRes = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: modelName,
                messages: finalMessages,
                temperature: 0.6,
                max_tokens: 300
            })
        });

        if (!aiRes.ok) {
            const errData = await aiRes.text();
            return res.status(aiRes.status).json({ error: `AI Provider Error: ${errData}` });
        }

        const data = await aiRes.json();
        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
