const https = require('https');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(200).json({ reply: "Backend Config Error: GEMINI_API_KEY missing on Vercel Dashboard." });
        }

        const body = req.body || {};
        const incomingMessages = body.messages || [];

        // Ultimate safe fallback mapping for Gemini payload formatting
        let contents = [];
        if (incomingMessages.length === 0) {
            contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
        } else {
            contents = incomingMessages.map(m => ({
                role: (m.role === 'assistant' || m.role === 'model') ? 'model' : 'user',
                parts: [{ text: m.content || m.text || 'Hi' }]
            }));
        }

        const postData = JSON.stringify({
            contents: contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 200 }
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
            return res.status(200).json({ reply: `Google API Error Status: ${apiResponse.status}. Please verify API Key activation.` });
        }

        const dataJson = JSON.parse(apiResponse.body);
        const replyText = dataJson.candidates?.[0]?.content?.parts?.[0]?.text || "Message received, connection valid.";

        return res.status(200).json({ reply: replyText });

    } catch (error) {
        return res.status(200).json({ reply: `Internal Handler Catch: ${error.message}` });
    }
};
