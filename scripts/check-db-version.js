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
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

async function checkDatabaseVersion() {
  require('dotenv').config();

  const { createClient } = require('@supabase/supabase-js');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    log('❌ Missing environment variables:', 'red');
    log('   Required: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY', 'yellow');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const appJsonPath = path.join(process.cwd(), 'app.json');

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

  const localVersion = packageJson.version;
  const localAndroidBuild = appJson.expo?.android?.versionCode || 1;
  const localIosBuild = appJson.expo?.ios?.buildNumber ? parseInt(appJson.expo.ios.buildNumber) : 1;

  log('\n🔍 Checking version sync status...', 'bright');
  log('━'.repeat(50), 'blue');

  try {
    const { data: dbVersion, error } = await supabase
      .from('app_versions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        log('\n⚠️  No active version found in database', 'yellow');
        log('\n💡 This is normal for a new project. Run this command after first app store submission:', 'cyan');
        log('   npm run update-db-version', 'yellow');
        log('');
        process.exit(0);
      }
      throw error;
    }

    log('\n📦 Local Configuration:', 'blue');
    log(`   Version: ${localVersion}`, 'yellow');
    log(`   Android Build: ${localAndroidBuild}`, 'yellow');
    log(`   iOS Build: ${localIosBuild}`, 'yellow');

    log('\n🗄️  Database Version:', 'blue');
    log(`   Android: ${dbVersion.android_version} (Build ${dbVersion.android_build})`, 'yellow');
    log(`   iOS: ${dbVersion.ios_version} (Build ${dbVersion.ios_build})`, 'yellow');

    const versionMatch =
      localVersion === dbVersion.android_version &&
      localVersion === dbVersion.ios_version;

    const buildMatch =
      localAndroidBuild === dbVersion.android_build &&
      localIosBuild === dbVersion.ios_build;

    log('\n📊 Sync Status:', 'blue');

    if (versionMatch && buildMatch) {
      log('   ✅ Local and database versions are in sync', 'green');
      log('\n✨ Everything is up to date!', 'bright');
    } else if (localAndroidBuild > dbVersion.android_build || localIosBuild > dbVersion.ios_build) {
      log('   ⚠️  Local version is AHEAD of database', 'yellow');
      log('\n💡 Next Steps:', 'cyan');
      log('   1. If you just bumped the version, this is expected', 'yellow');
      log('   2. Build and submit to app stores', 'yellow');
      log('   3. After submission, run: npm run update-db-version', 'yellow');
    } else if (localAndroidBuild < dbVersion.android_build || localIosBuild < dbVersion.ios_build) {
      log('   ❌ Local version is BEHIND database', 'red');
      log('\n⚠️  Warning: Database has a newer version than your local config!', 'yellow');
      log('\n💡 Possible causes:', 'cyan');
      log('   1. Someone else updated the app', 'yellow');
      log('   2. You need to pull latest changes from git', 'yellow');
      log('   3. Database was manually updated', 'yellow');
      log('\n   Run: git pull && npm install', 'yellow');
    } else {
      log('   ⚠️  Version numbers match but builds differ', 'yellow');
      log('\n💡 Consider running: npm run version:bump patch', 'yellow');
    }

    log('');

  } catch (error) {
    log('\n❌ Error checking database:', 'red');
    log(`   ${error.message}`, 'red');
    process.exit(1);
  }
}

checkDatabaseVersion();
