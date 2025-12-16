const axios = require('axios');

/**
 * n8n to Retell Integration
 * 
 * Usage:
 * 1. Create a webhook in n8n that sends data here
 * 2. This endpoint will trigger a Retell call
 * 3. Retell will call the phone number with the specified agent
 */

// Configuration
const RETELL_CONFIG = {
  apiUrl: 'https://api.retellai.com/v2/create-phone-call',
  apiKey: 'key_0ccc1f07270b3fff81fbfe8e834f', // Move to .env in production
  fromNumber: '+1 213 753 1237',
  defaultAgentId: 'agent_1b938bf0031162b8286e7a9316'
};

/**
 * Make a phone call via Retell AI
 * @param {string} toNumber - Phone number to call (E.164 format)
 * @param {string} agentId - Optional agent ID to use
 * @param {object} metadata - Optional metadata for the call
 * @returns {object} Call response from Retell
 */
async function createRetellCall(toNumber, agentId = null, metadata = {}) {
  try {
    const response = await axios.post(
      RETELL_CONFIG.apiUrl,
      {
        from_number: RETELL_CONFIG.fromNumber,
        to_number: toNumber,
        override_agent_id: agentId || RETELL_CONFIG.defaultAgentId,
        metadata: metadata
      },
      {
        headers: {
          'Authorization': `Bearer ${RETELL_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      callId: response.data.call_id,
      status: response.data.call_status,
      agentId: response.data.agent_id,
      data: response.data
    };
  } catch (error) {
    console.error('❌ Retell API Error:', error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

/**
 * Express route handler for n8n webhook
 * Add this to your index.js
 */
function n8nRetellWebhookHandler(req, res) {
  console.log('📞 n8n webhook received:', req.body);

  const { 
    phone_number, 
    to_number,
    agent_id, 
    metadata 
  } = req.body;

  const phoneNumber = phone_number || to_number;

  // Validate required fields
  if (!phoneNumber) {
    return res.status(400).json({ 
      success: false,
      error: 'Missing required field: phone_number or to_number' 
    });
  }

  // Validate phone number format (basic E.164 check)
  if (!phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid phone number format. Use E.164 format (e.g., +19373293653)' 
    });
  }

  // Make the call
  createRetellCall(phoneNumber, agent_id, metadata)
    .then(result => {
      if (result.success) {
        console.log('✅ Call created:', result.callId);
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    })
    .catch(err => {
      console.error('❌ Unexpected error:', err);
      res.status(500).json({ 
        success: false,
        error: err.message 
      });
    });
}

module.exports = {
  createRetellCall,
  n8nRetellWebhookHandler,
  RETELL_CONFIG
};
