#!/usr/bin/env node

/**
 * Publish EAS Updates with runtime/native-build guardrails.
 *
 * Usage:
 *   node scripts/publish-update.js preview "Update message"
 *   node scripts/publish-update.js production "Update message"
 *
 * Native-module changes (Reanimated, Worklets, Firebase, etc.) require a new
 * EAS native build before OTA. Set CONFIRM_NATIVE_BUILD=1 only after shipping
 * binaries built with the current runtimeVersion.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const channel = args[0] || 'production';
const message = args[1] || `Update: ${new Date().toISOString()}`;

const ROOT = path.resolve(__dirname, '..');
const APP_CONFIG = path.join(ROOT, 'app.config.js');
const EAS_CONFIG = path.join(ROOT, 'eas.json');

const NATIVE_SENSITIVE_PACKAGES = [
  'react-native-reanimated',
  'react-native-worklets',
  'expo',
  'react-native',
  '@react-native-firebase/app',
  '@react-native-firebase/messaging',
  '@intercom/intercom-react-native',
  '@sentry/react-native',
];

function readRuntimeVersion() {
  const config = require(APP_CONFIG);
  return config?.expo?.runtimeVersion || null;
}

function readEasChannels() {
  const eas = JSON.parse(fs.readFileSync(EAS_CONFIG, 'utf8'));
  return {
    preview: eas?.build?.preview?.channel || 'preview',
    production: eas?.build?.production?.channel || 'production',
  };
}

function getChangedNativeDeps() {
  try {
    const diff = execSync('git diff --name-only HEAD', {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    if (!diff) return [];

    const changedFiles = diff.split('\n');
    if (!changedFiles.includes('package.json') && !changedFiles.includes('yarn.lock')) {
      return [];
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return NATIVE_SENSITIVE_PACKAGES.filter((name) => deps[name]);
  } catch {
    return [];
  }
}

if (!['preview', 'production'].includes(channel)) {
  console.error('Invalid channel. Use "preview" or "production".');
  process.exit(1);
}

const runtimeVersion = readRuntimeVersion();
const channels = readEasChannels();

if (!runtimeVersion) {
  console.error('runtimeVersion is not set in app.config.js');
  process.exit(1);
}

console.log('Publishing EAS update');
console.log(`  Channel: ${channel} (build profile channel: ${channels[channel]})`);
console.log(`  Runtime: ${runtimeVersion}`);
console.log(`  Message: ${message}`);

const nativeDeps = getChangedNativeDeps();
if (nativeDeps.length > 0 && process.env.CONFIRM_NATIVE_BUILD !== '1') {
  console.error('\nBlocked: package.json/yarn.lock changed with native-sensitive deps:');
  nativeDeps.forEach((dep) => console.error(`  - ${dep}`));
  console.error('\nShip a new EAS native build for this runtime before OTA.');
  console.error('After native binaries are live, rerun with CONFIRM_NATIVE_BUILD=1');
  process.exit(1);
}

try {
  console.log('\nValidating Expo dependencies...');
  execSync('npx expo install --check', { stdio: 'inherit', cwd: ROOT });
} catch {
  console.error('\nDependency validation failed. Run: yarn validate:deps');
  process.exit(1);
}

try {
  const command = `eas update --branch ${channel} --message "${message.replace(/"/g, '\\"')}"`;
  console.log(`\nRunning: ${command}\n`);
  execSync(command, { stdio: 'inherit', cwd: ROOT });
  console.log(`\nUpdate published to ${channel} (runtime ${runtimeVersion}).`);
  console.log('Only apps built with this runtimeVersion will receive the bundle.');
} catch (error) {
  console.error('\nFailed to publish update:', error.message);
  process.exit(1);
}
