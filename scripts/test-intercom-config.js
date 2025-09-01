const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Intercom Configuration\n');
console.log('=' .repeat(50));

// Test 1: Check app.json configuration
console.log('📋 Test 1: app.json Configuration');
const appJsonPath = path.join(__dirname, '../app.json');
if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  
  const intercomPlugin = appJson.expo?.plugins?.find(plugin => 
    Array.isArray(plugin) && plugin[0] === '@intercom/intercom-react-native'
  );
  
  if (intercomPlugin) {
    const config = intercomPlugin[1];
    console.log('✅ Intercom plugin found in app.json');
    console.log('   App ID:', config.appId);
    console.log('   iOS API Key:', config.iosApiKey ? '✅ Set' : '❌ Missing');
    console.log('   Android API Key:', config.androidApiKey ? '✅ Set' : '❌ Missing');
    console.log('   Region:', config.intercomRegion || 'Not specified');
  } else {
    console.log('❌ Intercom plugin not found in app.json');
  }
  
  // Check extra configuration
  if (appJson.expo?.extra?.INTERCOM) {
    console.log('✅ Intercom extra config found in app.json');
    const extra = appJson.expo.extra.INTERCOM;
    console.log('   App ID:', extra.appId);
    console.log('   iOS API Key:', extra.iosApiKey ? '✅ Set' : '❌ Missing');
    console.log('   Android API Key:', extra.androidApiKey ? '✅ Set' : '❌ Missing');
  } else {
    console.log('❌ Intercom extra config missing from app.json');
  }
} else {
  console.log('❌ app.json does not exist');
}

console.log('');

// Test 2: Check app.config.js configuration
console.log('📋 Test 2: app.config.js Configuration');
const appConfigPath = path.join(__dirname, '../app.config.js');
if (fs.existsSync(appConfigPath)) {
  const appConfigContent = fs.readFileSync(appConfigPath, 'utf8');
  
  if (appConfigContent.includes('INTERCOM_IOS_API_KEY') && 
      appConfigContent.includes('INTERCOM_ANDROID_API_KEY') && 
      appConfigContent.includes('INTERCOM_APP_ID')) {
    console.log('✅ Intercom environment variables found in app.config.js');
    
    // Extract the values
    const iosKeyMatch = appConfigContent.match(/INTERCOM_IOS_API_KEY:\s*"([^"]+)"/);
    const androidKeyMatch = appConfigContent.match(/INTERCOM_ANDROID_API_KEY:\s*"([^"]+)"/);
    const appIdMatch = appConfigContent.match(/INTERCOM_APP_ID:\s*"([^"]+)"/);
    
    if (iosKeyMatch) console.log('   iOS API Key:', iosKeyMatch[1]);
    if (androidKeyMatch) console.log('   Android API Key:', androidKeyMatch[1]);
    if (appIdMatch) console.log('   App ID:', appIdMatch[1]);
  } else {
    console.log('❌ Intercom environment variables missing from app.config.js');
  }
} else {
  console.log('❌ app.config.js does not exist');
}

console.log('');

// Test 3: Check package.json
console.log('📋 Test 3: Dependencies');
const packageJsonPath = path.join(__dirname, '../package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  if (packageJson.dependencies['@intercom/intercom-react-native']) {
    console.log('✅ Intercom package installed');
    console.log(`   Version: ${packageJson.dependencies['@intercom/intercom-react-native']}`);
  } else {
    console.log('❌ Intercom package not installed');
  }
} else {
  console.log('❌ package.json does not exist');
}

console.log('');

// Test 4: Validate configuration values
console.log('📋 Test 4: Configuration Validation');

// Expected values from the provided snippet
const expectedConfig = {
  appId: 'tf4dp3qt',
  iosApiKey: 'ios_sdk-de52645ae34ab0f059890a422f90b18092032115',
  androidApiKey: 'android_sdk-c13200a10981c64eb6e2b4030551b67de50243bf'
};

// Check if app.json has the correct values
if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const intercomPlugin = appJson.expo?.plugins?.find(plugin => 
    Array.isArray(plugin) && plugin[0] === '@intercom/intercom-react-native'
  );
  
  if (intercomPlugin) {
    const config = intercomPlugin[1];
    console.log('✅ Plugin configuration validation:');
    console.log(`   App ID: ${config.appId === expectedConfig.appId ? '✅' : '❌'} ${config.appId}`);
    console.log(`   iOS API Key: ${config.iosApiKey === expectedConfig.iosApiKey ? '✅' : '❌'} ${config.iosApiKey ? 'Set' : 'Missing'}`);
    console.log(`   Android API Key: ${config.androidApiKey === expectedConfig.androidApiKey ? '✅' : '❌'} ${config.androidApiKey ? 'Set' : 'Missing'}`);
  }
  
  // Check extra configuration
  if (appJson.expo?.extra?.INTERCOM) {
    const extra = appJson.expo.extra.INTERCOM;
    console.log('✅ Extra configuration validation:');
    console.log(`   App ID: ${extra.appId === expectedConfig.appId ? '✅' : '❌'} ${extra.appId}`);
    console.log(`   iOS API Key: ${extra.iosApiKey === expectedConfig.iosApiKey ? '✅' : '❌'} ${extra.iosApiKey ? 'Set' : 'Missing'}`);
    console.log(`   Android API Key: ${extra.androidApiKey === expectedConfig.androidApiKey ? '✅' : '❌'} ${extra.androidApiKey ? 'Set' : 'Missing'}`);
  }
}

console.log('');

// Summary
console.log('📋 Configuration Summary');
console.log('=' .repeat(30));

const summary = {
  appJsonPlugin: fs.existsSync(appJsonPath) && JSON.parse(fs.readFileSync(appJsonPath, 'utf8')).expo?.plugins?.some(plugin => 
    Array.isArray(plugin) && plugin[0] === '@intercom/intercom-react-native'
  ),
  appJsonExtra: fs.existsSync(appJsonPath) && !!JSON.parse(fs.readFileSync(appJsonPath, 'utf8')).expo?.extra?.INTERCOM,
  appConfigVars: fs.existsSync(appConfigPath) && fs.readFileSync(appConfigPath, 'utf8').includes('INTERCOM_IOS_API_KEY'),
  packageInstalled: fs.existsSync(packageJsonPath) && !!JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).dependencies['@intercom/intercom-react-native']
};

const allPassed = Object.values(summary).every(Boolean);

if (allPassed) {
  console.log('🎉 All configuration tests passed!');
  console.log('');
  console.log('✅ Intercom plugin configured in app.json');
  console.log('✅ Intercom extra config in app.json');
  console.log('✅ Intercom environment variables in app.config.js');
  console.log('✅ Intercom package installed');
  console.log('');
  console.log('🚀 Ready to rebuild and test!');
} else {
  console.log('⚠️ Some configuration tests failed.');
  console.log('');
  console.log('Failed checks:');
  Object.entries(summary).forEach(([key, passed]) => {
    if (!passed) {
      console.log(`❌ ${key}`);
    }
  });
}

console.log('');
console.log('📋 Next Steps:');
console.log('1. Rebuild the app: npx expo run:ios --no-build-cache');
console.log('2. Test the help button functionality');
console.log('3. Check console logs for any errors');
console.log('4. Verify Intercom opens successfully'); 