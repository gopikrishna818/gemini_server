const axios = require('axios');

async function testLongPrompt() {
  console.log('🧪 Testing Gemini Server with LONG prompt...\n');
  
  const longPrompt = `You are an expert B2B outreach specialist writing a highly personalized LinkedIn message sequence for real estate professionals.

## PROSPECT INFORMATION:

**Personal Details:**
- Full Name: Gopikrishna Chegoni
- First Name: Gopikrishna
- Last Name: Chegoni
- Job Title: VP of Sales
- Company: TechCorp Solutions

## YOUR TASK:

Generate a 4-message LinkedIn outreach sequence for Gopikrishna that:

1. **Message 1 (Connection Request):** 
   - Personalized note referencing their company
   - Keep it under 300 characters
   
2. **Message 2 (Value Introduction):**
   - Acknowledge their work at TechCorp Solutions
   - 150-200 words
   
3. **Message 3 (Social Proof & Case Study):**
   - Share a brief success story
   - 200-250 words
   
4. **Message 4 (Meeting Request):**
   - Offer a 15-minute call
   - 100-150 words

## OUTPUT FORMAT:

Provide the response in this exact JSON format:

{
  "message_1_connection_request": "...",
  "message_2_value_intro": "...",
  "message_3_social_proof": "...",
  "message_4_meeting_request": "...",
  "overall_strategy": "Brief 2-3 sentence summary",
  "key_personalization_elements": ["element 1", "element 2", "element 3"]
}

Generate the messages now.`;

  try {
    console.log('📤 Sending long prompt to server...\n');
    const startTime = Date.now();
    
    const response = await axios.post('http://localhost:3000/generate', {
      prompt: longPrompt
    }, {
      timeout: 60000 // 60 second timeout
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ SUCCESS! (took ${duration}s)\n`);
    console.log('📥 Response from Gemini:');
    
    const text = response.data?.response?.candidates?.[0]?.content?.parts?.[0]?.text || 'No text found';
    console.log(text.substring(0, 500) + '...\n');
    
  } catch (error) {
    console.error('❌ FAILED:', error.response?.data || error.message);
  }
}

testLongPrompt();
