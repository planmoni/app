// Test script to check if webhook endpoint is accessible
const fetch = require('node-fetch');

const WEBHOOK_URL = 'http://localhost:3000/api/paystack-webhook'; // Update this with your actual URL

async function testWebhookEndpoint() {
  try {
    console.log('🧪 Testing webhook endpoint accessibility...');
    console.log('📡 URL:', WEBHOOK_URL);
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Paystack-Signature': 'test-signature'
      },
      body: JSON.stringify({ test: true })
    });
    
    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📡 Response body:', responseText);
    
    if (response.status === 401) {
      console.log('✅ Endpoint is accessible! (401 is expected for invalid signature)');
    } else if (response.status === 200) {
      console.log('✅ Endpoint is accessible and responding!');
    } else {
      console.log('⚠️  Endpoint responded with unexpected status');
    }
    
  } catch (error) {
    console.error('❌ Error testing webhook endpoint:', error.message);
    console.log('\n🔧 Possible solutions:');
    console.log('1. Make sure your app is running');
    console.log('2. Check if the webhook URL is correct');
    console.log('3. Ensure the endpoint is publicly accessible');
    console.log('4. Check if there are any firewall/network issues');
  }
}

// Run the test
testWebhookEndpoint(); 