#!/usr/bin/env node

/**
 * Debug Script for Scheduled Transaction Function
 * 
 * This script helps debug issues with the scheduled function by:
 * 1. Testing the function directly
 * 2. Checking environment variables
 * 3. Verifying the function is accessible
 * 4. Testing with different scenarios
 */

const fetch = require('node-fetch');
const path = require('path');

// Load environment variables from app.config.js
function loadExpoConfig() {
  try {
    const configPath = path.join(__dirname, '..', 'app.config.js');
    const config = require(configPath);
    return config.expo.extra || {};
  } catch (error) {
    console.log('Could not load app.config.js, using process.env');
    return {};
  }
}

const expoConfig = loadExpoConfig();

// Configuration - try Expo config first, then process.env
const SUPABASE_URL = expoConfig.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = expoConfig.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const PAYSTACK_SECRET_KEY = expoConfig.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY || process.env.PAYSTACK_LIVE_SECRET_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/check-new-transactions` : null;

console.log('🔍 Debugging scheduled transaction function...');
console.log('🔗 Supabase URL:', SUPABASE_URL);
console.log('🔑 Anon Key:', SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 10)}...` : 'Not set');
console.log('🌐 Function URL:', FUNCTION_URL);
console.log('💳 Paystack Key:', PAYSTACK_SECRET_KEY ? `${PAYSTACK_SECRET_KEY.substring(0, 10)}...` : 'Not set');

async function debugFunction() {
  try {
    // Step 1: Check if environment variables are set
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.log('\n❌ Missing environment variables:');
      console.log('   EXPO_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? 'Set' : 'Missing');
      console.log('   EXPO_PUBLIC_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'Set' : 'Missing');
      console.log('\n💡 Make sure these are set in your app.config.js or .env file');
      return;
    }

    // Step 2: Test function accessibility
    console.log('\n📡 Testing function accessibility...');
    const optionsResponse = await fetch(FUNCTION_URL, {
      method: 'OPTIONS',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });
    
    console.log('   OPTIONS response status:', optionsResponse.status);
    console.log('   CORS headers:', Object.fromEntries(optionsResponse.headers.entries()));

    // Step 3: Test function execution
    console.log('\n🧪 Testing function execution...');
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-manual-trigger': 'true'
      },
      body: JSON.stringify({})
    });

    console.log('   POST response status:', response.status);
    console.log('   Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('   Response body:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.log('   ⚠️  Response is not valid JSON');
      return;
    }

    if (response.ok) {
      console.log('\n✅ Function executed successfully!');
      console.log('📊 Results:');
      console.log('   - Check type:', responseData.checkType);
      console.log('   - Accounts checked:', responseData.accountsChecked);
      console.log('   - Transactions processed:', responseData.processed);
      console.log('   - Total amount:', responseData.totalAmount);
      console.log('   - Emails sent:', responseData.emailsSent);
      
      if (responseData.processed > 0) {
        console.log('\n🎉 New transactions were found and processed!');
      } else {
        console.log('\nℹ️  No new transactions found (this is normal)');
      }
    } else {
      console.log('\n❌ Function execution failed');
      console.log('🔍 Error details:', responseData.error);
      console.log('📝 Additional info:', responseData.details);
    }

  } catch (error) {
    console.error('\n💥 Debug failed:', error.message);
    console.log('\n🔧 Possible issues:');
    console.log('1. Function not deployed');
    console.log('2. Wrong Supabase URL');
    console.log('3. Invalid API key');
    console.log('4. Network connectivity');
    console.log('5. CORS issues');
  }
}

async function checkCronJobStatus() {
  console.log('\n⏰ Checking cron job status...');
  console.log('💡 You need to check this manually in Supabase dashboard:');
  console.log('   1. Go to Database > Cron Jobs');
  console.log('   2. Look for "check-new-transactions" job');
  console.log('   3. Check if it\'s enabled and running');
  console.log('   4. Check the execution history');
  console.log('   5. Look for any error logs');
}

async function checkEnvironmentVariables() {
  console.log('\n🔧 Checking environment variables...');
  
  const requiredVars = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY',
    'RESEND_API_KEY'
  ];

  requiredVars.forEach(varName => {
    const value = expoConfig[varName] || process.env[varName];
    if (value) {
      console.log(`   ✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`   ❌ ${varName}: Not set`);
    }
  });
}

async function testPaystackAPI() {
  console.log('\n💳 Testing Paystack API...');
  
  const paystackKey = PAYSTACK_SECRET_KEY;
  if (!paystackKey) {
    console.log('   ❌ PAYSTACK_LIVE_SECRET_KEY not set');
    return;
  }

  try {
    const response = await fetch('https://api.paystack.co/transaction', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('   Paystack API status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Paystack API working');
      console.log(`   📊 Found ${data.data?.length || 0} transactions`);
    } else {
      console.log('   ❌ Paystack API error:', response.status);
    }
  } catch (error) {
    console.log('   ❌ Paystack API test failed:', error.message);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--env')) {
    await checkEnvironmentVariables();
  } else if (args.includes('--cron')) {
    await checkCronJobStatus();
  } else if (args.includes('--paystack')) {
    await testPaystackAPI();
  } else {
    await debugFunction();
    await checkEnvironmentVariables();
    await checkCronJobStatus();
    await testPaystackAPI();
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('\n📖 Usage:');
  console.log('  node scripts/debug-scheduled-function.js          # Full debug');
  console.log('  node scripts/debug-scheduled-function.js --env    # Check env vars');
  console.log('  node scripts/debug-scheduled-function.js --cron   # Check cron status');
  console.log('  node scripts/debug-scheduled-function.js --paystack # Test Paystack API');
  console.log('  node scripts/debug-scheduled-function.js --help   # Show this help');
} else {
  main();
} 