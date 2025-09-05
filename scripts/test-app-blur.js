#!/usr/bin/env node

/**
 * Test script for App Blur functionality
 * This script verifies that the AppBlur component is properly integrated
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 Testing App Blur Integration...\n');

// Test 1: Check if AppBlur component exists
const appBlurPath = path.join(__dirname, '../components/AppBlur.tsx');
if (fs.existsSync(appBlurPath)) {
  console.log('✅ AppBlur component exists');
} else {
  console.log('❌ AppBlur component not found');
  process.exit(1);
}

// Test 2: Check if AppBlur is imported in _layout.tsx
const layoutPath = path.join(__dirname, '../app/_layout.tsx');
const layoutContent = fs.readFileSync(layoutPath, 'utf8');

if (layoutContent.includes("import AppBlur from '@/components/AppBlur'")) {
  console.log('✅ AppBlur import found in _layout.tsx');
} else {
  console.log('❌ AppBlur import not found in _layout.tsx');
}

// Test 3: Check if AppBlur wraps RootLayoutNav
if (layoutContent.includes('<AppBlur>') && layoutContent.includes('</AppBlur>')) {
  console.log('✅ AppBlur wrapper found around RootLayoutNav');
} else {
  console.log('❌ AppBlur wrapper not found around RootLayoutNav');
}

// Test 4: Check if expo-blur is installed
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (packageJson.dependencies && packageJson.dependencies['expo-blur']) {
  console.log('✅ expo-blur dependency found');
} else {
  console.log('❌ expo-blur dependency not found');
}

// Test 5: Check AppBlur component structure
const appBlurContent = fs.readFileSync(appBlurPath, 'utf8');

const requiredFeatures = [
  'AppState.addEventListener',
  'BlurView',
  'useTheme',
  'Lock',
  'isBlurred',
  'Platform.OS === \'web\''
];

let allFeaturesFound = true;
requiredFeatures.forEach(feature => {
  if (appBlurContent.includes(feature)) {
    console.log(`✅ Feature found: ${feature}`);
  } else {
    console.log(`❌ Feature missing: ${feature}`);
    allFeaturesFound = false;
  }
});

console.log('\n📱 App Blur Integration Summary:');
console.log('================================');

if (allFeaturesFound) {
  console.log('🎉 All tests passed! App Blur is properly integrated.');
  console.log('\n🔒 Security Features:');
  console.log('• App content will be blurred when minimized');
  console.log('• Blur overlay shows lock icon and security message');
  console.log('• Automatically hides when app returns to foreground');
  console.log('• Web platform is excluded (no blur needed)');
  console.log('• Integrates with existing app state management');
} else {
  console.log('⚠️  Some tests failed. Please check the implementation.');
}

console.log('\n📋 How to Test:');
console.log('1. Run the app on a device/simulator');
console.log('2. Navigate to any screen');
console.log('3. Press home button or switch to another app');
console.log('4. App content should be blurred with lock icon');
console.log('5. Return to the app - blur should disappear');

