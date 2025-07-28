#!/usr/bin/env node

/**
 * Test Push Notifications
 * 
 * This script tests the push notification system by:
 * 1. Checking if FCM tokens are stored
 * 2. Testing the send-push-notifications edge function
 * 3. Verifying the notification queue
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

async function testNotifications() {
  console.log('🧪 Testing Push Notification System...\n');

  try {
    // Step 1: Check if users have FCM tokens
    console.log('1️⃣ Checking FCM tokens...');
    const { data: fcmTokens, error: fcmError } = await supabase
      .from('user_fcm_tokens')
      .select('user_id, fcm_token, platform, updated_at')
      .limit(5);

    if (fcmError) {
      console.error('❌ Error fetching FCM tokens:', fcmError);
      return;
    }

    if (!fcmTokens || fcmTokens.length === 0) {
      console.log('⚠️  No FCM tokens found in database');
      console.log('   Make sure to run the app on a physical device and log in');
      return;
    }

    console.log(`✅ Found ${fcmTokens.length} FCM tokens:`);
    fcmTokens.forEach(token => {
      console.log(`   - User: ${token.user_id}`);
      console.log(`   - Platform: ${token.platform}`);
      console.log(`   - Updated: ${token.updated_at}`);
    });

    // Step 2: Check notification queue
    console.log('\n2️⃣ Checking notification queue...');
    const { data: queue, error: queueError } = await supabase
      .from('push_notification_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (queueError) {
      console.error('❌ Error fetching notification queue:', queueError);
      return;
    }

    console.log(`✅ Found ${queue.length} notifications in queue:`);
    queue.forEach(notification => {
      console.log(`   - ID: ${notification.id}`);
      console.log(`   - Status: ${notification.status}`);
      console.log(`   - Title: ${notification.title}`);
      console.log(`   - Created: ${notification.created_at}`);
    });

    // Step 3: Test sending a notification
    console.log('\n3️⃣ Testing notification sending...');
    const testUserId = fcmTokens[0].user_id;
    
    const { data: testResult, error: testError } = await supabase.rpc('send_push_notification', {
      p_user_id: testUserId,
      p_title: 'Test Notification',
      p_body: 'This is a test notification from the script',
      p_data: {
        type: 'test',
        test_id: Date.now().toString()
      }
    });

    if (testError) {
      console.error('❌ Error sending test notification:', testError);
      return;
    }

    console.log(`✅ Test notification sent: ${testResult}`);

    // Step 4: Check if notification was queued
    console.log('\n4️⃣ Verifying notification was queued...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

    const { data: newQueue, error: newQueueError } = await supabase
      .from('push_notification_queue')
      .select('*')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (newQueueError) {
      console.error('❌ Error checking new notification:', newQueueError);
      return;
    }

    if (newQueue && newQueue.length > 0) {
      console.log('✅ Test notification was queued successfully');
      console.log(`   - Queue ID: ${newQueue[0].id}`);
      console.log(`   - Status: ${newQueue[0].status}`);
    } else {
      console.log('⚠️  Test notification was not queued');
    }

    // Step 5: Test edge function
    console.log('\n5️⃣ Testing send-push-notifications edge function...');
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notifications`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Edge function executed successfully');
        console.log('   Result:', result);
      } else {
        console.error('❌ Edge function failed:', result);
      }
    } catch (edgeError) {
      console.error('❌ Error calling edge function:', edgeError.message);
    }

    console.log('\n🎉 Notification system test completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Make sure your app is running on a physical device');
    console.log('2. Log in to the app to register FCM token');
    console.log('3. Send money to your account to test real notifications');
    console.log('4. Check device notifications');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testNotifications(); 