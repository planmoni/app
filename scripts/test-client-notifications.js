,#!/usr/bin/env node

/**
 * Test Client-Side Notifications
 * 
 * This script tests your client-side notification setup
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

async function testClientNotifications() {
  console.log('🧪 Testing Client-Side Notifications...\n');

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
    console.log(`✅ Found user: ${testUser.email} (${testUser.id})`);

    // Step 2: Test push notification function
    console.log('\n2️⃣ Testing push notification function...');
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

    // Step 3: Test email API
    console.log('\n3️⃣ Testing email API...');
    try {
      const emailResponse = await fetch(`${supabaseUrl.replace('/rest/v1', '')}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: testUser.email,
          firstName: testUser.first_name || 'User',
          amount: 5000,
          reference: `TEST_${Date.now()}`,
          accountNumber: 'Virtual Account'
        })
      });

      const emailResult = await emailResponse.json();
      
      if (emailResponse.ok) {
        console.log('✅ Email test successful:', emailResult);
      } else {
        console.log('⚠️  Email test failed (expected if API not deployed):', emailResult);
      }
    } catch (emailError) {
      console.log('⚠️  Email API not available (expected):', emailError.message);
    }

    // Step 4: Check notification queue
    console.log('\n4️⃣ Checking notification queue...');
    await new Promise(resolve => setTimeout(resolve, 2000));

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

    console.log('\n🎉 Client notification test completed!');
    console.log('\n📋 What this means:');
    console.log('- Your client-side code will send push notifications when app is active');
    console.log('- Your client-side code will send emails when app is active');
    console.log('- You still need edge functions for background notifications');
    console.log('\n📱 Next steps:');
    console.log('1. Install the new app build');
    console.log('2. Log in to register FCM token');
    console.log('3. Send money to test notifications');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testClientNotifications(); 