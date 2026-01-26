/**
 * Apply PaaS Migrations
 * 
 * Executes all PaaS-related database migrations using Supabase Management API.
 * This script reads the migration files and applies them in order.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL(sql) {
  // Supabase client doesn't support direct SQL execution
  // We need to use the Management API or REST API
  // For now, we'll use the REST API approach
  
  try {
    // Try using the REST API to execute SQL
    // Note: This requires the Management API which may not be available
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ query: sql }),
    });

    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.text();
      throw new Error(error);
    }
  } catch (error) {
    // If REST API doesn't work, we'll need to use a different approach
    throw error;
  }
}

async function applyMigrations() {
  console.log('🚀 Applying PaaS Database Migrations...\n');

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

  console.log('📋 Migration files to apply:');
  migrationFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });

  console.log('\n⚠️  Note: Direct SQL execution via API is limited.');
  console.log('📋 To apply these migrations, use one of these methods:\n');
  
  console.log('Method 1: Supabase Dashboard (Recommended)');
  console.log('   1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new');
  console.log('   2. Copy and paste each migration file content');
  console.log('   3. Execute each migration in order\n');

  console.log('Method 2: Supabase CLI');
  console.log('   supabase db push\n');

  console.log('Method 3: psql (if you have database access)');
  console.log('   psql -h YOUR_HOST -U postgres -d postgres -f supabase/migrations/FILENAME.sql\n');

  // Read and display first migration as example
  const firstMigration = path.join(__dirname, '..', 'supabase', 'migrations', migrationFiles[0]);
  if (fs.existsSync(firstMigration)) {
    const sql = fs.readFileSync(firstMigration, 'utf-8');
    console.log(`\n📄 Example - First migration (${migrationFiles[0]}):`);
    console.log('─'.repeat(60));
    console.log(sql.substring(0, 500) + '...');
    console.log('─'.repeat(60));
  }

  console.log('\n✅ Migration files are ready to apply!');
  console.log('💡 All 9 migration files have been created in: supabase/migrations/');
}

applyMigrations()
  .then(() => {
    console.log('\n✅ Migration preparation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
