/**
 * Check and Fix Migrations
 * 
 * Checks which migrations have been applied and fixes any issues,
 * then applies remaining migrations.
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

async function checkTableExists(tableName) {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);
    
    if (error && error.code === '42P01') {
      return false; // Table doesn't exist
    }
    return true; // Table exists or we can query it
  } catch (err) {
    return false;
  }
}

async function checkColumnExists(tableName, columnName) {
  try {
    const { error } = await supabase
      .from(tableName)
      .select(columnName)
      .limit(0);
    
    if (error && error.message.includes(columnName)) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function checkAndFixMigrations() {
  console.log('🔍 Checking Migration Status...\n');

  const migrationStatus = {
    '20260126122920_create_partners_system.sql': {
      tables: ['partners', 'partner_api_keys', 'partner_users', 'partner_settings'],
      applied: false,
    },
    '20260126122921_create_restricted_wallets.sql': {
      tables: ['wallet_restrictions', 'wallet_policies'],
      columns: ['wallets.partner_id', 'wallets.is_restricted', 'wallets.requires_approval', 'wallets.policy_id'],
      applied: false,
    },
    '20260126122922_add_partner_context.sql': {
      columns: ['payout_plans.partner_id', 'transactions.partner_id', 'bank_accounts.partner_id'],
      applied: false,
    },
    '20260126122923_create_policy_engine_functions.sql': {
      functions: ['check_wallet_restrictions', 'get_required_approvals', 'evaluate_wallet_policy'],
      applied: false,
    },
    '20260126122924_create_approval_workflows.sql': {
      tables: ['approval_workflows', 'approval_requests', 'approval_actions'],
      applied: false,
    },
    '20260126122925_create_audit_ledger.sql': {
      tables: ['audit_ledger', 'audit_events'],
      applied: false,
    },
    '20260126122926_create_ledger_functions.sql': {
      functions: ['append_ledger_entry', 'verify_ledger_integrity', 'get_ledger_history', 'calculate_entry_hash'],
      applied: false,
    },
    '20260126122927_create_webhook_deliveries.sql': {
      tables: ['webhook_configurations', 'webhook_deliveries'],
      applied: false,
    },
    '20260126122928_create_usage_tracking.sql': {
      tables: ['api_usage_logs', 'partner_rate_limits'],
      functions: ['check_rate_limit'],
      applied: false,
    },
  };

  // Check each migration
  for (const [migrationFile, status] of Object.entries(migrationStatus)) {
    console.log(`Checking: ${migrationFile}...`);
    
    let allTablesExist = true;
    let allColumnsExist = true;
    let allFunctionsExist = true;

    // Check tables
    if (status.tables) {
      for (const table of status.tables) {
        const exists = await checkTableExists(table);
        if (!exists) {
          allTablesExist = false;
          console.log(`  ❌ Table missing: ${table}`);
        } else {
          console.log(`  ✅ Table exists: ${table}`);
        }
      }
    }

    // Check columns
    if (status.columns) {
      for (const col of status.columns) {
        const [table, column] = col.split('.');
        const exists = await checkColumnExists(table, column);
        if (!exists) {
          allColumnsExist = false;
          console.log(`  ❌ Column missing: ${col}`);
        } else {
          console.log(`  ✅ Column exists: ${col}`);
        }
      }
    }

    // Check functions (simplified - try to call them)
    if (status.functions) {
      for (const func of status.functions) {
        try {
          // Try to call with dummy params
          await supabase.rpc(func, {});
          console.log(`  ✅ Function exists: ${func}`);
          allFunctionsExist = true;
        } catch (err) {
          // Function might exist but params wrong, or doesn't exist
          if (err.message.includes('function') && err.message.includes('does not exist')) {
            allFunctionsExist = false;
            console.log(`  ❌ Function missing: ${func}`);
          } else {
            // Function exists, just wrong params
            console.log(`  ✅ Function exists: ${func}`);
            allFunctionsExist = true;
          }
        }
      }
    }

    // Determine if migration is applied
    status.applied = allTablesExist && allColumnsExist && allFunctionsExist;
    
    if (status.applied) {
      console.log(`  ✅ Migration applied: ${migrationFile}\n`);
    } else {
      console.log(`  ⚠️  Migration not fully applied: ${migrationFile}\n`);
    }
  }

  // Summary
  console.log('\n📊 Migration Status Summary:');
  console.log('='.repeat(60));
  
  const applied = Object.values(migrationStatus).filter(m => m.applied).length;
  const total = Object.keys(migrationStatus).length;
  
  Object.entries(migrationStatus).forEach(([file, status]) => {
    const icon = status.applied ? '✅' : '❌';
    console.log(`${icon} ${file}`);
  });

  console.log(`\n✅ Applied: ${applied}/${total}`);
  console.log(`❌ Pending: ${total - applied}/${total}`);

  // Identify issues
  console.log('\n🔧 Potential Issues to Fix:\n');

  // Check if partners table exists (required for other migrations)
  const partnersExists = await checkTableExists('partners');
  if (!partnersExists) {
    console.log('⚠️  CRITICAL: partners table does not exist!');
    console.log('   Migration 1 (create_partners_system.sql) must be applied first.\n');
  }

  // Check foreign key dependencies
  const walletsPartnerIdExists = await checkColumnExists('wallets', 'partner_id');
  if (walletsPartnerIdExists && !partnersExists) {
    console.log('⚠️  WARNING: wallets.partner_id exists but partners table does not!');
    console.log('   This will cause foreign key constraint errors.\n');
  }

  console.log('\n📋 Next Steps:');
  console.log('1. Apply migrations in order starting from the first unapplied one');
  console.log('2. If you see foreign key errors, make sure partners table exists first');
  console.log('3. Use Supabase Dashboard SQL Editor for best error visibility');
  console.log('4. Run this script again to verify after applying migrations\n');

  return migrationStatus;
}

checkAndFixMigrations()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
