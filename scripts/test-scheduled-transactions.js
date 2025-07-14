#!/usr/bin/env node

/**
 * Test Script for Scheduled Transaction Checking
 * 
 * This script manually triggers the check-new-transactions function to test
 * if it's working correctly and processing new transactions.
 */

const fetch = require('node-fetch');

// Configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/check-new-transactions`;

console.log('🧪 Testing scheduled transaction checking function...');
console.log('🔗 Function URL:', FUNCTION_URL);

async function testScheduledTransactions() {
  try {
    console.log('\n📡 Sending request to function...');
    
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({})
    });
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📄 Response body:', responseText);
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.log('⚠️  Response is not valid JSON');
      return;
    }
    
    if (response.ok) {
      console.log('\n✅ Function executed successfully!');
      
      if (responseData.processed > 0) {
        console.log(`💰 Processed ${responseData.processed} new transactions`);
        console.log(`💵 Total amount: ₦${responseData.totalAmount.toLocaleString()}`);
        console.log(`📧 Emails sent: ${responseData.emailsSent}`);
        console.log(`👥 Accounts checked: ${responseData.accountsChecked}`);
        
        console.log('\n🎉 New transactions were found and processed!');
        console.log('📧 Check your email for notifications');
        console.log('💳 Check your app for updated balance');
      } else {
        console.log('\nℹ️  No new transactions found');
        console.log('💡 This is normal if no new payments were made');
        console.log('💡 Try sending money to your virtual account and test again');
      }
      
      console.log('\n📋 Function Summary:');
      console.log(`- Accounts checked: ${responseData.accountsChecked}`);
      console.log(`- Transactions processed: ${responseData.processed}`);
      console.log(`- Total amount: ₦${responseData.totalAmount || 0}`);
      console.log(`- Emails sent: ${responseData.emailsSent}`);
      
    } else {
      console.log('\n❌ Function execution failed');
      console.log('🔍 Error details:', responseData.error);
      console.log('📝 Additional info:', responseData.details);
      
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Check if the function is deployed correctly');
      console.log('2. Verify environment variables are set');
      console.log('3. Check Supabase dashboard for function logs');
      console.log('4. Ensure Paystack API key is valid');
      console.log('5. Verify Resend API key is configured');
    }
    
  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    console.log('\n🔧 Possible issues:');
    console.log('1. Network connectivity');
    console.log('2. Invalid Supabase URL or key');
    console.log('3. Function not deployed');
    console.log('4. CORS issues');
    
    console.log('\n💡 To debug:');
    console.log('1. Check your environment variables');
    console.log('2. Verify the function URL is correct');
    console.log('3. Try accessing the function directly in browser');
    console.log('4. Check Supabase dashboard for errors');
  }
}

// Additional test functions
async function testWithMockData() {
  console.log('\n🧪 Testing with mock data...');
  
  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        test: true,
        mockTransactions: [
          {
            reference: 'TEST_REF_001',
            amount: 500000, // ₦5,000 in kobo
            status: 'success',
            channel: 'dedicated_nuban',
            authorization: {
              account_number: '1234567890'
            }
          }
        ]
      })
    });
    
    const responseData = await response.json();
    console.log('Mock test response:', responseData);
    
  } catch (error) {
    console.error('Mock test failed:', error.message);
  }
}

async function checkFunctionStatus() {
  console.log('\n🔍 Checking function status...');
  
  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'OPTIONS',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });
    
    console.log('Status check response:', response.status);
    console.log('CORS headers:', Object.fromEntries(response.headers.entries()));
    
  } catch (error) {
    console.error('Status check failed:', error.message);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--status')) {
    await checkFunctionStatus();
  } else if (args.includes('--mock')) {
    await testWithMockData();
  } else {
    await testScheduledTransactions();
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('\n📖 Usage:');
  console.log('  node scripts/test-scheduled-transactions.js          # Test normal execution');
  console.log('  node scripts/test-scheduled-transactions.js --status # Check function status');
  console.log('  node scripts/test-scheduled-transactions.js --mock   # Test with mock data');
  console.log('  node scripts/test-scheduled-transactions.js --help   # Show this help');
  
  console.log('\n🔧 Environment variables needed:');
  console.log('  EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.log('  EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
  
  console.log('\n💡 Tips:');
  console.log('  - Make sure the function is deployed first');
  console.log('  - Check Supabase dashboard for function logs');
  console.log('  - Verify all environment variables are set');
  console.log('  - Test with real money sent to virtual account');
} else {
  main();
} 