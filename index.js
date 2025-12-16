const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const { sendAlert } = require('./utils/email');
const { n8nRetellWebhookHandler } = require('./n8n-retell-webhook');

// Load environment variables
dotenv.config();

console.log("✅ Loaded keys from .env:", process.env.GOOGLE_GEMINI_API_KEYS);

const app = express();
app.use(express.json());

if (!process.env.GOOGLE_GEMINI_API_KEYS) {
  console.error("❌ GOOGLE_GEMINI_API_KEYS not found in .env");
  process.exit(1);
}

const keys = process.env.GOOGLE_GEMINI_API_KEYS.split(',').map(k => k.trim());
const alertedKeys = new Set();

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

async function callGeminiAPI(prompt, keyIndex = 0) {
  if (keyIndex >= keys.length) {
    throw new Error('All Gemini API keys exhausted.');
  }

  const key = keys[keyIndex];
  console.log(`🔁 Trying Gemini key #${keyIndex + 1}`);

  // Add timeout protection (8 seconds)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await axios.post(
      `${GEMINI_ENDPOINT}?key=${key}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      }
    );

    clearTimeout(timeout);
    console.log("✅ Gemini response received");
    return res.data;
  } catch (err) {
    clearTimeout(timeout); // Always clear timeout on error
    
    if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
      console.error(`❌ Request timeout for key #${keyIndex + 1}`);
      return callGeminiAPI(prompt, keyIndex + 1);
    }

    if (err.response) {
      const status = err.response.status;
      console.error(`❌ Error ${status}:`, err.response.data);

      // Retry on all retryable status codes
      if (RETRYABLE_STATUS_CODES.includes(status)) {
        const keyNumber = keyIndex + 1;
        if ([5, 8, 10].includes(keyNumber) && !alertedKeys.has(keyNumber)) {
          await sendAlert(keyNumber);
          alertedKeys.add(keyNumber);
        }
        console.warn(`Key ${keyNumber} failed with ${status}, retrying...`);
        return callGeminiAPI(prompt, keyIndex + 1);
      }
    } else {
      console.error("❌ Network or unknown error:", err.message);
    }

    throw err;
  }
}

app.post('/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing "prompt" in request body' });
  }

  console.log("📥 Received prompt:", prompt);

  try {
    const geminiResponse = await callGeminiAPI(prompt);
    res.json({ response: geminiResponse });
  } catch (err) {
    // Check if all keys were exhausted
    if (err.message === 'All Gemini API keys exhausted.') {
      return res.status(503).json({ error: 'All Gemini API keys exhausted or unavailable' });
    }
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

// ✅ This is the fix: simple browser-accessible GET route
app.get('/', (req, res) => {
  res.send('✅ Gemini Prompt Server is running. Use POST /generate to interact.');
});

// 📞 n8n to Retell webhook endpoint
app.post('/n8n/retell/call', n8nRetellWebhookHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Gemini Prompt Server running on http://localhost:${port}`);
});
