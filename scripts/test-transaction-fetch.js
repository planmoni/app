// Test script to manually fetch and process Paystack transactions
const fetch = require('node-fetch');

// Configuration
const API_URL = 'http://localhost:3000/api/fetch-paystack-transactions'; // Update with your actual URL
const USER_ID = 'your-user-id-here'; // Update with actual user ID

async function testTransactionFetch() {
  try {
    console.log('🧪 Testing Paystack transaction fetch...');
    console.log('👤 User ID:', USER_ID);
    console.log('📡 API URL:', API_URL);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: USER_ID
      })
    });
    
    console.log('📡 Response status:', response.status);
    
    const responseData = await response.json();
    console.log('📡 Response data:', responseData);
    
    if (response.ok) {
      if (responseData.processedCount > 0) {
        console.log('✅ Successfully processed transactions!');
        console.log(`💰 Processed ${responseData.processedCount} transactions`);
        console.log(`💵 Total amount: ₦${responseData.totalAmount.toLocaleString()}`);
        console.log('💡 Check your app to see the updated balance!');
      } else {
        console.log('ℹ️  No new transactions to process');
        console.log('💡 This is normal if no new payments were made');
      }
    } else {
      console.log('❌ Error processing transactions');
      console.log('🔍 Error details:', responseData.error);
    }
    
  } catch (error) {
    console.error('💥 Error testing transaction fetch:', error.message);
    console.log('\n🔧 Possible solutions:');
    console.log('1. Make sure your app is running');
    console.log('2. Check if the API URL is correct');
    console.log('3. Verify the user ID is correct');
    console.log('4. Ensure Paystack API key is set');
  }
}

// Instructions
console.log('🚀 Paystack Transaction Fetch Test');
console.log('==================================\n');

console.log('📝 Before running this test:');
console.log('1. Update USER_ID with your actual user ID');
console.log('2. Update API_URL if needed');
console.log('3. Make sure your app is running');
console.log('4. Ensure you have a Paystack virtual account');
console.log('5. Send some money to your virtual account first\n');

// Check if user ID is set
if (USER_ID === 'your-user-id-here') {
  console.log('⚠️  Please update USER_ID in this script before running');
  console.log('💡 You can find your user ID in your app or database');
} else {
  // Run the test
  testTransactionFetch();
}

module.exports = {
  testTransactionFetch
}; 