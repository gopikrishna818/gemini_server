const axios = require('axios');

async function testServer() {
  console.log('🧪 Testing Gemini Server...\n');
  
  try {
    const response = await axios.post('http://localhost:3000/generate', {
      prompt: 'Say hello in one word'
    });
    
    console.log('✅ SUCCESS! Server is working!\n');
    console.log('📤 Sent: "Say hello in one word"');
    console.log('\n📥 Response from Gemini:');
    
    const text = response.data?.response?.candidates?.[0]?.content?.parts?.[0]?.text || 'No text found';
    console.log(text);
    
  } catch (error) {
    console.error('❌ FAILED:', error.response?.data || error.message);
  }
}

testServer();
