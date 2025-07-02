// Script to check environment variables for USSD integration
require('dotenv').config();

console.log('🔍 Checking environment variables for USSD integration...\n');

// Required environment variables
const requiredVars = [
  'PAYSTACK_SECRET_KEY',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY'
];

// Optional but recommended
const optionalVars = [
  'EXPO_PUBLIC_APP_URL',
  'PAYSTACK_WEBHOOK_SECRET'
];

console.log('📋 Required Environment Variables:');
let allRequiredSet = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 10)}...${value.substring(value.length - 4)}`);
  } else {
    console.log(`❌ ${varName}: Not set`);
    allRequiredSet = false;
  }
});

console.log('\n📋 Optional Environment Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value}`);
  } else {
    console.log(`⚠️  ${varName}: Not set (optional)`);
  }
});

console.log('\n📊 Summary:');
if (allRequiredSet) {
  console.log('✅ All required environment variables are set');
  console.log('🚀 USSD integration should work properly');
} else {
  console.log('❌ Some required environment variables are missing');
  console.log('🔧 Please set the missing variables in your .env file');
}

console.log('\n💡 Tips:');
console.log('1. Make sure your .env file is in the root directory');
console.log('2. Restart your development server after changing environment variables');
console.log('3. For production, set these variables in your hosting platform');
console.log('4. Never commit your .env file to version control'); 