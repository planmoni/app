/**
 * Reset Project Script
 * 
 * This script cleans up the project by:
 * 1. Clearing Metro bundler cache
 * 2. Removing node_modules
 * 3. Removing any temporary files
 * 4. Reinstalling dependencies
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧹 Starting project reset...');

try {
  // Clear Metro bundler cache
  console.log('🗑️  Clearing Metro cache...');
  try {
    execSync('npx expo start --clear', { stdio: 'ignore' });
    execSync('npx react-native start --reset-cache', { stdio: 'ignore' });
  } catch (e) {
    console.log('⚠️  Metro cache clear attempted (non-critical if it fails)');
  }

  // Remove node_modules
  console.log('🗑️  Removing node_modules...');
  try {
    execSync('rm -rf node_modules');
  } catch (e) {
    console.error('❌ Failed to remove node_modules:', e.message);
    process.exit(1);
  }

  // Remove temporary directories that might cause issues
  const tempDirs = [
    '.expo',
    '.expo-shared',
    'web-build',
    '.next',
    'dist',
    'build',
  ];

  tempDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`🗑️  Removing ${dir}...`);
      try {
        execSync(`rm -rf ${dir}`);
      } catch (e) {
        console.log(`⚠️  Could not remove ${dir} (non-critical)`);
      }
    }
  });

  // Clear npm cache (optional)
  console.log('🗑️  Clearing npm cache...');
  try {
    execSync('npm cache clean --force', { stdio: 'ignore' });
  } catch (e) {
    console.log('⚠️  npm cache clean attempted (non-critical if it fails)');
  }

  // Reinstall dependencies
  console.log('📦 Reinstalling dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
  } catch (e) {
    console.error('❌ Failed to reinstall dependencies:', e.message);
    process.exit(1);
  }

  // Explicitly install expo to ensure it's available
  console.log('📦 Ensuring expo is installed...');
  try {
    execSync('npm install expo', { stdio: 'inherit' });
  } catch (e) {
    console.error('❌ Failed to install expo:', e.message);
    process.exit(1);
  }

  console.log('✅ Project reset complete! You can now start your app with npm start');
} catch (error) {
  console.error('❌ Project reset failed:', error.message);
  process.exit(1);
}