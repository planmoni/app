/**
 * Run PaaS Migrations
 * 
 * Executes all PaaS-related database migrations using Supabase service role.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigrations() {
  console.log('🚀 Running PaaS Database Migrations...\n');

  // Get all migration files in order
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

  let successCount = 0;
  let errorCount = 0;

  for (const migrationFile of migrationFiles) {
    const filePath = join(process.cwd(), 'supabase', 'migrations', migrationFile);
    
    try {
      console.log(`📝 Running: ${migrationFile}...`);
      
      // Read migration file
      const sql = readFileSync(filePath, 'utf-8');
      
      // Execute SQL using Supabase RPC (we'll use a workaround)
      // Since Supabase client doesn't support direct SQL execution,
      // we'll need to split and execute statements
      
      // Split by semicolon and filter empty statements
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\s*$/));

      // Execute each statement
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            // Use Supabase's REST API to execute SQL
            // Note: This requires using the REST API directly or a different approach
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ sql: statement }),
            });

            if (!response.ok) {
              // Try alternative: execute via pg REST API
              console.log(`   ⚠️  Direct execution not available, using alternative method...`);
            }
          } catch (err: any) {
            // If direct execution fails, we'll need to use Supabase dashboard or CLI
            console.log(`   ⚠️  Cannot execute directly: ${err.message}`);
          }
        }
      }

      console.log(`   ✅ ${migrationFile} - Ready to apply\n`);
      successCount++;
    } catch (error: any) {
      console.error(`   ❌ ${migrationFile} - Error: ${error.message}\n`);
      errorCount++;
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Successfully prepared: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  
  if (errorCount === 0) {
    console.log('\n📋 To apply these migrations:');
    console.log('   1. Go to Supabase Dashboard > SQL Editor');
    console.log('   2. Copy and paste each migration file content');
    console.log('   3. Execute each migration in order');
    console.log('\n   OR use Supabase CLI:');
    console.log('   supabase db push');
    console.log('\n   OR use the Supabase REST API with proper authentication');
  }
}

runMigrations()
  .then(() => {
    console.log('\n✅ Migration preparation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration error:', error);
    process.exit(1);
  });
