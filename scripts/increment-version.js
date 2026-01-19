#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Increment version by 1 (patch version)
 * @param {string} version - Current version (e.g., "1.2.7")
 * @returns {string} - Incremented version (e.g., "1.2.8")
 */
function incrementVersion(version) {
  const parts = version.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid version format: ${version}. Expected format: major.minor.patch`);
  }
  
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  const patch = parseInt(parts[2], 10) + 1;
  
  return `${major}.${minor}.${patch}`;
}

/**
 * Update version in app.config.js
 */
function updateAppConfigJs(filePath, oldVersion, newVersion) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Update version
  content = content.replace(
    new RegExp(`version:\\s*"${oldVersion.replace(/\./g, '\\.')}"`, 'g'),
    `version: "${newVersion}"`
  );
  
  // Update runtimeVersion
  content = content.replace(
    new RegExp(`runtimeVersion:\\s*"${oldVersion.replace(/\./g, '\\.')}"`, 'g'),
    `runtimeVersion: "${newVersion}"`
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated app.config.js: ${oldVersion} → ${newVersion}`);
}

/**
 * Update version in app.json
 */
function updateAppJson(filePath, oldVersion, newVersion) {
  const content = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(content);
  
  json.expo.version = newVersion;
  
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`✅ Updated app.json: ${oldVersion} → ${newVersion}`);
}

/**
 * Update version in package.json
 */
function updatePackageJson(filePath, oldVersion, newVersion) {
  const content = fs.readFileSync(filePath, 'utf8');
  const json = JSON.parse(content);
  
  json.version = newVersion;
  
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`✅ Updated package.json: ${oldVersion} → ${newVersion}`);
}

/**
 * Update version in package-lock.json
 */
function updatePackageLockJson(filePath, oldVersion, newVersion) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Update version at root level
  content = content.replace(
    new RegExp(`"version":\\s*"${oldVersion.replace(/\./g, '\\.')}"`, 'g'),
    `"version": "${newVersion}"`
  );
  
  // Update version in packages[""] section
  content = content.replace(
    new RegExp(`"name":\\s*"planmoni",\\s*"version":\\s*"${oldVersion.replace(/\./g, '\\.')}"`, 'g'),
    `"name": "planmoni",\n      "version": "${newVersion}"`
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated package-lock.json: ${oldVersion} → ${newVersion}`);
}

/**
 * Update version in android/app/build.gradle
 */
function updateBuildGradle(filePath, oldVersion, newVersion) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Update versionName
  content = content.replace(
    new RegExp(`versionName\\s+"${oldVersion.replace(/\./g, '\\.')}"`, 'g'),
    `versionName "${newVersion}"`
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated android/app/build.gradle: ${oldVersion} → ${newVersion}`);
}

/**
 * Update version in android/app/src/main/res/values/strings.xml
 */
function updateStringsXml(filePath, oldVersion, newVersion) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Update expo_runtime_version
  content = content.replace(
    new RegExp(`<string name="expo_runtime_version"[^>]*>${oldVersion.replace(/\./g, '\\.')}</string>`, 'g'),
    `<string name="expo_runtime_version" translatable="false">${newVersion}</string>`
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated android/app/src/main/res/values/strings.xml: ${oldVersion} → ${newVersion}`);
}

/**
 * Update version in iOS Info.plist
 */
function updateInfoPlist(filePath, oldVersion, newVersion) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Update CFBundleShortVersionString
  content = content.replace(
    new RegExp(`<key>CFBundleShortVersionString</key>\\s*<string>${oldVersion.replace(/\./g, '\\.')}</string>`, 'g'),
    `<key>CFBundleShortVersionString</key>\n    <string>${newVersion}</string>`
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated ios/Planmoni/Info.plist: ${oldVersion} → ${newVersion}`);
}

/**
 * Update version in iOS Expo.plist
 */
function updateExpoPlist(filePath, oldVersion, newVersion) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Update EXUpdatesRuntimeVersion
  content = content.replace(
    new RegExp(`<key>EXUpdatesRuntimeVersion</key>\\s*<string>${oldVersion.replace(/\./g, '\\.')}</string>`, 'g'),
    `<key>EXUpdatesRuntimeVersion</key>\n    <string>${newVersion}</string>`
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated ios/Planmoni/Supporting/Expo.plist: ${oldVersion} → ${newVersion}`);
}

/**
 * Main function
 */
function main() {
  const rootDir = path.resolve(__dirname, '..');
  
  // Read current version from package.json
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const oldVersion = packageJson.version;
  const newVersion = incrementVersion(oldVersion);
  
  console.log(`\n🚀 Incrementing version: ${oldVersion} → ${newVersion}\n`);
  
  try {
    // Update all files
    updateAppConfigJs(
      path.join(rootDir, 'app.config.js'),
      oldVersion,
      newVersion
    );
    
    updateAppJson(
      path.join(rootDir, 'app.json'),
      oldVersion,
      newVersion
    );
    
    updatePackageJson(
      path.join(rootDir, 'package.json'),
      oldVersion,
      newVersion
    );
    
    updatePackageLockJson(
      path.join(rootDir, 'package-lock.json'),
      oldVersion,
      newVersion
    );
    
    updateBuildGradle(
      path.join(rootDir, 'android', 'app', 'build.gradle'),
      oldVersion,
      newVersion
    );
    
    updateStringsXml(
      path.join(rootDir, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'),
      oldVersion,
      newVersion
    );
    
    updateInfoPlist(
      path.join(rootDir, 'ios', 'Planmoni', 'Info.plist'),
      oldVersion,
      newVersion
    );
    
    updateExpoPlist(
      path.join(rootDir, 'ios', 'Planmoni', 'Supporting', 'Expo.plist'),
      oldVersion,
      newVersion
    );
    
    console.log(`\n✨ Successfully incremented version to ${newVersion}!\n`);
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

// Run the script
main();
