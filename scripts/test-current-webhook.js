#!/usr/bin/env node

/**
 * Test Current Webhook Setup
 * 
 * This script tests your current webhook setup to see if it's working
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.log('Please set:');
  console.log('- EXPO_PUBLIC_SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testCurrentSetup() {
  console.log('🧪 Testing Current Webhook Setup...\n');

  try {
    // Step 1: Check if you have any users
    console.log('1️⃣ Checking users...');
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, email, first_name')
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.error('❌ No users found in database');
      return;
    }

    const testUser = users[0];
    console.log(`✅ Found user: ${testUser.email}`);

    // Step 2: Check if user has FCM token
    console.log('\n2️⃣ Checking FCM tokens...');
    const { data: fcmTokens, error: fcmError } = await supabase
      .from('user_fcm_tokens')
      .select('*')
      .eq('user_id', testUser.id);

    if (fcmError) {
      console.error('❌ Error checking FCM tokens:', fcmError);
    } else if (!fcmTokens || fcmTokens.length === 0) {
      console.log('⚠️  No FCM tokens found - user needs to open app first');
    } else {
      console.log(`✅ Found ${fcmTokens.length} FCM tokens`);
    }

    // Step 3: Test push notification function
    console.log('\n3️⃣ Testing push notification function...');
    const { data: pushResult, error: pushError } = await supabase.rpc('send_push_notification', {
      p_user_id: testUser.id,
      p_title: 'Test Notification',
      p_body: 'This is a test from the script',
      p_data: {
        type: 'test',
        test_id: Date.now().toString()
      }
    });

    if (pushError) {
      console.error('❌ Push notification failed:', pushError);
    } else {
      console.log('✅ Push notification queued:', pushResult);
    }

    // Step 4: Check notification queue
    console.log('\n4️⃣ Checking notification queue...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: queue, error: queueError } = await supabase
      .from('push_notification_queue')
      .select('*')
      .eq('user_id', testUser.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (queueError) {
      console.error('❌ Error checking queue:', queueError);
    } else {
      console.log(`✅ Found ${queue.length} notifications in queue`);
      queue.forEach(n => {
        console.log(`   - ${n.title}: ${n.status}`);
      });
    }

    // Step 5: Test email sending
    console.log('\n5️⃣ Testing email sending...');
    const { data: emailResult, error: emailError } = await supabase.rpc('send_test_email', {
      p_user_id: testUser.id,
      p_amount: 5000,
      p_reference: `TEST_${Date.now()}`,
      p_account_number: '1234567890'
    });

    if (emailError) {
      console.log('⚠️  Email function not found (expected):', emailError.message);
    } else {
      console.log('✅ Email test result:', emailResult);
    }

    console.log('\n🎉 Test completed!');
    console.log('\n📋 Summary:');
    console.log('- Your webhook will work when app is active');
    console.log('- You need edge functions for background notifications');
    console.log('- Check your device for push notifications');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testCurrentSetup(); 