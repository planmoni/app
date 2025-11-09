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

function incrementVersion(version, type) {
  const parts = version.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    default:
      throw new Error(`Invalid version type: ${type}`);
  }
}

function updateJsonFile(filePath, updates) {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    log(`⚠️  File not found: ${filePath}`, 'yellow');
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const json = JSON.parse(content);

  let modified = false;
  for (const [key, value] of Object.entries(updates)) {
    const keys = key.split('.');
    let current = json;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    const lastKey = keys[keys.length - 1];
    if (current[lastKey] !== value) {
      current[lastKey] = value;
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(fullPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    return true;
  }

  return false;
}

function main() {
  const args = process.argv.slice(2);
  const versionType = args[0] || 'patch';

  if (!['major', 'minor', 'patch'].includes(versionType)) {
    log('❌ Invalid version type. Use: major, minor, or patch', 'red');
    process.exit(1);
  }

  log('\n🚀 Starting version bump process...', 'bright');
  log(`📦 Bump type: ${versionType}`, 'blue');

  const packageJsonPath = 'package.json';
  const appJsonPath = 'app.json';

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  const currentVersion = packageJson.version;
  const newVersion = incrementVersion(currentVersion, versionType);

  log(`\n📊 Version Update:`, 'blue');
  log(`   Current: ${currentVersion}`, 'yellow');
  log(`   New:     ${newVersion}`, 'green');

  const currentAndroidBuild = appJson.expo?.android?.versionCode || 1;
  const currentIosBuild = appJson.expo?.ios?.buildNumber ? parseInt(appJson.expo.ios.buildNumber) : 1;

  const newAndroidBuild = currentAndroidBuild + 1;
  const newIosBuild = currentIosBuild + 1;

  log(`\n📱 Build Numbers:`, 'blue');
  log(`   Android: ${currentAndroidBuild} → ${newAndroidBuild}`, 'green');
  log(`   iOS:     ${currentIosBuild} → ${newIosBuild}`, 'green');

  log('\n📝 Updating configuration files...', 'blue');

  const packageUpdated = updateJsonFile(packageJsonPath, {
    version: newVersion,
  });

  const appUpdates = {
    'expo.version': newVersion,
  };

  if (!appJson.expo.android) {
    appJson.expo.android = {};
  }
  appUpdates['expo.android.versionCode'] = newAndroidBuild;

  if (!appJson.expo.ios) {
    appJson.expo.ios = {};
  }
  appUpdates['expo.ios.buildNumber'] = newIosBuild.toString();

  const appUpdated = updateJsonFile(appJsonPath, appUpdates);

  if (packageUpdated) {
    log('   ✅ package.json updated', 'green');
  }
  if (appUpdated) {
    log('   ✅ app.json updated', 'green');
  }

  log('\n✨ Version bump complete!', 'bright');
  log('\n📋 Next Steps:', 'blue');
  log('   1. Review the changes with: git diff', 'yellow');
  log('   2. Commit the changes: git add . && git commit -m "chore: bump version to ' + newVersion + '"', 'yellow');
  log('   3. Build with EAS: eas build --platform all --profile production', 'yellow');
  log('   4. After app store submission, run: npm run update-db-version', 'yellow');
  log('');
}

main();
