#!/usr/bin/env node

/**
 * Test Webhook Email Functionality
 * 
 * This script tests the webhook email functionality by:
 * 1. Simulating a webhook call
 * 2. Testing email sending
 * 3. Verifying push notifications
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/api/paystack-webhook';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.log('Please set:');
  console.log('- EXPO_PUBLIC_SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testWebhookEmail() {
  console.log('🧪 Testing Webhook Email Functionality...\n');

  try {
    // Step 1: Get a test user
    console.log('1️⃣ Getting test user...');
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, email, first_name')
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.error('❌ No users found in database');
      return;
    }

    const testUser = users[0];
    console.log(`✅ Found test user: ${testUser.email} (${testUser.id})`);

    // Step 2: Get user's Paystack account
    console.log('\n2️⃣ Getting user Paystack account...');
    const { data: paystackAccount, error: accountError } = await supabase
      .from('paystack_accounts')
      .select('account_number, customer_code')
      .eq('user_id', testUser.id)
      .single();

    if (accountError || !paystackAccount) {
      console.error('❌ No Paystack account found for user');
      return;
    }

    console.log(`✅ Found Paystack account: ${paystackAccount.account_number}`);

    // Step 3: Simulate webhook payload
    console.log('\n3️⃣ Simulating webhook payload...');
    const webhookPayload = {
      event: 'charge.success',
      data: {
        reference: `TEST_${Date.now()}`,
        amount: 500000, // ₦5,000 in kobo
        metadata: {
          payment_type: 'virtual_account'
        },
        customer: {
          email: testUser.email
        },
        authorization: {
          account_number: paystackAccount.account_number
        }
      }
    };

    console.log('📦 Webhook payload:', JSON.stringify(webhookPayload, null, 2));

    // Step 4: Test webhook endpoint
    console.log('\n4️⃣ Testing webhook endpoint...');
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': 'test-signature' // This will fail verification but we can test the logic
        },
        body: JSON.stringify(webhookPayload)
      });

      const result = await response.text();
      console.log(`📡 Webhook response status: ${response.status}`);
      console.log(`📡 Webhook response: ${result}`);
    } catch (webhookError) {
      console.log('⚠️  Webhook test failed (expected if running locally):', webhookError.message);
    }

    // Step 5: Test direct email sending
    console.log('\n5️⃣ Testing direct email sending...');
    const { data: emailResult, error: emailError } = await supabase.rpc('send_test_email', {
      p_user_id: testUser.id,
      p_amount: 5000,
      p_reference: webhookPayload.data.reference,
      p_account_number: paystackAccount.account_number
    });

    if (emailError) {
      console.log('⚠️  Direct email test failed (function may not exist):', emailError.message);
    } else {
      console.log('✅ Direct email test result:', emailResult);
    }

    // Step 6: Test push notification
    console.log('\n6️⃣ Testing push notification...');
    const { data: pushResult, error: pushError } = await supabase.rpc('send_push_notification', {
      p_user_id: testUser.id,
      p_title: 'Test Notification',
      p_body: 'This is a test notification from the script',
      p_data: {
        type: 'test',
        test_id: Date.now().toString()
      }
    });

    if (pushError) {
      console.error('❌ Push notification test failed:', pushError);
    } else {
      console.log('✅ Push notification test result:', pushResult);
    }

    // Step 7: Check notification queue
    console.log('\n7️⃣ Checking notification queue...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

    const { data: queue, error: queueError } = await supabase
      .from('push_notification_queue')
      .select('*')
      .eq('user_id', testUser.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (queueError) {
      console.error('❌ Error checking notification queue:', queueError);
    } else {
      console.log(`✅ Found ${queue.length} notifications in queue:`);
      queue.forEach(notification => {
        console.log(`   - ID: ${notification.id}`);
        console.log(`   - Status: ${notification.status}`);
        console.log(`   - Title: ${notification.title}`);
        console.log(`   - Created: ${notification.created_at}`);
      });
    }

    console.log('\n🎉 Webhook email test completed!');
    console.log('\n📋 Test Summary:');
    console.log(`- Test User: ${testUser.email}`);
    console.log(`- Paystack Account: ${paystackAccount.account_number}`);
    console.log(`- Test Reference: ${webhookPayload.data.reference}`);
    console.log(`- Test Amount: ₦${webhookPayload.data.amount / 100}`);
    console.log('\n📧 Check your email for the test notification');
    console.log('📱 Check your device for push notifications');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testWebhookEmail(); 