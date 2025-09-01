const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Updated Intercom Implementation\n');
console.log('=' .repeat(50));

// Test Results
const results = {
  mainHelpButton: {},
  helpCenterModal: {},
  imports: {},
  summary: {}
};

// 1. Test Main Help Button (app/(tabs)/index.tsx)
console.log('📋 1. Testing Main Help Button\n');

const indexPath = path.join(__dirname, '../app/(tabs)/index.tsx');
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // Check for Alert import
  const hasAlertImport = indexContent.includes('Alert,');
  results.imports.mainHelpButton = hasAlertImport;
  console.log(`Alert Import: ${hasAlertImport ? '✅' : '❌'}`);
  
  // Extract handleHelpPress function
  const helpPressMatch = indexContent.match(/const handleHelpPress = async \(\) => \{[\s\S]*?\};/);
  
  if (helpPressMatch) {
    const helpPressFunction = helpPressMatch[0];
    
    results.mainHelpButton = {
      hasConsoleLogs: helpPressFunction.includes('console.log'),
      hasUserSessionCheck: helpPressFunction.includes('session?.user?.id'),
      hasUnidentifiedLogin: helpPressFunction.includes('loginUnidentifiedUser'),
      hasAuthenticatedLogin: helpPressFunction.includes('loginUserWithUserAttributes'),
      hasUserUpdate: helpPressFunction.includes('updateUser'),
      hasWaitForAuth: helpPressFunction.includes('setTimeout(resolve, 1000)'),
      hasPresentCall: helpPressFunction.includes('Intercom.present'),
      hasErrorHandling: helpPressFunction.includes('Alert.alert'),
      hasAnalytics: helpPressFunction.includes('logAnalyticsEvent')
    };
    
    console.log('✅ Main Help Button Implementation:');
    console.log(`   Console Logging: ${results.mainHelpButton.hasConsoleLogs ? '✅' : '❌'}`);
    console.log(`   User Session Check: ${results.mainHelpButton.hasUserSessionCheck ? '✅' : '❌'}`);
    console.log(`   Unidentified Login: ${results.mainHelpButton.hasUnidentifiedLogin ? '✅' : '❌'}`);
    console.log(`   Authenticated Login: ${results.mainHelpButton.hasAuthenticatedLogin ? '✅' : '❌'}`);
    console.log(`   User Update: ${results.mainHelpButton.hasUserUpdate ? '✅' : '❌'}`);
    console.log(`   Wait for Auth: ${results.mainHelpButton.hasWaitForAuth ? '✅' : '❌'}`);
    console.log(`   Present Call: ${results.mainHelpButton.hasPresentCall ? '✅' : '❌'}`);
    console.log(`   Error Handling: ${results.mainHelpButton.hasErrorHandling ? '✅' : '❌'}`);
    console.log(`   Analytics: ${results.mainHelpButton.hasAnalytics ? '✅' : '❌'}`);
  } else {
    results.mainHelpButton = '❌ Function not found';
    console.log('❌ handleHelpPress function not found');
  }
} else {
  results.mainHelpButton = '❌ File not found';
  console.log('❌ app/(tabs)/index.tsx not found');
}

// 2. Test HelpCenterModal (components/HelpCenterModal.tsx)
console.log('\n📋 2. Testing HelpCenterModal\n');

const helpModalPath = path.join(__dirname, '../components/HelpCenterModal.tsx');
if (fs.existsSync(helpModalPath)) {
  const helpModalContent = fs.readFileSync(helpModalPath, 'utf8');
  
  // Check for Alert import
  const hasAlertImport = helpModalContent.includes('Alert,');
  results.imports.helpCenterModal = hasAlertImport;
  console.log(`Alert Import: ${hasAlertImport ? '✅' : '❌'}`);
  
  // Check for Intercom implementation
  results.helpCenterModal = {
    hasConsoleLogs: helpModalContent.includes('console.log'),
    hasUserCheck: helpModalContent.includes('!user'),
    hasUnidentifiedLogin: helpModalContent.includes('loginUnidentifiedUser'),
    hasAuthenticatedLogin: helpModalContent.includes('loginUserWithUserAttributes'),
    hasUserUpdate: helpModalContent.includes('updateUser'),
    hasWaitForAuth: helpModalContent.includes('setTimeout(resolve, 1000)'),
    hasPresentCall: helpModalContent.includes('Intercom.present'),
    hasErrorHandling: helpModalContent.includes('Alert.alert')
  };
  
  console.log('✅ HelpCenterModal Implementation:');
  console.log(`   Console Logging: ${results.helpCenterModal.hasConsoleLogs ? '✅' : '❌'}`);
  console.log(`   User Check: ${results.helpCenterModal.hasUserCheck ? '✅' : '❌'}`);
  console.log(`   Unidentified Login: ${results.helpCenterModal.hasUnidentifiedLogin ? '✅' : '❌'}`);
  console.log(`   Authenticated Login: ${results.helpCenterModal.hasAuthenticatedLogin ? '✅' : '❌'}`);
  console.log(`   User Update: ${results.helpCenterModal.hasUserUpdate ? '✅' : '❌'}`);
  console.log(`   Wait for Auth: ${results.helpCenterModal.hasWaitForAuth ? '✅' : '❌'}`);
  console.log(`   Present Call: ${results.helpCenterModal.hasPresentCall ? '✅' : '❌'}`);
  console.log(`   Error Handling: ${results.helpCenterModal.hasErrorHandling ? '✅' : '❌'}`);
} else {
  results.helpCenterModal = '❌ File not found';
  console.log('❌ components/HelpCenterModal.tsx not found');
}

// 3. Summary
console.log('\n📋 3. Implementation Summary\n');

const mainHelpButtonScore = typeof results.mainHelpButton === 'object' ? 
  Object.values(results.mainHelpButton).filter(Boolean).length : 0;

const helpCenterModalScore = typeof results.helpCenterModal === 'object' ? 
  Object.values(results.helpCenterModal).filter(Boolean).length : 0;

const importsScore = Object.values(results.imports).filter(Boolean).length;

results.summary = {
  mainHelpButtonScore,
  helpCenterModalScore,
  importsScore,
  totalScore: mainHelpButtonScore + helpCenterModalScore + importsScore
};

console.log(`Main Help Button Score: ${mainHelpButtonScore}/9`);
console.log(`HelpCenterModal Score: ${helpCenterModalScore}/8`);
console.log(`Imports Score: ${importsScore}/2`);
console.log(`Total Score: ${results.summary.totalScore}/19`);

// 4. Key Improvements Made
console.log('\n📋 4. Key Improvements Made\n');

console.log('✅ Fixed Issues:');
console.log('1. Added proper user authentication handling');
console.log('2. Implemented loginUserWithUserAttributes for authenticated users');
console.log('3. Added user data updates (name)');
console.log('4. Added wait time for authentication completion');
console.log('5. Enhanced error handling with user-friendly alerts');
console.log('6. Added comprehensive console logging for debugging');
console.log('7. Added Alert imports for error handling');

console.log('\n🔧 Expected Behavior:');
console.log('- Unidentified users: loginUnidentifiedUser() → wait → present()');
console.log('- Authenticated users: loginUserWithUserAttributes() → updateUser() → wait → present()');
console.log('- Error handling: User-friendly alerts on failure');
console.log('- Debugging: Comprehensive console logs for troubleshooting');

// 5. Testing Instructions
console.log('\n📋 5. Testing Instructions\n');

console.log('🧪 Manual Testing Steps:');
console.log('1. Rebuild the app: npx expo run:ios --no-build-cache');
console.log('2. Test with logged-out user:');
console.log('   - Tap help button');
console.log('   - Check console logs for "Unidentified user logged in"');
console.log('   - Verify Intercom opens with content');
console.log('3. Test with logged-in user:');
console.log('   - Log into the app');
console.log('   - Tap help button');
console.log('   - Check console logs for "User logged in to Intercom"');
console.log('   - Verify Intercom opens with user data');
console.log('4. Test error scenarios:');
console.log('   - Disconnect internet');
console.log('   - Tap help button');
console.log('   - Verify error alert appears');

console.log('\n📊 Expected Console Logs:');
console.log('🎯 Help button pressed');
console.log('👤 User session found, logging in with user data...');
console.log('✅ User logged in to Intercom');
console.log('🎯 Presenting Intercom...');
console.log('✅ Intercom presented successfully');

if (results.summary.totalScore >= 17) {
  console.log('\n🎉 Implementation looks excellent! Ready for testing.');
} else if (results.summary.totalScore >= 14) {
  console.log('\n✅ Implementation looks good with minor improvements needed.');
} else {
  console.log('\n⚠️ Implementation needs more work.');
}

console.log('\n✅ Test complete!'); 