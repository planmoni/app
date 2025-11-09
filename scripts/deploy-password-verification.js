#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🔐 Deploying Password Verification Edge Function...\n');

try {
  // Check if Supabase CLI is available
  try {
    execSync('supabase --version', { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ Supabase CLI not found. Please install it first:');
    console.error('   npm install -g supabase');
    process.exit(1);
  }

  // Deploy the verify-password Edge Function
  console.log('📤 Deploying verify-password Edge Function...');
  execSync('supabase functions deploy verify-password', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  console.log('\n✅ Password Verification Edge Function deployed successfully!');
  console.log('\n🔧 Next Steps:');
  console.log('1. Test the password verification in your app');
  console.log('2. The function will now verify passwords against your database');
  console.log('3. Only correct passwords will unlock the app');
  console.log('\n📝 Note: Make sure your environment variables are properly configured:');
  console.log('   - EXPO_PUBLIC_SUPABASE_URL');
  console.log('   - EXPO_PUBLIC_SUPABASE_ANON_KEY');

} catch (error) {
  console.error('\n❌ Deployment failed:', error.message);
  console.error('\n🔍 Troubleshooting:');
  console.error('1. Make sure you\'re logged into Supabase CLI: supabase login');
  console.error('2. Check your project configuration: supabase status');
  console.error('3. Ensure you have the correct permissions');
  process.exit(1);
} 