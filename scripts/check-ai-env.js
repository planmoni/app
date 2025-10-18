#!/usr/bin/env node

/**
 * Quick AI Environment Check
 * Simple script to verify AI Assistant environment configuration
 */

const fs = require('fs');
const path = require('path');

console.log('🤖 AI Assistant Environment Check');
console.log('=================================\n');

// Load app config
let appConfig;
try {
  const appConfigPath = path.join(process.cwd(), 'app.config.js');
  if (fs.existsSync(appConfigPath)) {
    delete require.cache[require.resolve(appConfigPath)];
    appConfig = require(appConfigPath).default;
  }
} catch (error) {
  console.error('❌ Error loading app config:', error.message);
  process.exit(1);
}

// Check OpenAI API key
const openaiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || 
                 (appConfig?.expo?.extra && appConfig.expo.extra.EXPO_PUBLIC_OPENAI_API_KEY);

console.log('🔑 OpenAI API Key Check:');
if (openaiKey) {
  console.log(`   ✅ Found: ${openaiKey.substring(0, 20)}...`);
  console.log(`   📏 Length: ${openaiKey.length} characters`);
  console.log(`   🔍 Source: ${process.env.EXPO_PUBLIC_OPENAI_API_KEY ? 'Environment' : 'App Config'}`);
} else {
  console.log('   ❌ Not found');
  console.log('   💡 Make sure EXPO_PUBLIC_OPENAI_API_KEY is set in your .env file');
}

// Check other required variables
const requiredVars = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY'
];

console.log('\n🔧 Other Required Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName] || (appConfig?.expo?.extra && appConfig.expo.extra[varName]);
  if (value) {
    console.log(`   ✅ ${varName}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`   ❌ ${varName}: Not set`);
  }
});

// Summary
console.log('\n📊 Summary:');
if (openaiKey) {
  console.log('   ✅ AI Assistant should work properly');
  console.log('   💡 If you\'re still having issues on real devices:');
  console.log('      - Check network connectivity');
  console.log('      - Verify API key permissions in OpenAI dashboard');
  console.log('      - Try the "Test AI" button in development mode');
} else {
  console.log('   ❌ AI Assistant will not work without OpenAI API key');
  console.log('   💡 Add EXPO_PUBLIC_OPENAI_API_KEY to your .env file');
}

console.log('\n🚀 Run the full debug script for more details:');
console.log('   node scripts/test-ai-assistant.js');
