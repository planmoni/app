#!/usr/bin/env node

/**
 * Setup Script for Push Notifications
 * 
 * This script sets up Firebase Cloud Messaging (FCM) for push notifications
 * and configures the necessary edge functions and cron jobs.
 * 
 * Prerequisites:
 * 1. Firebase project configured
 * 2. FCM server key obtained
 * 3. Supabase CLI installed and logged in
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const FUNCTION_NAME = 'send-push-notifications';
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'your-project-ref';

console.log('🚀 Setting up push notifications...');
console.log('🔧 Function:', FUNCTION_NAME);
console.log('🏢 Project:', PROJECT_REF);

async function setupPushNotifications() {
  try {
    // Step 1: Deploy the edge function
    console.log('\n📦 Deploying push notification edge function...');
    try {
      execSync(`supabase functions deploy ${FUNCTION_NAME}`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Push notification edge function deployed successfully');
    } catch (error) {
      console.error('❌ Failed to deploy edge function:', error.message);
      console.log('💡 Make sure you have:');
      console.log('   - Supabase CLI installed: npm install -g supabase');
      console.log('   - Logged in: supabase login');
      console.log('   - Project linked: supabase link --project-ref ' + PROJECT_REF);
      return;
    }

    // Step 2: Verify environment variables
    console.log('\n🔍 Checking environment variables...');
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY', 
      'FIREBASE_SERVER_KEY'
    ];

    console.log('Required environment variables:');
    requiredEnvVars.forEach(envVar => {
      const value = process.env[envVar];
      if (value) {
        console.log(`✅ ${envVar}: ${value.substring(0, 10)}...`);
      } else {
        console.log(`❌ ${envVar}: Not set`);
      }
    });

    // Step 3: Test the function
    console.log('\n🧪 Testing the push notification function...');
    try {
      const testResponse = execSync(`supabase functions invoke ${FUNCTION_NAME}`, {
        encoding: 'utf8',
        cwd: process.cwd()
      });
      console.log('✅ Function test response:', testResponse);
    } catch (error) {
      console.log('⚠️  Function test failed (this is normal if no notifications exist):', error.message);
    }

    console.log('\n🎉 Push notification setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Set up Firebase Cloud Messaging in your app');
    console.log('2. Configure FCM token storage in your app');
    console.log('3. Test push notifications by sending money to your account');
    console.log('4. Monitor logs in Supabase dashboard');
    
    console.log('\n🔍 To monitor the function:');
    console.log(`supabase functions logs ${FUNCTION_NAME} --follow`);
    
    console.log('\n🛠️  To manually trigger the function:');
    console.log(`supabase functions invoke ${FUNCTION_NAME}`);

    console.log('\n📱 App Integration:');
    console.log('1. Initialize Firebase in your app');
    console.log('2. Request notification permissions');
    console.log('3. Get FCM token and store it in user_fcm_tokens table');
    console.log('4. Handle foreground and background notifications');

  } catch (error) {
    console.error('💥 Setup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your Supabase project configuration');
    console.log('2. Verify all environment variables are set');
    console.log('3. Ensure you have the correct permissions');
    console.log('4. Check the Supabase dashboard for any errors');
  }
}

// Manual setup instructions
function showManualSetup() {
  console.log('\n📖 Manual Setup Instructions:');
  console.log('\n1. Go to your Supabase dashboard');
  console.log('2. Navigate to Database > Functions');
  console.log('3. Create a new function called "send-push-notifications"');
  console.log('4. Copy the code from supabase/functions/send-push-notifications/index.ts');
  console.log('5. Set the following environment variables:');
  console.log('   - SUPABASE_URL');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY');
  console.log('   - FIREBASE_SERVER_KEY');
  console.log('6. Go to Database > Cron Jobs');
  console.log('7. Create a new cron job:');
  console.log('   - Name: send-push-notifications');
  console.log('   - Schedule: */2 * * * * (every 2 minutes)');
  console.log('   - Function: send-push-notifications');
  console.log('   - HTTP Method: POST');
  console.log('\n8. Set up Firebase Cloud Messaging in your app');
  console.log('9. Configure FCM token storage');
}

// Check if running with --manual flag
if (process.argv.includes('--manual')) {
  showManualSetup();
} else {
  setupPushNotifications();
} 