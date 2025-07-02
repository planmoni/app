require('dotenv').config();
const fetch = require('node-fetch');

// Configuration
const PAYSTACK_API_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY;
const TEST_EMAIL = 'test@example.com';

// Test all supported USSD types
const USSD_TYPES = {
  '058': '737', // GTBank
  '033': '919', // UBA
  '232': '822', // Sterling Bank
  '057': '966', // Zenith Bank
};

async function testUSSDAvailability() {
  console.log('🧪 Testing USSD Service Availability');
  console.log('====================================');
  
  if (!PAYSTACK_SECRET_KEY) {
    console.error('❌ Paystack secret key not found in environment variables');
    console.log('Please set EXPO_PUBLIC_PAYSTACK_LIVE_SECRET_KEY in your .env file');
    return;
  }
  
  const results = {};
  
  for (const [bankCode, ussdType] of Object.entries(USSD_TYPES)) {
    const bankName = getBankName(bankCode);
    console.log(`\n🏦 Testing ${bankName} (${ussdType})...`);
    
    try {
      const testData = {
        email: TEST_EMAIL,
        amount: '100000', // 1000 Naira in kobo
        ussd: {
          type: ussdType
        },
        metadata: {
          user_id: 'test_user_123',
          payment_type: 'ussd',
          bank_code: bankCode,
          reference: `test_${Date.now()}_${ussdType}`
        }
      };

      const response = await fetch(`${PAYSTACK_API_URL}/charge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      });

      const data = await response.json();
      
      if (response.ok && data.status === true) {
        console.log(`✅ ${bankName}: Available`);
        results[bankCode] = {
          status: 'available',
          bankName,
          ussdType,
          reference: data.data?.reference
        };
      } else if (data.code === 'unprocessed_transaction' && data.data?.status === 'failed') {
        console.log(`❌ ${bankName}: Service unavailable - ${data.data.message}`);
        results[bankCode] = {
          status: 'unavailable',
          bankName,
          ussdType,
          error: data.data.message
        };
      } else {
        console.log(`⚠️  ${bankName}: Error - ${data.message}`);
        results[bankCode] = {
          status: 'error',
          bankName,
          ussdType,
          error: data.message
        };
      }
      
    } catch (error) {
      console.log(`💥 ${bankName}: Network error - ${error.message}`);
      results[bankCode] = {
        status: 'network_error',
        bankName,
        ussdType,
        error: error.message
      };
    }
  }
  
  // Summary
  console.log('\n📊 Availability Summary:');
  console.log('========================');
  
  const available = Object.values(results).filter(r => r.status === 'available');
  const unavailable = Object.values(results).filter(r => r.status === 'unavailable');
  const errors = Object.values(results).filter(r => r.status === 'error' || r.status === 'network_error');
  
  console.log(`✅ Available: ${available.length}/4 banks`);
  available.forEach(bank => {
    console.log(`   - ${bank.bankName} (${bank.ussdType})`);
  });
  
  if (unavailable.length > 0) {
    console.log(`\n❌ Unavailable: ${unavailable.length} banks`);
    unavailable.forEach(bank => {
      console.log(`   - ${bank.bankName} (${bank.ussdType}): ${bank.error}`);
    });
  }
  
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors: ${errors.length} banks`);
    errors.forEach(bank => {
      console.log(`   - ${bank.bankName} (${bank.ussdType}): ${bank.error}`);
    });
  }
  
  console.log('\n💡 Recommendation:');
  if (available.length > 0) {
    console.log('Use available banks for USSD payments. Unavailable banks may have temporary service interruptions.');
  } else {
    console.log('All USSD services appear to be unavailable. Please try again later or contact Paystack support.');
  }
}

// Helper function to get bank name
function getBankName(bankCode) {
  const bankNames = {
    '058': 'Guaranty Trust Bank',
    '033': 'United Bank of Africa',
    '232': 'Sterling Bank',
    '057': 'Zenith Bank'
  };
  return bankNames[bankCode] || 'Unknown Bank';
}

// Run the test
testUSSDAvailability(); 