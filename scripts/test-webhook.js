// Test script for Paystack webhook
// Run this script to test the webhook functionality

const crypto = require('crypto');

// Configuration
const WEBHOOK_URL = 'http://localhost:3000/api/paystack-webhook';
const WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || 'test_secret';

// Test webhook payloads
const testPayloads = {
  chargeSuccess: {
    event: 'charge.success',
    data: {
      reference: 'TEST_REF_' + Date.now(),
      amount: 500000, // 5000 Naira in kobo
      metadata: {
        custom_fields: []
      },
      customer: {
        email: 'test@example.com'
      },
      authorization: {
        account_number: '0123456789' // Replace with actual test account number
      }
    }
  },
  
  dedicatedAccountAssigned: {
    event: 'dedicated_account.assigned',
    data: {
      customer: {
        customer_code: 'CUS_TEST123'
      },
      account_number: '0123456789',
      account_name: 'Test User',
      bank: {
        name: 'Test Bank'
      }
    }
  }
};

// Function to generate webhook signature
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

// Function to test webhook
async function testWebhook(payload) {
  const signature = generateSignature(payload, WEBHOOK_SECRET);
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': signature
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    console.log('Webhook Response:', {
      status: response.status,
      statusText: response.statusText,
      data: result
    });

    return response.ok;
  } catch (error) {
    console.error('Webhook test failed:', error);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Testing Paystack Webhook...\n');

  // Test charge.success webhook
  console.log('1. Testing charge.success webhook...');
  const chargeSuccess = await testWebhook(testPayloads.chargeSuccess);
  console.log(`   Result: ${chargeSuccess ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test dedicated_account.assigned webhook
  console.log('2. Testing dedicated_account.assigned webhook...');
  const accountAssigned = await testWebhook(testPayloads.dedicatedAccountAssigned);
  console.log(`   Result: ${accountAssigned ? '✅ PASS' : '❌ FAIL'}\n`);

  // Test invalid signature
  console.log('3. Testing invalid signature...');
  const invalidSignature = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paystack-signature': 'invalid_signature'
    },
    body: JSON.stringify(testPayloads.chargeSuccess)
  });
  console.log(`   Result: ${invalidSignature.status === 401 ? '✅ PASS' : '❌ FAIL'} (Expected 401)\n`);

  console.log('🎉 Webhook tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testWebhook, generateSignature }; 