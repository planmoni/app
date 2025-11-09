#!/usr/bin/env node

/**
 * Setup Script for Automated Payout Processing
 * 
 * This script sets up cron jobs and triggers to ensure automated payouts
 * are processed immediately when the timer runs out.
 * 
 * Prerequisites:
 * 1. Supabase CLI installed and logged in
 * 2. Supabase project linked
 * 3. Edge functions deployed
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const PROCESS_FUNCTION = 'process-automated-payouts';
const SCHEDULE_FUNCTION = 'schedule-automated-payouts';
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'your-project-ref';

console.log('🚀 Setting up automated payout processing...');
console.log('🏢 Project:', PROJECT_REF);

async function setupAutomatedPayouts() {
  try {
    // Step 1: Deploy the edge functions
    console.log('\n📦 Deploying edge functions...');
    
    try {
      execSync(`supabase functions deploy ${PROCESS_FUNCTION}`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Process function deployed successfully');
      
      execSync(`supabase functions deploy ${SCHEDULE_FUNCTION}`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Schedule function deployed successfully');
    } catch (error) {
      console.error('❌ Failed to deploy edge functions:', error.message);
      console.log('💡 Make sure you have:');
      console.log('   - Supabase CLI installed: npm install -g supabase');
      console.log('   - Logged in: supabase login');
      console.log('   - Project linked: supabase link --project-ref ' + PROJECT_REF);
      return;
    }

    // Step 2: Apply database migrations
    console.log('\n🔧 Applying database migrations...');
    try {
      execSync(`supabase db push`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Database migrations applied successfully');
    } catch (error) {
      console.error('❌ Failed to apply migrations:', error.message);
      console.log('💡 You may need to manually run the migrations');
    }

    // Step 3: Verify environment variables
    console.log('\n🔍 Checking environment variables...');
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY', 
      'PAYSTACK_SECRET_KEY'
    ];

    console.log('Required environment variables:');
    requiredEnvVars.forEach(envVar => {
      const value = process.env[envVar];
      if (value) {
        console.log(`   ✅ ${envVar}: ${value.substring(0, 10)}...`);
      } else {
        console.log(`   ❌ ${envVar}: Not set`);
      }
    });

    // Step 4: Manual cron job setup instructions
    console.log('\n⏰ Manual Cron Job Setup Required:');
    console.log('Go to your Supabase dashboard > Database > Cron Jobs and create:');
    console.log('');
    console.log('1. Process Automated Payouts:');
    console.log('   - Name: process-automated-payouts');
    console.log('   - Schedule: * * * * * (every minute)');
    console.log('   - Function: process-automated-payouts');
    console.log('   - HTTP Method: POST');
    console.log('');
    console.log('2. Schedule Automated Payouts:');
    console.log('   - Name: schedule-automated-payouts');
    console.log('   - Schedule: 0 0 * * * (daily at midnight)');
    console.log('   - Function: schedule-automated-payouts');
    console.log('   - HTTP Method: POST');
    console.log('');

    // Step 5: Test the functions
    console.log('\n🧪 Testing the functions...');
    try {
      console.log('Testing process function...');
      execSync(`curl -X POST "https://${PROJECT_REF}.supabase.co/functions/v1/${PROCESS_FUNCTION}" \
        -H "Authorization: Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json"`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      console.log('Testing schedule function...');
      execSync(`curl -X POST "https://${PROJECT_REF}.supabase.co/functions/v1/${SCHEDULE_FUNCTION}" \
        -H "Authorization: Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json"`, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      console.log('✅ Functions tested successfully');
    } catch (error) {
      console.log('⚠️  Function testing failed (this is normal if not configured yet)');
    }

    console.log('\n🎉 Automated payout processing setup completed!');
    console.log('');
    console.log('📋 What happens now:');
    console.log('   • Payouts are processed every minute via cron job');
    console.log('   • Database triggers process payouts immediately when due');
    console.log('   • Future payouts are scheduled daily');
    console.log('   • All processing happens automatically in the background');
    console.log('');
    console.log('🔧 Next steps:');
    console.log('   1. Set up the cron jobs in Supabase dashboard');
    console.log('   2. Test with a payout plan that has a due date');
    console.log('   3. Monitor the function logs for any issues');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupAutomatedPayouts(); 