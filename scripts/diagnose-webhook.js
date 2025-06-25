// Diagnostic script to check webhook setup
const crypto = require('crypto');

console.log('🔍 Paystack Webhook Diagnostic Tool');
console.log('=====================================\n');

// Check 1: Environment Variables
console.log('1️⃣ Checking Environment Variables...');
const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('   PAYSTACK_WEBHOOK_SECRET:', webhookSecret ? '✅ Set' : '❌ Not set');
console.log('   EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Not set');
console.log('   EXPO_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set' : '❌ Not set');

if (!webhookSecret) {
  console.log('   ⚠️  You need to set PAYSTACK_WEBHOOK_SECRET in your .env file');
  console.log('   💡 Get this from your Paystack dashboard → Settings → Webhooks');
}

// Check 2: Webhook URL
console.log('\n2️⃣ Webhook URL Check...');
const webhookUrl = 'https://your-domain.com/api/paystack-webhook'; // Update this
console.log('   Current webhook URL:', webhookUrl);
console.log('   ⚠️  Make sure this URL is:');
console.log('      - Publicly accessible');
console.log('      - Using HTTPS');
console.log('      - Correctly configured in Paystack dashboard');

// Check 3: Test webhook signature generation
console.log('\n3️⃣ Testing Webhook Signature Generation...');
if (webhookSecret) {
  const testPayload = JSON.stringify({ test: 'data' });
  const signature = crypto
    .createHmac('sha512', webhookSecret)
    .update(testPayload)
    .digest('hex');
  
  console.log('   ✅ Signature generation works');
  console.log('   📝 Test signature:', signature.substring(0, 20) + '...');
} else {
  console.log('   ❌ Cannot test signature generation (no secret)');
}

// Check 4: Database connection
console.log('\n4️⃣ Database Connection Check...');
if (supabaseUrl && supabaseKey) {
  console.log('   ✅ Supabase credentials are set');
  console.log('   📝 Supabase URL:', supabaseUrl);
} else {
  console.log('   ❌ Supabase credentials missing');
}

// Check 5: Common issues
console.log('\n5️⃣ Common Issues Checklist...');
console.log('   □ Webhook configured in Paystack dashboard');
console.log('   □ Webhook URL is publicly accessible');
console.log('   □ HTTPS is enabled (required by Paystack)');
console.log('   □ Correct events selected (charge.success)');
console.log('   □ Webhook secret matches between Paystack and your app');
console.log('   □ App is running and accessible');

// Check 6: Next steps
console.log('\n6️⃣ Next Steps...');
console.log('   1. Configure webhook in Paystack dashboard');
console.log('   2. Set PAYSTACK_WEBHOOK_SECRET in .env file');
console.log('   3. Make sure your webhook URL is publicly accessible');
console.log('   4. Test with a real payment');
console.log('   5. Check app logs for webhook reception');

// Check 7: Testing commands
console.log('\n7️⃣ Testing Commands...');
console.log('   Test webhook endpoint:');
console.log('   node scripts/test-webhook-endpoint.js');
console.log('');
console.log('   Test with real webhook:');
console.log('   node scripts/test-paystack-webhook.js');
console.log('');
console.log('   Check app logs:');
console.log('   npm run dev (and watch console output)');

console.log('\n🎯 If you need help:');
console.log('   - Check docs/PAYSTACK_WEBHOOK_SETUP.md');
console.log('   - Verify webhook configuration in Paystack dashboard');
console.log('   - Test with the provided scripts');
console.log('   - Check your app logs for errors'); 