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
 *
 * Never publish from a worktree that symlinks another tree's node_modules.
 * Always `yarn install --frozen-lockfile` from the commit's yarn.lock first.
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
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const YARN_LOCK = path.join(ROOT, 'yarn.lock');

const NATIVE_SENSITIVE_PACKAGES = [
  'react-native-reanimated',
  'react-native-worklets',
  'expo',
  'react-native',
  'expo-background-task',
  'expo-task-manager',
  '@react-native-firebase/app',
  '@react-native-firebase/messaging',
  '@intercom/intercom-react-native',
  '@sentry/react-native',
];

/** Packages whose installed version must match yarn.lock (OTA crash class). */
const LOCKFILE_PINNED_PACKAGES = [
  '@react-navigation/native',
  '@react-navigation/bottom-tabs',
  '@react-navigation/native-stack',
  '@react-navigation/elements',
  'react-native-reanimated',
  'react-native-worklets',
  'expo-background-task',
  'expo-task-manager',
  'expo-router',
];

/** Must not ship in OTAs until a matching native binary is live. */
const BLOCKED_UNTIL_NATIVE_BUILD = ['expo-background-task', 'expo-task-manager'];

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

function readPackageJson() {
  return JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
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

    let headPkg = {};
    try {
      headPkg = JSON.parse(
        execSync('git show HEAD:package.json', { cwd: ROOT, encoding: 'utf8' })
      );
    } catch {
      headPkg = {};
    }

    const headDeps = { ...(headPkg.dependencies || {}), ...(headPkg.devDependencies || {}) };
    const pkg = readPackageJson();
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    const changed = [];
    for (const name of NATIVE_SENSITIVE_PACKAGES) {
      const before = headDeps[name] || null;
      const after = deps[name] || null;
      // Removals are safe for OTA (JS no longer loads the native module).
      if (before && !after) {
        continue;
      }
      // Additions or range changes need a matching native binary.
      if (before !== after) {
        changed.push(`${name} (${before || 'absent'} → ${after || 'absent'})`);
        continue;
      }
      // Same package.json range, but lockfile resolved version may have drifted.
      if (changedFiles.includes('yarn.lock') && after) {
        let headLockVersion = null;
        try {
          const headLock = execSync('git show HEAD:yarn.lock', {
            cwd: ROOT,
            encoding: 'utf8',
            maxBuffer: 20 * 1024 * 1024,
          });
          const lines = headLock.split('\n');
          const needle = `${name}@`;
          for (let i = 0; i < lines.length; i++) {
            if (!lines[i].includes(needle) || !lines[i].trimEnd().endsWith(':')) continue;
            for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
              const match = lines[j].match(/^\s*version\s+"([^"]+)"/);
              if (match) {
                headLockVersion = match[1];
                break;
              }
              if (lines[j] && !/^\s/.test(lines[j]) && lines[j].includes('@')) break;
            }
            if (headLockVersion) break;
          }
        } catch {
          headLockVersion = null;
        }
        const nowLockVersion = resolveLockfileVersion(name);
        if (headLockVersion && nowLockVersion && headLockVersion !== nowLockVersion) {
          changed.push(`${name} lockfile (${headLockVersion} → ${nowLockVersion})`);
        }
      }
    }
    return changed;
  } catch {
    return [];
  }
}

function assertNotSymlinkedNodeModules() {
  const nm = path.join(ROOT, 'node_modules');
  if (!fs.existsSync(nm)) {
    console.error('\nBlocked: node_modules is missing.');
    console.error('Run: yarn install --frozen-lockfile');
    process.exit(1);
  }

  const stat = fs.lstatSync(nm);
  if (stat.isSymbolicLink()) {
    const target = fs.readlinkSync(nm);
    console.error('\nBlocked: node_modules is a symlink (foreign dependency tree).');
    console.error(`  ${nm} -> ${target}`);
    console.error('Never publish an OTA from a worktree that symlinks another tree\'s node_modules.');
    console.error('In this directory run: rm node_modules && yarn install --frozen-lockfile');
    process.exit(1);
  }
}

function resolveLockfileVersion(packageName) {
  if (!fs.existsSync(YARN_LOCK)) return null;
  const lock = fs.readFileSync(YARN_LOCK, 'utf8');
  const lines = lock.split('\n');
  const needle = `${packageName}@`;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes(needle) || !line.trimEnd().endsWith(':')) continue;
    // Prefer descriptor lines (package keys), skip nested dependency refs like `    foo "1.2.3"`.
    if (/^\s{2,}\S/.test(line) && !line.trimStart().startsWith('"') && !line.includes('@')) {
      continue;
    }
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const match = lines[j].match(/^\s*version\s+"([^"]+)"/);
      if (match) return match[1];
      // Stop if we hit the next top-level key without finding version.
      if (lines[j] && !/^\s/.test(lines[j]) && lines[j].includes('@')) break;
    }
  }
  return null;
}

function readInstalledVersion(packageName) {
  const pkgPath = path.join(ROOT, 'node_modules', ...packageName.split('/'), 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || null;
  } catch {
    return null;
  }
}

function assertLockfileMatchesNodeModules() {
  const mismatches = [];
  const missingInModules = [];

  for (const name of LOCKFILE_PINNED_PACKAGES) {
    const locked = resolveLockfileVersion(name);
    const installed = readInstalledVersion(name);

    // Skip packages not declared in this tree's lockfile (e.g. background-task removed).
    if (!locked) {
      if (installed && BLOCKED_UNTIL_NATIVE_BUILD.includes(name)) {
        mismatches.push({
          name,
          locked: '(not in yarn.lock)',
          installed,
          note: 'present in node_modules but not locked — remove or reinstall from this lockfile',
        });
      }
      continue;
    }

    if (!installed) {
      missingInModules.push(name);
      continue;
    }

    if (locked !== installed) {
      mismatches.push({ name, locked, installed });
    }
  }

  if (missingInModules.length > 0 || mismatches.length > 0) {
    console.error('\nBlocked: node_modules does not match yarn.lock (hybrid OTA risk).');
    for (const name of missingInModules) {
      console.error(`  - ${name}: locked but missing from node_modules`);
    }
    for (const row of mismatches) {
      console.error(
        `  - ${row.name}: lockfile=${row.locked} installed=${row.installed}${row.note ? ` (${row.note})` : ''}`
      );
    }
    console.error('\nFix: rm -rf node_modules && yarn install --frozen-lockfile');
    console.error('Do not symlink node_modules from another checkout.');
    process.exit(1);
  }
}

function assertBackgroundTaskNotInOtaTree() {
  const pkg = readPackageJson();
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const present = BLOCKED_UNTIL_NATIVE_BUILD.filter((name) => deps[name]);

  let pluginPresent = false;
  try {
    // Fresh require of app.config.js
    delete require.cache[require.resolve(APP_CONFIG)];
    const config = require(APP_CONFIG);
    const plugins = config?.expo?.plugins || [];
    pluginPresent = plugins.some((p) => {
      const id = Array.isArray(p) ? p[0] : p;
      return id === 'expo-background-task' || id === 'expo-task-manager';
    });
  } catch {
    // ignore — expo config may fail for other reasons checked later
  }

  if (present.length > 0 || pluginPresent) {
    console.error('\nBlocked: expo-background-task / expo-task-manager must not ship in OTAs');
    console.error('until a matching native EAS build (with bumped runtimeVersion) is live.');
    if (present.length > 0) {
      console.error(`  package.json deps: ${present.join(', ')}`);
    }
    if (pluginPresent) {
      console.error('  app.config.js still lists the expo-background-task plugin');
    }
    console.error('\nRemove the deps + plugin, or ship the native build first and set CONFIRM_NATIVE_BUILD=1');
    if (process.env.CONFIRM_NATIVE_BUILD !== '1') {
      process.exit(1);
    }
    console.warn('CONFIRM_NATIVE_BUILD=1 set — allowing background-task packages.');
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
console.log('  Guard: lockfile↔node_modules + no symlinked node_modules');

assertNotSymlinkedNodeModules();
assertLockfileMatchesNodeModules();
assertBackgroundTaskNotInOtaTree();

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
  // Patch advisories must not block emergency OTAs on a pinned runtimeVersion.
  // Native ABI is guarded by lockfile↔node_modules + NATIVE_SENSITIVE checks above.
  console.warn('\nWarning: expo install --check reported issues.');
  console.warn('Continuing publish for runtime', runtimeVersion, '(fix with: yarn validate:deps).');
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
