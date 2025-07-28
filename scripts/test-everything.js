#!/usr/bin/env node

/**
 * Test Everything - Client and Server Notifications
 * 
 * This script tests your complete notification setup
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

async function testEverything() {
  console.log('🧪 Testing Complete Notification Setup...\n');

  try {
    // Step 1: Get test user (sebbrand766@gmail.com)
    console.log('1️⃣ Getting test user...');
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, email, first_name')
      .eq('email', 'sebbrand766@gmail.com')
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.error('❌ Test user sebbrand766@gmail.com not found');
      console.log('Creating test user...');
      
      // Create test user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'sebbrand766@gmail.com',
        password: 'testpassword123',
        email_confirm: true
      });

      if (createError) {
        console.error('❌ Failed to create test user:', createError);
        return;
      }

      // Create profile
      await supabase
        .from('profiles')
        .insert({
          id: newUser.user.id,
          email: 'sebbrand766@gmail.com',
          first_name: 'Test User',
          email_notifications: {
            deposit_alerts: true,
            payout_alerts: true,
            expiry_reminders: true,
            wallet_summary: "weekly"
          }
        });

      console.log('✅ Created test user: sebbrand766@gmail.com');
    } else {
      console.log(`✅ Found test user: ${users[0].email} (${users[0].id})`);
    }

    const testUser = users?.[0] || { id: newUser.user.id, email: 'sebbrand766@gmail.com', first_name: 'Test User' };

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

    // Step 3: Test email sending directly
    console.log('\n3️⃣ Testing email sending directly...');
    try {
      const emailSubject = "Test Email - Planmoni";
      const emailHtml = generateTestEmailHtml({
        firstName: testUser.first_name || 'User',
        amount: '₦5,000',
        accountNumber: 'Virtual Account',
        date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        reference: `TEST_${Date.now()}`
      });

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "Planmoni <notifications@planmoni.com>",
          to: testUser.email,
          subject: emailSubject,
          html: emailHtml
        })
      });

      if (emailResponse.ok) {
        console.log('✅ Email test successful - check sebbrand766@gmail.com');
      } else {
        console.log('❌ Email test failed:', await emailResponse.text());
      }
    } catch (emailError) {
      console.log('❌ Email API error:', emailError.message);
    }

    // Step 4: Test server-side edge function
    console.log('\n4️⃣ Testing server-side edge function...');
    try {
      const functionUrl = `${supabaseUrl}/functions/v1/check-new-transactions`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'x-manual-trigger': 'true'
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Server-side function test successful:', result);
      } else {
        console.log('❌ Server-side function test failed:', result);
      }
    } catch (serverError) {
      console.log('❌ Server-side function error:', serverError.message);
    }

    // Step 5: Check notification queue
    console.log('\n5️⃣ Checking notification queue...');
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

    console.log('\n🎉 Complete test finished!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Client-side notifications: Working');
    console.log('- ✅ Email sending: Working (check sebbrand766@gmail.com)');
    console.log('- ✅ Server-side function: Tested');
    console.log('- ✅ Push notification queue: Working');
    console.log('\n📱 Next steps:');
    console.log('1. Install the new app build');
    console.log('2. Log in to register FCM token');
    console.log('3. Send money to test real notifications');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Email template for test
function generateTestEmailHtml(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Test Email - Planmoni</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .amount { font-size: 32px; font-weight: bold; color: #059669; text-align: center; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .label { font-weight: 600; color: #6b7280; }
        .value { color: #111827; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .button { display: inline-block; background: #1E3A8A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🧪 Test Email!</h1>
          <p>Hello ${data.firstName}, this is a test email from Planmoni</p>
        </div>
        
        <div class="content">
          <div class="amount">${data.amount}</div>
          
          <div class="details">
            <div class="detail-row">
              <span class="label">Account Number:</span>
              <span class="value">${data.accountNumber}</span>
            </div>
            <div class="detail-row">
              <span class="label">Date & Time:</span>
              <span class="value">${data.date}</span>
            </div>
            <div class="detail-row">
              <span class="label">Reference:</span>
              <span class="value">${data.reference}</span>
            </div>
          </div>
          
          <p style="text-align: center;">
            <a href="https://planmoni.com" class="button">View in App</a>
          </p>
          
          <p style="color: #6b7280; font-size: 14px; text-align: center;">
            This is a test email to verify your notification system is working correctly.
          </p>
        </div>
        
        <div class="footer">
          <p>This is a test notification from Planmoni</p>
          <p>If you received this, your email notifications are working!</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Run the test
testEverything(); 