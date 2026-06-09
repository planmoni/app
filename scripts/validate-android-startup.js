#!/usr/bin/env node

/**
 * Automated checks for Android startup hardening (run before rollout).
 * Usage: node scripts/validate-android-startup.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let failed = 0;

function pass(msg) {
  console.log(`  OK  ${msg}`);
}

function fail(msg) {
  console.error(` FAIL ${msg}`);
  failed += 1;
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

console.log('\nAndroid startup validation\n');

// 1. Runtime version sync
const appConfig = require(path.join(ROOT, 'app.config.js'));
const appJson = JSON.parse(read('app.json'));
const configRuntime = appConfig.expo.runtimeVersion;
const jsonRuntime = appJson.expo.runtimeVersion;

if (configRuntime && configRuntime === jsonRuntime) {
  pass(`runtimeVersion aligned (${configRuntime})`);
} else {
  fail(`runtimeVersion mismatch: app.config.js=${configRuntime}, app.json=${jsonRuntime}`);
}

// 2. No reanimated on entry route
const indexRoute = read('app/index.tsx');
const hasReanimatedImport =
  /from\s+['"]react-native-reanimated['"]/.test(indexRoute) ||
  /require\(['"]react-native-reanimated['"]\)/.test(indexRoute);

if (hasReanimatedImport) {
  fail('app/index.tsx still imports react-native-reanimated');
} else {
  pass('app/index.tsx has no reanimated import');
}

// 3. Home tab lazy-loads carousel
const homeTab = read('app/(tabs)/index.tsx');
if (/React\.lazy\(\(\) => import\('@\/components\/ImageCarousel'\)\)/.test(homeTab)) {
  pass('Home tab lazy-loads ImageCarousel');
} else {
  fail('Home tab does not lazy-load ImageCarousel');
}

// 4. Babel reanimated plugin last
const babel = read('babel.config.js');
if (babel.includes("'react-native-reanimated/plugin'")) {
  pass('babel.config.js includes reanimated plugin');
} else {
  fail('babel.config.js missing react-native-reanimated/plugin');
}

// 5. No conflicting worklets-core
const pkg = JSON.parse(read('package.json'));
if (pkg.dependencies?.['react-native-worklets-core']) {
  fail('react-native-worklets-core still in dependencies');
} else {
  pass('react-native-worklets-core removed');
}

if (pkg.dependencies?.['react-native-worklets'] && pkg.dependencies?.['react-native-reanimated']) {
  pass('reanimated + worklets pair present');
} else {
  fail('missing react-native-reanimated or react-native-worklets');
}

// 6. Native android folder exists post-prebuild
if (fs.existsSync(path.join(ROOT, 'android/app/build.gradle'))) {
  pass('android native project present');
} else {
  fail('android native project missing — run yarn prebuild:android');
}

// 7. Expo dependency check
try {
  execSync('npx expo install --check', { cwd: ROOT, stdio: 'pipe' });
  pass('expo install --check passed');
} catch {
  fail('expo install --check failed');
}

console.log('\nManual QA (device/emulator):');
console.log('  - Cold start fresh install');
console.log('  - Warm start / background resume');
console.log('  - Post-OTA reopen');
console.log('  - Home carousel + AI assistant animations\n');

if (failed > 0) {
  console.error(`${failed} automated check(s) failed.\n`);
  process.exit(1);
}

console.log('All automated checks passed. Proceed with dev client → preview → production rollout.\n');
