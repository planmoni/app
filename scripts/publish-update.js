#!/usr/bin/env node

/**
 * Helper script for publishing EAS Updates
 * 
 * Usage:
 *   node scripts/publish-update.js preview "Update message"
 *   node scripts/publish-update.js production "Update message"
 */

const { execSync } = require('child_process');
const path = require('path');

// Get command line arguments
const args = process.argv.slice(2);
const channel = args[0] || 'production';
const message = args[1] || `Update: ${new Date().toISOString()}`;

// Validate channel
if (!['preview', 'production'].includes(channel)) {
  console.error('❌ Invalid channel. Use "preview" or "production"');
  process.exit(1);
}

console.log(`🚀 Publishing update to ${channel} channel...`);
console.log(`📝 Message: ${message}`);

try {
  // Run EAS update command
  const command = `eas update --branch ${channel} --message "${message}"`;
  console.log(`\n📦 Running: ${command}\n`);
  
  execSync(command, {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  });
  
  console.log(`\n✅ Update published successfully to ${channel} channel!`);
  console.log(`\n📱 Users will receive this update automatically on next app launch.`);
} catch (error) {
  console.error('\n❌ Failed to publish update:', error.message);
  process.exit(1);
}
