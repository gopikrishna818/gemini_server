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

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

// Track which key to use next (persists across requests in memory)
let currentKeyIndex = 0;

// Track alerted keys per session (resets on server restart)
const alertedKeys = new Set();

// Helper function to wait/delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGeminiAPI(prompt, keyIndex = currentKeyIndex, attemptedInCycle = 0) {
  // If we've tried all keys in this cycle, wait and retry from the beginning
  if (attemptedInCycle >= keys.length) {
    console.log(`⏳ All ${keys.length} keys exhausted. Waiting 3 seconds before retrying...`);
    await delay(3000);
    attemptedInCycle = 0; // Reset cycle counter
    keyIndex = 0; // Start from first key again
  }

  const key = keys[keyIndex];
  const keyNumber = keyIndex + 1;
  console.log(`🔑 Using Gemini API Key #${keyNumber} (Attempt ${attemptedInCycle + 1}/${keys.length})`);

  const controller = new AbortController();
  // Vercel Hobby: 10s, Pro: 60s - Use 50s to be safe for Pro, or 9s for Hobby
  // Set to 50s and let Vercel handle the hard timeout
  const timeout = setTimeout(() => controller.abort(), 50000);

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
        signal: controller.signal,
        timeout: 50000 // Axios timeout
      }
    );

    clearTimeout(timeout);
    console.log(`✅ Success with Key #${keyNumber}`);
    
    // Update current key index for next request
    currentKeyIndex = keyIndex;
    
    return res.data;
  } catch (err) {
    clearTimeout(timeout);
    
    if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
      console.error(`❌ Timeout on Key #${keyNumber}`);
      // Move to next key
      const nextKeyIndex = (keyIndex + 1) % keys.length;
      currentKeyIndex = nextKeyIndex;
      return callGeminiAPI(prompt, nextKeyIndex, attemptedInCycle + 1);
    }

    if (err.response) {
      const status = err.response.status;
      const errorMsg = err.response.data?.error?.message || JSON.stringify(err.response.data);
      
      console.error(`❌ Key #${keyNumber} failed with status ${status}: ${errorMsg}`);

      // Check if it's a rate limit or server error
      if (RETRYABLE_STATUS_CODES.includes(status)) {
        // Send alert email for keys 5, 8, 10 (only once per session)
        if ([5, 8, 10].includes(keyNumber) && !alertedKeys.has(keyNumber)) {
          console.log(`📧 Sending alert for Key #${keyNumber}...`);
          alertedKeys.add(keyNumber);
          sendAlert(keyNumber).catch(e => console.error('Email alert failed:', e.message));
        }
        
        // Move to next key
        const nextKeyIndex = (keyIndex + 1) % keys.length;
        currentKeyIndex = nextKeyIndex;
        console.warn(`⏭️ Switching to Key #${(nextKeyIndex + 1)}...`);
        
        return callGeminiAPI(prompt, nextKeyIndex, attemptedInCycle + 1);
      }
      
      // Non-retryable error (e.g., 400 Bad Request, 401 Unauthorized)
      console.error(`❌ Non-retryable error with Key #${keyNumber}`);
      throw new Error(`Gemini API error ${status}: ${errorMsg}`);
    }

    // Network or unknown error
    console.error(`❌ Network error with Key #${keyNumber}:`, err.message);
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Gemini Prompt Server running on http://localhost:${port}`);
});
