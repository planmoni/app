// Test script for Paystack webhook - Simulates money being sent to virtual account
// Run this script to test the webhook functionality

const crypto = require('crypto');

// Configuration - Update these values
const WEBHOOK_URL = 'http://localhost:3000/api/paystack-webhook'; // Update with your actual webhook URL
const WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || 'test_secret';
const USER_EMAIL = 'test@example.com'; // Update with actual user email
const VIRTUAL_ACCOUNT_NUMBER = '0123456789'; // Update with actual virtual account number

// Test webhook payload for successful charge (money sent to virtual account)
const testPayload = {
  event: 'charge.success',
  data: {
    id: 123456789,
    domain: 'test',
    amount: 500000, // 5000 Naira in kobo
    currency: 'NGN',
    source: 'bank',
    reason: 'Test payment',
    recipient: 0,
    status: 'success',
    paid_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    metadata: {
      custom_fields: [],
      referrer: 'test'
    },
    reference: 'TEST_REF_' + Date.now(),
    fees_breakdown: null,
    customer: {
      id: 123456,
      first_name: 'Test',
      last_name: 'User',
      email: USER_EMAIL,
      customer_code: 'CUS_' + Date.now(),
      phone: '+2347034000000',
      metadata: null,
      risk_action: 'default'
    },
    authorization: {
      authorization_code: 'AUTH_' + Date.now(),
      bin: '408408',
      last4: '4081',
      exp_month: '12',
      exp_year: '2030',
      channel: 'card',
      card_type: 'visa',
      bank: 'TEST BANK',
      country_code: 'NG',
      brand: 'visa',
      reusable: true,
      signature: 'SIG_' + Date.now(),
      account_name: 'Test User',
      account_number: VIRTUAL_ACCOUNT_NUMBER,
      bank_code: '044'
    },
    plan: null,
    split: {},
    order_id: null,
    paidAt: new Date().toISOString(),
    requested_amount: 500000,
    pos_transaction_data: null,
    source_details: null,
    fees_breakdown: null,
    transaction_date: new Date().toISOString(),
    plan_object: {},
    subaccount: {}
  }
};

// Function to verify webhook signature
function generateWebhookSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha512', secret)
    .update(payload, 'utf8')
    .digest('hex');
}

// Function to test the webhook
async function testWebhook() {
  try {
    console.log('🧪 Testing Paystack webhook...');
    console.log('📧 User Email:', USER_EMAIL);
    console.log('🏦 Virtual Account:', VIRTUAL_ACCOUNT_NUMBER);
    console.log('💰 Amount:', testPayload.data.amount / 100, 'NGN');
    
    const payloadString = JSON.stringify(testPayload);
    const signature = generateWebhookSignature(payloadString, WEBHOOK_SECRET);
    
    console.log('🔐 Generated signature:', signature);
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Paystack-Signature': signature,
        'User-Agent': 'Paystack-Webhook/1.0'
      },
      body: payloadString
    });
    
    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📡 Response body:', responseText);
    
    if (response.ok) {
      console.log('✅ Webhook test successful!');
      console.log('💡 Check your app to see if the balance was updated.');
    } else {
      console.log('❌ Webhook test failed!');
      console.log('🔍 Check the response for error details.');
    }
    
  } catch (error) {
    console.error('💥 Error testing webhook:', error);
  }
}

// Function to test different webhook events
async function testDifferentEvents() {
  console.log('\n🎯 Testing different webhook events...\n');
  
  // Test 1: Virtual account assigned
  console.log('1️⃣ Testing virtual account assignment...');
  const accountAssignedPayload = {
    event: 'dedicated_account.assigned',
    data: {
      customer: {
        id: 123456,
        email: USER_EMAIL,
        customer_code: 'CUS_' + Date.now()
      },
      dedicated_account: {
        id: 123456,
        account_number: VIRTUAL_ACCOUNT_NUMBER,
        account_name: 'Test User',
        bank_id: 1,
        bank_name: 'TEST BANK',
        customer: 123456,
        assigned: true,
        assignment: {
          assignee_id: 123456,
          assignee_type: 'Customer',
          account_type: 'PAY_WITH_BANK_TRANSFER',
          assigned_at: new Date().toISOString(),
          expired: false
        }
      }
    }
  };
  
  // Test 2: Transfer success
  console.log('2️⃣ Testing transfer success...');
  const transferSuccessPayload = {
    event: 'transfer.success',
    data: {
      domain: 'test',
      amount: 100000, // 1000 Naira
      currency: 'NGN',
      source: 'balance',
      reason: 'Test transfer',
      recipient: 123456,
      status: 'success',
      transfer_code: 'TRF_' + Date.now(),
      id: 123456,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };
  
  // You can add more test cases here
  console.log('✅ Test cases defined. Run individual tests as needed.');
}

// Main execution
if (require.main === module) {
  console.log('🚀 Starting Paystack webhook tests...\n');
  
  // Check if environment is set up
  if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'test_secret') {
    console.log('⚠️  Warning: Using test secret. Set PAYSTACK_WEBHOOK_SECRET for production.');
  }
  
  if (WEBHOOK_URL.includes('localhost')) {
    console.log('⚠️  Warning: Using localhost URL. Update WEBHOOK_URL for production.');
  }
  
  // Run the main test
  testWebhook();
  
  // Show available test events
  setTimeout(() => {
    testDifferentEvents();
  }, 2000);
}

module.exports = {
  testWebhook,
  testDifferentEvents,
  generateWebhookSignature
}; 