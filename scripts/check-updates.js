#!/usr/bin/env node

/**
 * Diagnostic script to check EAS Update configuration and status
 * 
 * Usage: node scripts/check-updates.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(message, color = 'reset') {
  const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkConfiguration() {
  log('\n📋 Checking EAS Update Configuration...\n', 'cyan');
  
  // Check app.json
  const appJsonPath = path.join(__dirname, '..', 'app.json');
  if (fs.existsSync(appJsonPath)) {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    log('✅ app.json found', 'green');
    log(`   Runtime Version: ${appJson.expo.runtimeVersion || 'NOT SET'}`, 
        appJson.expo.runtimeVersion ? 'green' : 'red');
    log(`   Update URL: ${appJson.expo.updates?.url || 'NOT SET'}`, 
        appJson.expo.updates?.url ? 'green' : 'red');
    log(`   Check Automatically: ${appJson.expo.updates?.checkAutomatically || 'NOT SET'}`);
  } else {
    log('❌ app.json not found', 'red');
  }
  
  // Check eas.json
  const easJsonPath = path.join(__dirname, '..', 'eas.json');
  if (fs.existsSync(easJsonPath)) {
    const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
    log('\n✅ eas.json found', 'green');
    
    if (easJson.build?.production?.channel) {
      log(`   Production Channel: ${easJson.build.production.channel}`, 'green');
    } else {
      log('   ⚠️  Production channel not explicitly set (will default to "production")', 'yellow');
    }
  }
  
  // Check package.json for expo-updates
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const hasExpoUpdates = packageJson.dependencies?.['expo-updates'] || 
                          packageJson.devDependencies?.['expo-updates'];
    log(`\n${hasExpoUpdates ? '✅' : '❌'} expo-updates: ${hasExpoUpdates ? hasExpoUpdates : 'NOT INSTALLED'}`, 
        hasExpoUpdates ? 'green' : 'red');
  }
}

async function checkRecentUpdates() {
  log('\n📦 Checking Recent Updates...\n', 'cyan');
  
  try {
    const output = execSync('eas update:list --branch production --limit 3 --non-interactive', {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
    });
    
    log('✅ Recent updates on production branch:', 'green');
    console.log(output);
  } catch (error) {
    log('❌ Error checking updates:', 'red');
    log(`   ${error.message}`, 'red');
  }
}

async function checkRecentBuilds() {
  log('\n🏗️  Checking Recent Builds...\n', 'cyan');
  
  try {
    const output = execSync('eas build:list --platform all --limit 2 --non-interactive', {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
    });
    
    log('✅ Recent builds:', 'green');
    console.log(output);
  } catch (error) {
    log('❌ Error checking builds:', 'red');
    log(`   ${error.message}`, 'red');
  }
}

async function main() {
  log('🔍 EAS Update Diagnostic Tool\n', 'blue');
  
  await checkConfiguration();
  await checkRecentUpdates();
  await checkRecentBuilds();
  
  log('\n💡 Troubleshooting Tips:', 'yellow');
  log('   1. Ensure runtime version in app.json matches the runtime version of your build', 'yellow');
  log('   2. Verify updates are published to the same branch/channel as your build', 'yellow');
  log('   3. Users must fully close and restart the app to receive updates', 'yellow');
  log('   4. Check device logs for update check messages', 'yellow');
  log('   5. Verify the build was created with expo-updates installed', 'yellow');
  log('');
}

main().catch(console.error);
