/**
 * Apply Migrations Safely
 * 
 * This script applies migrations one by one, handling errors gracefully
 * and continuing with the next migration if one fails.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n💡 Set these in your .env file or export them:');
  console.error('   export EXPO_PUBLIC_SUPABASE_URL="your-url"');
  console.error('   export SUPABASE_SERVICE_ROLE_KEY="your-key"');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const migrationFiles = [
  '20260126122920_create_partners_system.sql',
  '20260126122921_create_restricted_wallets.sql',
  '20260126122922_add_partner_context.sql',
  '20260126122923_create_policy_engine_functions.sql',
  '20260126122924_create_approval_workflows.sql',
  '20260126122925_create_audit_ledger.sql',
  '20260126122926_create_ledger_functions.sql',
  '20260126122927_create_webhook_deliveries.sql',
  '20260126122928_create_usage_tracking.sql',
];

async function applyMigration(fileName) {
  const filePath = path.join(__dirname, '..', 'supabase', 'migrations', fileName);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Migration file not found: ${fileName}`);
    return false;
  }

  const sql = fs.readFileSync(filePath, 'utf-8');
  
  console.log(`\n📝 Applying: ${fileName}`);
  console.log('─'.repeat(60));
  
  // Split SQL into statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.match(/^--/) && !s.match(/^\/\*/));

  let successCount = 0;
  let errorCount = 0;

  for (const statement of statements) {
    if (statement.trim()) {
      try {
        // Use Supabase REST API to execute SQL
        // Note: This requires Management API access
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ query: statement }),
        });

        if (response.ok) {
          successCount++;
        } else {
          const errorText = await response.text();
          // Some errors are expected (like "already exists")
          if (errorText.includes('already exists') || errorText.includes('duplicate')) {
            successCount++;
            console.log(`   ⚠️  Statement skipped (already exists)`);
          } else {
            errorCount++;
            console.log(`   ❌ Error: ${errorText.substring(0, 100)}`);
          }
        }
      } catch (err) {
        // If direct execution fails, provide instructions
        console.log(`   ⚠️  Cannot execute directly via API`);
        console.log(`   💡 Please apply this migration via Supabase Dashboard SQL Editor`);
        return false;
      }
    }
  }

  if (errorCount === 0) {
    console.log(`   ✅ Migration applied: ${successCount} statements executed`);
    return true;
  } else {
    console.log(`   ⚠️  Migration partially applied: ${successCount} succeeded, ${errorCount} failed`);
    return false;
  }
}

async function applyAllMigrations() {
  console.log('🚀 Starting Safe Migration Application...\n');
  console.log(`📋 Found ${migrationFiles.length} migration files\n`);

  const results = {
    applied: [],
    failed: [],
    skipped: [],
  };

  for (const fileName of migrationFiles) {
    const success = await applyMigration(fileName);
    
    if (success) {
      results.applied.push(fileName);
    } else {
      results.failed.push(fileName);
    }
    
    // Small delay between migrations
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Successfully applied: ${results.applied.length}`);
  results.applied.forEach(file => console.log(`   ✅ ${file}`));
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Failed or needs manual application: ${results.failed.length}`);
    results.failed.forEach(file => console.log(`   ❌ ${file}`));
    console.log('\n💡 To apply failed migrations:');
    console.log('   1. Go to Supabase Dashboard > SQL Editor');
    console.log('   2. Copy the SQL from each failed migration file');
    console.log('   3. Execute in order');
  }

  console.log('\n' + '='.repeat(60));
  
  if (results.failed.length === 0) {
    console.log('🎉 All migrations applied successfully!');
  } else {
    console.log('⚠️  Some migrations need manual application');
    console.log('📖 See docs/PAAS_MIGRATIONS_GUIDE.md for instructions');
  }
}

applyAllMigrations()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration error:', error);
    process.exit(1);
  });
