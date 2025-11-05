#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function verifyVersionConsistency() {
  log('\n🔍 Verifying version consistency...', 'bright');
  log('━'.repeat(50), 'blue');

  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const appJsonPath = path.join(process.cwd(), 'app.json');

  if (!fs.existsSync(packageJsonPath)) {
    log('❌ package.json not found', 'red');
    process.exit(1);
  }

  if (!fs.existsSync(appJsonPath)) {
    log('❌ app.json not found', 'red');
    process.exit(1);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  const packageVersion = packageJson.version;
  const appVersion = appJson.expo?.version;
  const androidBuild = appJson.expo?.android?.versionCode;
  const iosBuild = appJson.expo?.ios?.buildNumber;

  log('\n📦 Version Information:', 'blue');
  log(`   package.json: ${packageVersion}`, 'yellow');
  log(`   app.json:     ${appVersion || 'NOT SET'}`, appVersion ? 'yellow' : 'red');

  log('\n📱 Build Numbers:', 'blue');
  log(`   Android (versionCode): ${androidBuild || 'NOT SET'}`, androidBuild ? 'yellow' : 'red');
  log(`   iOS (buildNumber):     ${iosBuild || 'NOT SET'}`, iosBuild ? 'yellow' : 'red');

  const issues = [];

  if (!appVersion) {
    issues.push('app.json is missing expo.version');
  }

  if (packageVersion !== appVersion) {
    issues.push(`Version mismatch: package.json (${packageVersion}) !== app.json (${appVersion})`);
  }

  if (!androidBuild) {
    issues.push('app.json is missing expo.android.versionCode');
  }

  if (!iosBuild) {
    issues.push('app.json is missing expo.ios.buildNumber');
  }

  if (androidBuild && typeof androidBuild !== 'number') {
    issues.push('expo.android.versionCode must be a number');
  }

  if (iosBuild && typeof iosBuild !== 'string') {
    issues.push('expo.ios.buildNumber must be a string');
  }

  if (!appJson.expo?.android?.package) {
    issues.push('app.json is missing expo.android.package');
  }

  if (!appJson.expo?.ios?.bundleIdentifier) {
    issues.push('app.json is missing expo.ios.bundleIdentifier');
  }

  log('\n📋 Verification Results:', 'blue');

  if (issues.length === 0) {
    log('   ✅ All version checks passed!', 'green');
    log('\n✨ Your app configuration is consistent and ready for build', 'bright');
    log('');
    process.exit(0);
  } else {
    log('   ❌ Found ' + issues.length + ' issue(s):', 'red');
    issues.forEach((issue, index) => {
      log(`   ${index + 1}. ${issue}`, 'red');
    });

    log('\n💡 Fix these issues by running:', 'yellow');
    log('   npm run version:bump patch  (or minor/major)', 'yellow');
    log('');
    process.exit(1);
  }
}

verifyVersionConsistency();
