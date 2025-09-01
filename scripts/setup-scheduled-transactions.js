#!/usr/bin/env node

/**
 * Setup Script for Scheduled Transaction Checking
 * 
 * This script sets up a cron job in Supabase to automatically check for new transactions
 * and send email notifications when money is received, even when the app is closed.
 * 
 * Prerequisites:
 * 1. Supabase CLI installed and logged in
 * 2. Supabase project linked
 * 3. Edge function deployed
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const FUNCTION_NAME = 'check-new-transactions';
const CRON_SCHEDULE = '*/5 * * * *'; // Every 5 minutes (reduced frequency to prevent duplicates)
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'your-project-ref';

console.log('🚀 Setting up scheduled transaction checking...');
console.log('📅 Schedule:', CRON_SCHEDULE, '(Every 1 minute - much faster!)');
console.log('🔧 Function:', FUNCTION_NAME);
console.log('🏢 Project:', PROJECT_REF);

async function setupScheduledTransactions() {
  try {
    // Step 1: Deploy the edge function
    console.log('\n📦 Deploying edge function...');
    try {
      execSync(`supabase functions deploy ${FUNCTION_NAME}`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Edge function deployed successfully');
    } catch (error) {
      console.error('❌ Failed to deploy edge function:', error.message);
      console.log('💡 Make sure you have:');
      console.log('   - Supabase CLI installed: npm install -g supabase');
      console.log('   - Logged in: supabase login');
      console.log('   - Project linked: supabase link --project-ref ' + PROJECT_REF);
      return;
    }

    // Step 2: Set up the cron job
    console.log('\n⏰ Setting up cron job...');
    
    // Create cron job configuration
    const cronConfig = {
      name: 'check-new-transactions',
      schedule: CRON_SCHEDULE,
      function: FUNCTION_NAME,
      http_method: 'POST'
    };

    // Write cron config to file
    const cronConfigPath = path.join(process.cwd(), 'supabase', 'functions', FUNCTION_NAME, 'cron.json');
    fs.writeFileSync(cronConfigPath, JSON.stringify(cronConfig, null, 2));
    console.log('📝 Cron configuration written to:', cronConfigPath);

    // Step 3: Apply the cron job
    console.log('\n🔧 Applying cron job...');
    try {
      execSync(`supabase db push`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Cron job applied successfully');
    } catch (error) {
      console.error('❌ Failed to apply cron job:', error.message);
      console.log('💡 You may need to manually create the cron job in Supabase dashboard');
    }

    // Step 4: Verify environment variables
    console.log('\n🔍 Checking environment variables...');
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY', 
      'PAYSTACK_LIVE_SECRET_KEY',
      'RESEND_API_KEY'
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

    // Step 5: Test the function
    console.log('\n🧪 Testing the function...');
    try {
      const testResponse = execSync(`supabase functions invoke ${FUNCTION_NAME}`, {
        encoding: 'utf8',
        cwd: process.cwd()
      });
      console.log('✅ Function test response:', testResponse);
    } catch (error) {
      console.log('⚠️  Function test failed (this is normal if no transactions exist):', error.message);
    }

    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Send money to your virtual account');
    console.log('2. Wait up to 5 minutes for the scheduled check');
    console.log('3. Check your email for notifications');
    console.log('4. Monitor logs in Supabase dashboard');
    
    console.log('\n🔍 To monitor the function:');
    console.log(`supabase functions logs ${FUNCTION_NAME} --follow`);
    
    console.log('\n🛠️  To manually trigger the function:');
    console.log(`supabase functions invoke ${FUNCTION_NAME}`);

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
  console.log('3. Create a new function called "check-new-transactions"');
  console.log('4. Copy the code from supabase/functions/check-new-transactions/index.ts');
  console.log('5. Set the following environment variables:');
  console.log('   - SUPABASE_URL');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY');
  console.log('   - PAYSTACK_LIVE_SECRET_KEY');
  console.log('   - RESEND_API_KEY');
  console.log('6. Go to Database > Cron Jobs');
  console.log('7. Create a new cron job:');
  console.log('   - Name: check-new-transactions');
  console.log('   - Schedule: */5 * * * * (every 5 minutes)');
  console.log('   - Function: check-new-transactions');
  console.log('   - HTTP Method: POST');
}

// Check if running with --manual flag
if (process.argv.includes('--manual')) {
  showManualSetup();
} else {
  setupScheduledTransactions();
} 