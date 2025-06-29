#!/usr/bin/env node

/**
 * Test script for Paystack Card Payment Integration (Direct API)
 * 
 * This script tests the card payment integration using direct Paystack API calls
 * instead of custom API endpoints.
 */

const PAYSTACK_SECRET_KEY = process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY;

async function testCardPayment() {
  console.log('🧪 Testing Paystack Card Payment Integration (Direct API)\n');

  // Check if Paystack secret key is available
  if (!PAYSTACK_SECRET_KEY) {
    console.error('❌ EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY not found in environment variables');
    console.log('Please set the Paystack secret key in your .env file');
    return;
  }

  console.log('✅ Paystack secret key available');
  console.log('🔑 Key prefix:', PAYSTACK_SECRET_KEY.substring(0, 10) + '...');

  try {
    // Test 1: Initialize Card Payment
    console.log('\n1️⃣ Testing Card Payment Initialization...');
    
    const reference = `test_card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const paymentData = {
      email: 'test@example.com',
      amount: '10000', // ₦100 in kobo
      currency: 'NGN',
      reference: reference,
      callback_url: 'https://your-app.com/payment/callback',
      channels: ['card'],
      metadata: {
        user_id: 'test_user_id',
        payment_type: 'card_payment',
        save_card: true
      }
    };

    console.log('Request data:', JSON.stringify(paymentData, null, 2));

    const initResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });

    console.log('Response status:', initResponse.status);
    console.log('Response headers:', Object.fromEntries(initResponse.headers.entries()));

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error('❌ Payment initialization failed:', errorText);
      return;
    }

    const initData = await initResponse.json();
    console.log('✅ Payment initialization successful:', JSON.stringify(initData, null, 2));

    // Test 2: Verify Payment Status
    if (initData.data?.reference) {
      console.log('\n2️⃣ Testing Payment Verification...');
      console.log('Reference:', initData.data.reference);
      
      const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${initData.data.reference}`, {
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

    // Test 3: Check Authorization URL
    if (initData.data?.authorization_url) {
      console.log('\n3️⃣ Paystack Checkout URL Generated');
      console.log('Authorization URL:', initData.data.authorization_url);
      console.log('✅ Users can be redirected to Paystack Checkout');
    }

  } catch (error) {
    console.error('❌ Error testing card payment:', error.message);
  }

  console.log('\n🎉 Card payment integration test completed!');
}

async function testInvalidPayment() {
  console.log('\n🧪 Testing Invalid Payment Scenarios\n');

  const invalidScenarios = [
    {
      name: 'Missing Amount',
      data: {
        email: 'test@example.com',
        currency: 'NGN',
        reference: 'test_ref_1',
        channels: ['card']
      }
    },
    {
      name: 'Invalid Amount (Too Low)',
      data: {
        email: 'test@example.com',
        amount: '5000', // ₦50 in kobo (below minimum)
        currency: 'NGN',
        reference: 'test_ref_2',
        channels: ['card']
      }
    },
    {
      name: 'Missing Email',
      data: {
        amount: '10000',
        currency: 'NGN',
        reference: 'test_ref_3',
        channels: ['card']
      }
    },
    {
      name: 'Invalid Currency',
      data: {
        email: 'test@example.com',
        amount: '10000',
        currency: 'USD', // Not supported for card payments
        reference: 'test_ref_4',
        channels: ['card']
      }
    }
  ];

  for (const scenario of invalidScenarios) {
    console.log(`📋 Testing ${scenario.name}...`);

    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scenario.data)
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.log(`✅ ${scenario.name} correctly rejected:`, data.message);
      } else {
        console.log(`⚠️ ${scenario.name} unexpectedly succeeded:`, data);
      }

    } catch (error) {
      console.error(`❌ Error testing ${scenario.name}:`, error.message);
    }
  }
}

async function testPaymentVerification() {
  console.log('\n🧪 Testing Payment Verification\n');

  try {
    // Test with invalid reference
    const response = await fetch('https://api.paystack.co/transaction/verify/invalid_reference_123', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.log('✅ Invalid reference correctly rejected:', data.message);
    } else {
      console.log('⚠️ Invalid reference unexpectedly succeeded:', data);
    }

  } catch (error) {
    console.error('❌ Error testing payment verification:', error.message);
  }
}

async function testAuthentication() {
  console.log('\n🧪 Testing Authentication\n');

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header
      },
      body: JSON.stringify({
        email: 'test@example.com',
        amount: '10000',
        currency: 'NGN',
        reference: 'test_ref_auth',
        channels: ['card']
      })
    });

    if (response.status === 401) {
      console.log('✅ Authentication correctly required');
    } else {
      console.log('⚠️ Authentication not properly enforced');
    }

  } catch (error) {
    console.error('❌ Error testing authentication:', error.message);
  }
}

// Main test execution
async function runTests() {
  console.log('🚀 Starting Paystack Card Payment Integration Tests (Direct API)\n');

  try {
    await testAuthentication();
    await testCardPayment();
    await testInvalidPayment();
    await testPaymentVerification();
    
    console.log('\n✨ All tests completed!');
    console.log('\n📝 Note: This implementation uses direct Paystack API calls');
    console.log('📝 No custom API endpoints are used');
    console.log('📝 Paystack Checkout handles all card security');
    
  } catch (error) {
    console.error('💥 Test execution failed:', error);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testCardPayment,
  testInvalidPayment,
  testAuthentication,
  testPaymentVerification
}; 