/**
 * Apply Remaining Migrations
 * 
 * Applies the 2 remaining migrations (Webhook Deliveries and Usage Tracking)
 * using Supabase REST API or provides instructions.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env vars
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigrationSQL(sqlContent, migrationName) {
  console.log(`\n📝 Applying: ${migrationName}...`);
  
  // Split into statements
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.match(/^--/) && !s.match(/^\/\*/));

  let applied = 0;
  let errors = [];

  // Try to execute via Supabase Management API
  // Note: This may not work if Management API is not enabled
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement.trim()) continue;

    try {
      // Attempt to execute via REST API (may require Management API)
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: statement }),
      });

      if (response.ok) {
        applied++;
      } else {
        const errorText = await response.text();
        if (errorText.includes('already exists') || errorText.includes('duplicate')) {
          applied++;
        } else {
          errors.push(`Statement ${i + 1}: ${errorText.substring(0, 100)}`);
        }
      }
    } catch (err) {
      // Direct API execution not available
      console.log(`   ⚠️  Cannot execute directly via API`);
      return false;
    }
  }

  if (errors.length === 0 && applied > 0) {
    console.log(`   ✅ Applied: ${applied} statements`);
    return true;
  }

  return false;
}

async function applyRemainingMigrations() {
  console.log('🚀 Applying Remaining Migrations...\n');
  console.log('📋 Remaining migrations:');
  console.log('   1. Webhook Deliveries (20260126122927_create_webhook_deliveries.sql)');
  console.log('   2. Usage Tracking (20260126122928_create_usage_tracking.sql)\n');

  const remainingMigrations = [
    {
      file: '20260126122927_create_webhook_deliveries.sql',
      name: 'Webhook Deliveries',
    },
    {
      file: '20260126122928_create_usage_tracking.sql',
      name: 'Usage Tracking',
    },
  ];

  const results = [];

  for (const migration of remainingMigrations) {
    const filePath = path.join(__dirname, '..', 'supabase', 'migrations', migration.file);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${migration.file}`);
      results.push({ name: migration.name, success: false });
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf-8');
    const success = await applyMigrationSQL(sql, migration.name);
    results.push({ name: migration.name, success });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Application Summary:');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
  });

  if (failed > 0) {
    console.log('\n⚠️  Some migrations could not be applied automatically.');
    console.log('\n📋 To apply manually:');
    console.log('   1. Go to Supabase Dashboard > SQL Editor');
    console.log('   2. Open: supabase/migrations/REMAINING_MIGRATIONS.sql');
    console.log('   3. Copy the SQL content');
    console.log('   4. Paste into SQL Editor and execute');
    console.log('\n   OR apply each file individually:');
    remainingMigrations.forEach((m, i) => {
      if (!results[i].success) {
        console.log(`   - ${m.file}`);
      }
    });
  } else {
    console.log('\n🎉 All remaining migrations applied successfully!');
  }
}

applyRemainingMigrations()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
