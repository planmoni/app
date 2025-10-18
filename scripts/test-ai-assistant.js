#!/usr/bin/env node

/**
 * AI Assistant Debug Script
 * 
 * This script helps debug AI Assistant issues on real devices by:
 * 1. Testing environment variable configuration
 * 2. Testing OpenAI API connectivity
 * 3. Providing debugging information for real device issues
 */

const fs = require('fs');
const path = require('path');

console.log('🤖 AI Assistant Debug Script');
console.log('============================\n');

// Check if we're in the right directory
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ Error: Please run this script from the project root directory');
  process.exit(1);
}

// Load app config
let appConfig;
try {
  const appConfigPath = path.join(process.cwd(), 'app.config.js');
  if (fs.existsSync(appConfigPath)) {
    // Clear require cache to get fresh config
    delete require.cache[require.resolve(appConfigPath)];
    appConfig = require(appConfigPath).default;
  } else {
    console.log('⚠️  app.config.js not found, checking app.json...');
    const appJsonPath = path.join(process.cwd(), 'app.json');
    if (fs.existsSync(appJsonPath)) {
      appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    }
  }
} catch (error) {
  console.error('❌ Error loading app config:', error.message);
  process.exit(1);
}

async function checkEnvironmentVariables() {
  console.log('🔧 Checking Environment Variables...');
  console.log('-----------------------------------');
  
  const requiredVars = [
    'EXPO_PUBLIC_OPENAI_API_KEY',
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  const optionalVars = [
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY',
    'EXPO_PUBLIC_MONO_PUBLIC_KEY'
  ];
  
  console.log('\n📋 Required Variables:');
  let allRequiredPresent = true;
  requiredVars.forEach(varName => {
    const value = process.env[varName] || (appConfig?.expo?.extra && appConfig.expo.extra[varName]);
    if (value) {
      console.log(`   ✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`   ❌ ${varName}: Not set`);
      allRequiredPresent = false;
    }
  });
  
  console.log('\n📋 Optional Variables:');
  optionalVars.forEach(varName => {
    const value = process.env[varName] || (appConfig?.expo?.extra && appConfig.expo.extra[varName]);
    if (value) {
      console.log(`   ✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`   ⚠️  ${varName}: Not set (optional)`);
    }
  });
  
  if (!allRequiredPresent) {
    console.log('\n❌ Some required environment variables are missing!');
    console.log('   Please check your .env file or app.config.js');
    return false;
  }
  
  console.log('\n✅ All required environment variables are present');
  return true;
}

async function testOpenAIConnection() {
  console.log('\n🧠 Testing OpenAI API Connection...');
  console.log('----------------------------------');
  
  const openaiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || 
                   (appConfig?.expo?.extra && appConfig.expo.extra.EXPO_PUBLIC_OPENAI_API_KEY);
  
  if (!openaiKey) {
    console.log('❌ OpenAI API key not found');
    return false;
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
        'User-Agent': 'Planmoni-Debug-Script/1.0'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a test assistant. Respond with "Test successful" if you receive this message.' },
          { role: 'user', content: 'Hello, this is a test message.' }
        ],
        temperature: 0.7,
        max_tokens: 50
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      console.log('✅ OpenAI API connection successful');
      console.log(`   Response: ${content}`);
      console.log(`   Usage: ${JSON.stringify(data.usage)}`);
      return true;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log(`❌ OpenAI API error: ${response.status} ${response.statusText}`);
      console.log(`   Error details: ${JSON.stringify(errorData)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ OpenAI API connection failed: ${error.message}`);
    return false;
  }
}

async function checkNetworkConnectivity() {
  console.log('\n🌐 Testing Network Connectivity...');
  console.log('----------------------------------');
  
  const testUrls = [
    'https://api.openai.com',
    'https://api.openai.com/v1/models',
    'https://httpbin.org/get'
  ];
  
  for (const url of testUrls) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Planmoni-Debug-Script/1.0'
        }
      });
      
      if (response.ok) {
        console.log(`   ✅ ${url}: ${response.status} ${response.statusText}`);
      } else {
        console.log(`   ⚠️  ${url}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ ${url}: ${error.message}`);
    }
  }
}

async function checkAppConfiguration() {
  console.log('\n📱 Checking App Configuration...');
  console.log('--------------------------------');
  
  if (appConfig) {
    console.log('✅ App configuration loaded successfully');
    console.log(`   App Name: ${appConfig.expo?.name || 'Unknown'}`);
    console.log(`   Bundle ID: ${appConfig.expo?.ios?.bundleIdentifier || 'Unknown'}`);
    console.log(`   Package Name: ${appConfig.expo?.android?.package || 'Unknown'}`);
    
    // Check if OpenAI key is in app config
    const openaiKey = appConfig.expo?.extra?.EXPO_PUBLIC_OPENAI_API_KEY;
    if (openaiKey) {
      console.log(`   OpenAI Key in Config: ✅ (${openaiKey.substring(0, 20)}...)`);
    } else {
      console.log('   OpenAI Key in Config: ❌ Not found');
    }
  } else {
    console.log('❌ App configuration not found');
  }
}

async function generateDebugReport() {
  console.log('\n📊 Generating Debug Report...');
  console.log('-----------------------------');
  
  const report = {
    timestamp: new Date().toISOString(),
    platform: process.platform,
    nodeVersion: process.version,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      EXPO_PUBLIC_OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY ? 'Present' : 'Missing',
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ? 'Present' : 'Missing',
    },
    appConfig: {
      hasConfig: !!appConfig,
      hasOpenAIKey: !!(appConfig?.expo?.extra?.EXPO_PUBLIC_OPENAI_API_KEY),
      bundleId: appConfig?.expo?.ios?.bundleIdentifier,
      packageName: appConfig?.expo?.android?.package
    }
  };
  
  const reportPath = path.join(process.cwd(), 'ai-assistant-debug-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`✅ Debug report saved to: ${reportPath}`);
}

async function provideTroubleshootingTips() {
  console.log('\n🔧 Troubleshooting Tips for Real Device Issues...');
  console.log('------------------------------------------------');
  
  console.log('\n1. Environment Variables:');
  console.log('   - Ensure EXPO_PUBLIC_OPENAI_API_KEY is set in your .env file');
  console.log('   - For production builds, verify the key is included in app.config.js');
  console.log('   - Check that the key has the correct permissions in OpenAI dashboard');
  
  console.log('\n2. Network Issues:');
  console.log('   - Real devices may have different network restrictions');
  console.log('   - Check if your device can access api.openai.com');
  console.log('   - Some corporate networks block OpenAI API access');
  
  console.log('\n3. Build Configuration:');
  console.log('   - Ensure environment variables are properly bundled in production');
  console.log('   - Check that the app.config.js is correctly configured');
  console.log('   - Verify the build process includes all required variables');
  
  console.log('\n4. API Key Issues:');
  console.log('   - Verify the API key is valid and has sufficient credits');
  console.log('   - Check OpenAI dashboard for usage limits or restrictions');
  console.log('   - Ensure the key has access to gpt-3.5-turbo model');
  
  console.log('\n5. Debugging Steps:');
  console.log('   - Use the "Test AI" button in development mode');
  console.log('   - Check device logs for detailed error messages');
  console.log('   - Test with a simple question first');
  console.log('   - Try different network connections (WiFi vs Mobile)');
}

async function main() {
  try {
    const envCheck = await checkEnvironmentVariables();
    await checkAppConfiguration();
    await checkNetworkConnectivity();
    
    if (envCheck) {
      const apiTest = await testOpenAIConnection();
      if (!apiTest) {
        console.log('\n⚠️  OpenAI API test failed, but environment variables are present');
        console.log('   This suggests a network or API key issue');
      }
    }
    
    await generateDebugReport();
    await provideTroubleshootingTips();
    
    console.log('\n🎯 Next Steps:');
    console.log('--------------');
    console.log('1. If environment variables are missing, check your .env file');
    console.log('2. If API test fails, check your OpenAI API key and network');
    console.log('3. For real device issues, try the "Test AI" button in the app');
    console.log('4. Check the debug report for detailed information');
    console.log('5. Contact support with the debug report if issues persist');
    
  } catch (error) {
    console.error('\n❌ Script error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
