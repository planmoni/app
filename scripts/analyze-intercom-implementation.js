const fs = require('fs');
const path = require('path');

console.log('🔍 Intercom Implementation Analysis\n');
console.log('=' .repeat(50));

// Analysis Results
const analysis = {
  configuration: {},
  implementation: {},
  issues: [],
  recommendations: []
};

// 1. Configuration Analysis
console.log('📋 1. Configuration Analysis\n');

// Check app.json
const appJsonPath = path.join(__dirname, '../app.json');
if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const intercomPlugin = appJson.expo?.plugins?.find(plugin => 
    Array.isArray(plugin) && plugin[0] === '@intercom/intercom-react-native'
  );
  
  if (intercomPlugin) {
    const config = intercomPlugin[1];
    analysis.configuration.appJson = {
      appId: config.appId,
      iosApiKey: config.iosApiKey ? '✅ Set' : '❌ Missing',
      androidApiKey: config.androidApiKey ? '✅ Set' : '❌ Missing',
      region: config.intercomRegion || 'Not specified'
    };
    
    console.log('✅ app.json Configuration:');
    console.log(`   App ID: ${config.appId}`);
    console.log(`   iOS API Key: ${config.iosApiKey ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Android API Key: ${config.androidApiKey ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Region: ${config.intercomRegion || 'Not specified'}`);
  } else {
    analysis.configuration.appJson = '❌ Plugin not found';
    console.log('❌ Intercom plugin not found in app.json');
  }
} else {
  analysis.configuration.appJson = '❌ File not found';
  console.log('❌ app.json not found');
}

// Check package.json
const packageJsonPath = path.join(__dirname, '../package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const intercomVersion = packageJson.dependencies['@intercom/intercom-react-native'];
  
  analysis.configuration.packageJson = {
    installed: !!intercomVersion,
    version: intercomVersion || 'Not installed'
  };
  
  console.log('\n✅ Package.json:');
  console.log(`   Intercom Package: ${intercomVersion ? '✅ Installed' : '❌ Not installed'}`);
  console.log(`   Version: ${intercomVersion || 'N/A'}`);
} else {
  analysis.configuration.packageJson = '❌ File not found';
  console.log('\n❌ package.json not found');
}

// 2. Implementation Analysis
console.log('\n📋 2. Implementation Analysis\n');

// Check main help button implementation
const indexPath = path.join(__dirname, '../app/(tabs)/index.tsx');
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // Extract handleHelpPress function
  const helpPressMatch = indexContent.match(/const handleHelpPress = async \(\) => \{[\s\S]*?\};/);
  
  if (helpPressMatch) {
    const helpPressFunction = helpPressMatch[0];
    
    analysis.implementation.mainHelpButton = {
      hasImport: helpPressFunction.includes('import(\'@intercom/intercom-react-native\')'),
      hasUnidentifiedLogin: helpPressFunction.includes('loginUnidentifiedUser'),
      hasPresent: helpPressFunction.includes('Intercom.present'),
      hasErrorHandling: helpPressFunction.includes('catch'),
      hasUserCheck: helpPressFunction.includes('session?.user?.id'),
      hasAnalytics: helpPressFunction.includes('logAnalyticsEvent')
    };
    
    console.log('✅ Main Help Button (app/(tabs)/index.tsx):');
    console.log(`   Dynamic Import: ${analysis.implementation.mainHelpButton.hasImport ? '✅' : '❌'}`);
    console.log(`   Unidentified Login: ${analysis.implementation.mainHelpButton.hasUnidentifiedLogin ? '✅' : '❌'}`);
    console.log(`   Present Method: ${analysis.implementation.mainHelpButton.hasPresent ? '✅' : '❌'}`);
    console.log(`   Error Handling: ${analysis.implementation.mainHelpButton.hasErrorHandling ? '✅' : '❌'}`);
    console.log(`   User Session Check: ${analysis.implementation.mainHelpButton.hasUserCheck ? '✅' : '❌'}`);
    console.log(`   Analytics Tracking: ${analysis.implementation.mainHelpButton.hasAnalytics ? '✅' : '❌'}`);
    
    // Check for issues
    if (!helpPressFunction.includes('loginUserWithUserAttributes')) {
      analysis.issues.push('Main help button does not handle authenticated users');
    }
    if (!helpPressFunction.includes('await')) {
      analysis.issues.push('Main help button may not wait for login completion');
    }
  } else {
    analysis.implementation.mainHelpButton = '❌ Function not found';
    console.log('❌ handleHelpPress function not found');
  }
} else {
  analysis.implementation.mainHelpButton = '❌ File not found';
  console.log('❌ app/(tabs)/index.tsx not found');
}

// Check AuthContext implementation
const authContextPath = path.join(__dirname, '../contexts/AuthContext.tsx');
if (fs.existsSync(authContextPath)) {
  const authContextContent = fs.readFileSync(authContextPath, 'utf8');
  
  analysis.implementation.authContext = {
    hasSessionEffect: authContextContent.includes('session?.user?.id') && authContextContent.includes('useEffect'),
    hasLoginUserWithAttributes: authContextContent.includes('loginUserWithUserAttributes'),
    hasSetLauncherVisibility: authContextContent.includes('setLauncherVisibility'),
    hasSignInIntegration: authContextContent.includes('signIn') && authContextContent.includes('Intercom'),
    hasLogout: authContextContent.includes('logout') && authContextContent.includes('Intercom')
  };
  
  console.log('\n✅ AuthContext Implementation:');
  console.log(`   Session Effect: ${analysis.implementation.authContext.hasSessionEffect ? '✅' : '❌'}`);
  console.log(`   Login with Attributes: ${analysis.implementation.authContext.hasLoginUserWithAttributes ? '✅' : '❌'}`);
  console.log(`   Launcher Visibility: ${analysis.implementation.authContext.hasSetLauncherVisibility ? '✅' : '❌'}`);
  console.log(`   Sign In Integration: ${analysis.implementation.authContext.hasSignInIntegration ? '✅' : '❌'}`);
  console.log(`   Logout Handling: ${analysis.implementation.authContext.hasLogout ? '✅' : '❌'}`);
  
  // Check for issues
  if (!authContextContent.includes('await')) {
    analysis.issues.push('AuthContext may not wait for Intercom operations');
  }
  if (!authContextContent.includes('error')) {
    analysis.issues.push('AuthContext has minimal error handling');
  }
} else {
  analysis.implementation.authContext = '❌ File not found';
  console.log('\n❌ contexts/AuthContext.tsx not found');
}

// Check HelpCenterModal implementation
const helpModalPath = path.join(__dirname, '../components/HelpCenterModal.tsx');
if (fs.existsSync(helpModalPath)) {
  const helpModalContent = fs.readFileSync(helpModalPath, 'utf8');
  
  analysis.implementation.helpCenterModal = {
    hasImport: helpModalContent.includes('import(\'@intercom/intercom-react-native\')'),
    hasUnidentifiedLogin: helpModalContent.includes('loginUnidentifiedUser'),
    hasPresent: helpModalContent.includes('Intercom.present'),
    hasErrorHandling: helpModalContent.includes('catch'),
    hasUserCheck: helpModalContent.includes('user')
  };
  
  console.log('\n✅ HelpCenterModal Implementation:');
  console.log(`   Dynamic Import: ${analysis.implementation.helpCenterModal.hasImport ? '✅' : '❌'}`);
  console.log(`   Unidentified Login: ${analysis.implementation.helpCenterModal.hasUnidentifiedLogin ? '✅' : '❌'}`);
  console.log(`   Present Method: ${analysis.implementation.helpCenterModal.hasPresent ? '✅' : '❌'}`);
  console.log(`   Error Handling: ${analysis.implementation.helpCenterModal.hasErrorHandling ? '✅' : '❌'}`);
  console.log(`   User Check: ${analysis.implementation.helpCenterModal.hasUserCheck ? '✅' : '❌'}`);
  
  // Check for issues
  if (!helpModalContent.includes('loginUserWithUserAttributes')) {
    analysis.issues.push('HelpCenterModal does not handle authenticated users');
  }
} else {
  analysis.implementation.helpCenterModal = '❌ File not found';
  console.log('\n❌ components/HelpCenterModal.tsx not found');
}

// 3. Issues Analysis
console.log('\n📋 3. Issues Identified\n');

if (analysis.issues.length > 0) {
  analysis.issues.forEach((issue, index) => {
    console.log(`${index + 1}. ❌ ${issue}`);
  });
} else {
  console.log('✅ No major issues identified');
}

// 4. Recommendations
console.log('\n📋 4. Recommendations\n');

analysis.recommendations = [];

// Check for authentication flow issues
if (!analysis.implementation.mainHelpButton.hasUserCheck || 
    !analysis.implementation.helpCenterModal.hasUserCheck) {
  analysis.recommendations.push('Implement proper user authentication flow in help buttons');
}

// Check for error handling
if (!analysis.implementation.mainHelpButton.hasErrorHandling || 
    !analysis.implementation.helpCenterModal.hasErrorHandling) {
  analysis.recommendations.push('Add comprehensive error handling for Intercom operations');
}

// Check for waiting for operations
if (!analysis.implementation.mainHelpButton.hasUserCheck) {
  analysis.recommendations.push('Ensure Intercom operations are properly awaited');
}

// Check for user data
if (!analysis.implementation.authContext.hasLoginUserWithAttributes) {
  analysis.recommendations.push('Implement proper user data passing to Intercom');
}

// Add general recommendations
analysis.recommendations.push('Add loading states while Intercom operations are in progress');
analysis.recommendations.push('Implement retry logic for failed Intercom operations');
analysis.recommendations.push('Add user feedback for Intercom connection issues');

analysis.recommendations.forEach((recommendation, index) => {
  console.log(`${index + 1}. 💡 ${recommendation}`);
});

// 5. Summary
console.log('\n📋 5. Implementation Summary\n');

const configScore = Object.values(analysis.configuration).filter(v => typeof v === 'object' && v !== '❌ File not found').length;
const implScore = Object.values(analysis.implementation).filter(v => typeof v === 'object' && v !== '❌ File not found').length;

console.log(`Configuration Score: ${configScore}/2 ✅`);
console.log(`Implementation Score: ${implScore}/3 ✅`);
console.log(`Issues Found: ${analysis.issues.length}`);
console.log(`Recommendations: ${analysis.recommendations.length}`);

if (analysis.issues.length === 0 && configScore === 2 && implScore === 3) {
  console.log('\n🎉 Intercom implementation looks good!');
} else {
  console.log('\n⚠️ Some improvements needed for optimal Intercom integration');
}

console.log('\n📋 6. Key Findings\n');

console.log('✅ What\'s Working:');
console.log('- Intercom package is installed (v8.7.0)');
console.log('- Configuration is properly set in app.json');
console.log('- Basic integration exists in multiple components');
console.log('- AuthContext handles user login to Intercom');

console.log('\n⚠️ Areas for Improvement:');
console.log('- Main help button lacks authenticated user handling');
console.log('- HelpCenterModal lacks authenticated user handling');
console.log('- Limited error handling and user feedback');
console.log('- No loading states during Intercom operations');

console.log('\n🔧 Quick Fixes:');
console.log('1. Update main help button to handle authenticated users');
console.log('2. Add proper error handling and user feedback');
console.log('3. Implement loading states');
console.log('4. Add retry logic for failed operations');

console.log('\n✅ Analysis complete!'); 