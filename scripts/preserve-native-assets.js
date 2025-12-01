#!/usr/bin/env node

/**
 * Script to backup and restore native assets (res files, app icons) 
 * before and after prebuild to prevent them from being overwritten
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKUP_DIR = path.join(__dirname, '..', '.native-assets-backup');
const ANDROID_RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const ANDROID_ICONS = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'mipmap-*');
const IOS_ASSETS = path.join(__dirname, '..', 'ios', 'Planmoni', 'Images.xcassets');

function backupAssets() {
  console.log('📦 Backing up native assets...');
  
  // Create backup directory
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Backup Android res files
  if (fs.existsSync(ANDROID_RES)) {
    const androidBackup = path.join(BACKUP_DIR, 'android-res');
    if (fs.existsSync(androidBackup)) {
      fs.rmSync(androidBackup, { recursive: true, force: true });
    }
    fs.cpSync(ANDROID_RES, androidBackup, { recursive: true });
    console.log('✅ Backed up Android res files');
  }

  // Backup iOS assets
  if (fs.existsSync(IOS_ASSETS)) {
    const iosBackup = path.join(BACKUP_DIR, 'ios-assets');
    if (fs.existsSync(iosBackup)) {
      fs.rmSync(iosBackup, { recursive: true, force: true });
    }
    fs.cpSync(IOS_ASSETS, iosBackup, { recursive: true });
    console.log('✅ Backed up iOS assets');
  }

  console.log('✅ Backup complete!');
}

function restoreAssets() {
  console.log('📦 Restoring native assets...');
  
  const androidBackup = path.join(BACKUP_DIR, 'android-res');
  const iosBackup = path.join(BACKUP_DIR, 'ios-assets');

  // Restore Android res files
  if (fs.existsSync(androidBackup) && fs.existsSync(ANDROID_RES)) {
    // Merge backup with existing (don't overwrite, just restore missing files)
    const restoreDir = (src, dest) => {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          restoreDir(srcPath, destPath);
        } else {
          // Only copy if file doesn't exist or backup is newer
          if (!fs.existsSync(destPath) || fs.statSync(srcPath).mtime > fs.statSync(destPath).mtime) {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      }
    };
    restoreDir(androidBackup, ANDROID_RES);
    console.log('✅ Restored Android res files');
  }

  // Restore iOS assets
  if (fs.existsSync(iosBackup) && fs.existsSync(IOS_ASSETS)) {
    const restoreDir = (src, dest) => {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          restoreDir(srcPath, destPath);
        } else {
          if (!fs.existsSync(destPath) || fs.statSync(srcPath).mtime > fs.statSync(destPath).mtime) {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      }
    };
    restoreDir(iosBackup, IOS_ASSETS);
    console.log('✅ Restored iOS assets');
  }

  console.log('✅ Restore complete!');
}

const command = process.argv[2];

if (command === 'backup') {
  backupAssets();
} else if (command === 'restore') {
  restoreAssets();
} else {
  console.log('Usage: node scripts/preserve-native-assets.js [backup|restore]');
  process.exit(1);
}

