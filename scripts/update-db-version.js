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

async function updateSupabaseVersion() {
  require('dotenv').config();

  const { createClient } = require('@supabase/supabase-js');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    log('❌ Missing environment variables:', 'red');
    log('   Required: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY', 'yellow');
    log('   Make sure your .env file is properly configured', 'yellow');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const appJsonPath = path.join(process.cwd(), 'app.json');

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  const version = packageJson.version;
  const androidBuild = appJson.expo?.android?.versionCode || 1;
  const iosBuild = appJson.expo?.ios?.buildNumber ? parseInt(appJson.expo.ios.buildNumber) : 1;

  log('\n🔄 Updating Supabase app_versions table...', 'bright');
  log(`\n📦 Version Information:`, 'blue');
  log(`   Version: ${version}`, 'yellow');
  log(`   Android Build: ${androidBuild}`, 'yellow');
  log(`   iOS Build: ${iosBuild}`, 'yellow');

  try {
    const { data: existingVersions, error: fetchError } = await supabase
      .from('app_versions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      throw fetchError;
    }

    if (existingVersions && existingVersions.length > 0) {
      const existingVersion = existingVersions[0];
      log(`\n📊 Current Database Version:`, 'blue');
      log(`   Android: ${existingVersion.android_version} (Build ${existingVersion.android_build})`, 'yellow');
      log(`   iOS: ${existingVersion.ios_version} (Build ${existingVersion.ios_build})`, 'yellow');

      const { error: deactivateError } = await supabase
        .from('app_versions')
        .update({ is_active: false })
        .eq('id', existingVersion.id);

      if (deactivateError) {
        throw deactivateError;
      }

      log('\n   ✅ Deactivated old version record', 'green');
    }

    const androidUpdateUrl = appJson.expo?.android?.package
      ? `https://play.google.com/store/apps/details?id=${appJson.expo.android.package}`
      : 'https://play.google.com/store/apps/details?id=com.mosodi.planmoni';

    const iosUpdateUrl = appJson.expo?.ios?.bundleIdentifier
      ? `https://apps.apple.com/app/planmoni/id123456789`
      : 'https://apps.apple.com/app/planmoni/id123456789';

    const { data: newVersion, error: insertError } = await supabase
      .from('app_versions')
      .insert([
        {
          android_version: version,
          ios_version: version,
          android_build: androidBuild,
          ios_build: iosBuild,
          android_update_url: androidUpdateUrl,
          ios_update_url: iosUpdateUrl,
          update_message: `Version ${version} is now available! Update now for the latest features and improvements.`,
          force_update: false,
          is_active: true,
        },
      ])
      .select();

    if (insertError) {
      throw insertError;
    }

    log('\n✅ Database updated successfully!', 'green');
    log(`\n📱 New Active Version:`, 'blue');
    log(`   Android: ${version} (Build ${androidBuild})`, 'green');
    log(`   iOS: ${version} (Build ${iosBuild})`, 'green');
    log(`\n   Update URLs:`, 'blue');
    log(`   Android: ${androidUpdateUrl}`, 'yellow');
    log(`   iOS: ${iosUpdateUrl}`, 'yellow');

    log('\n✨ Users will now see the update notification for this version!', 'bright');
    log('');

  } catch (error) {
    log('\n❌ Error updating database:', 'red');
    log(`   ${error.message}`, 'red');
    log('\n💡 Troubleshooting:', 'yellow');
    log('   1. Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env', 'yellow');
    log('   2. Verify your Supabase connection is working', 'yellow');
    log('   3. Check that the app_versions table exists', 'yellow');
    log('');
    process.exit(1);
  }
}

log('\n🚀 Supabase Version Update Script', 'bright');
log('━'.repeat(50), 'blue');

updateSupabaseVersion();
