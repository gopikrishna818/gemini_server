const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const { sendAlert } = require('./utils/email');

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

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function callGeminiAPI(prompt, keyIndex = 0) {
  if (keyIndex >= keys.length) {
    throw new Error('All Gemini API keys exhausted.');
  }

  const key = keys[keyIndex];
  console.log(`🔁 Trying Gemini key #${keyIndex + 1}`);

  try {
    const res = await axios.post(
      `${GEMINI_ENDPOINT}?key=${key}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log("✅ Gemini response received");
    return res.data;
  } catch (err) {
    if (err.response) {
      console.error(`❌ Error ${err.response.status}:`, err.response.data);

      if (err.response.status === 429) {
        const keyNumber = keyIndex + 1;
        if ([5, 8, 10].includes(keyNumber) && !alertedKeys.has(keyNumber)) {
          await sendAlert(keyNumber);
          alertedKeys.add(keyNumber);
        }
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
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

// ✅ This is the fix: simple browser-accessible GET route
app.get('/', (req, res) => {
  res.send('✅ Gemini Prompt Server is running. Use POST /generate to interact.');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Gemini Prompt Server running on http://localhost:${port}`);
});
