require('dotenv').config();
const fetch = require('node-fetch');

// Simple test script to check if the USSD API endpoint is working
const PAYSTACK_API_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY;
const TEST_AMOUNT = '1000'; // 1000 Naira
const TEST_BANK_CODE = '058'; // GTBank
const TEST_EMAIL = 'test@example.com';

// Test data
const testData = {
  email: TEST_EMAIL,
  amount: (parseInt(TEST_AMOUNT) * 100).toString(), // Convert to kobo
  ussd: {
    type: '737' // GTBank USSD type
  },
  metadata: {
    user_id: 'test_user_123',
    payment_type: 'ussd',
    bank_code: TEST_BANK_CODE,
    phone: '',
    reference: `test_ussd_${Date.now()}`
  }
};

async function testPaystackUSSD() {
  console.log('🧪 Testing Paystack USSD API Directly');
  console.log('=====================================');
  
  if (!PAYSTACK_SECRET_KEY) {
    console.error('❌ Paystack secret key not found in environment variables');
    console.log('Please set EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY in your .env file');
    return;
  }
  
  try {
    // Test 1: Initialize USSD Payment
    console.log('\n1️⃣ Testing USSD Payment Initialization...');
    console.log('Request data:', JSON.stringify(testData, null, 2));
    
    const initResponse = await fetch(`${PAYSTACK_API_URL}/charge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    console.log('Response status:', initResponse.status);
    console.log('Response headers:', Object.fromEntries(initResponse.headers.entries()));

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error('❌ Initialization failed:', errorText);
      return;
    }

    const initData = await initResponse.json();
    console.log('✅ Initialization successful:', JSON.stringify(initData, null, 2));

    // Test 2: Verify Payment Status
    if (initData.data?.reference) {
      console.log('\n2️⃣ Testing Payment Verification...');
      console.log('Reference:', initData.data.reference);
      
      const verifyResponse = await fetch(`${PAYSTACK_API_URL}/charge/${initData.data.reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Verification response status:', verifyResponse.status);

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        console.error('❌ Verification failed:', errorText);
        return;
      }

      const verifyData = await verifyResponse.json();
      console.log('✅ Verification response:', JSON.stringify(verifyData, null, 2));
    }

    // Test 3: Test with invalid USSD type
    console.log('\n3️⃣ Testing with invalid USSD type...');
    const invalidData = {
      ...testData,
      ussd: {
        type: '999' // Invalid USSD type
      }
    };

    const invalidResponse = await fetch(`${PAYSTACK_API_URL}/charge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invalidData)
    });

    console.log('Invalid USSD type response status:', invalidResponse.status);
    const invalidResponseData = await invalidResponse.json();
    console.log('Invalid USSD type response:', JSON.stringify(invalidResponseData, null, 2));

    // Test 4: Test with missing required fields
    console.log('\n4️⃣ Testing with missing required fields...');
    const missingData = {
      email: TEST_EMAIL
      // Missing amount and ussd
    };

    const missingResponse = await fetch(`${PAYSTACK_API_URL}/charge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(missingData)
    });

    console.log('Missing fields response status:', missingResponse.status);
    const missingResponseData = await missingResponse.json();
    console.log('Missing fields response:', JSON.stringify(missingResponseData, null, 2));

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testPaystackUSSD(); 