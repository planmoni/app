/**
 * Check Applied Migrations and Generate Remaining SQL
 * 
 * Checks which migrations have been applied and generates SQL
 * for the remaining ones that can be applied via Supabase Dashboard.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to load from .env if available (optional)
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
  // dotenv not available, use environment variables directly
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n💡 Options:');
  console.error('   1. Set environment variables');
  console.error('   2. Create .env file with these values');
  console.error('   3. Or provide them when running:');
  console.error('      EXPO_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/check-and-apply-remaining.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const migrationFiles = [
  { file: '20260126122920_create_partners_system.sql', name: 'Partners System' },
  { file: '20260126122921_create_restricted_wallets.sql', name: 'Restricted Wallets' },
  { file: '20260126122922_add_partner_context.sql', name: 'Partner Context' },
  { file: '20260126122923_create_policy_engine_functions.sql', name: 'Policy Engine Functions' },
  { file: '20260126122924_create_approval_workflows.sql', name: 'Approval Workflows' },
  { file: '20260126122925_create_audit_ledger.sql', name: 'Audit Ledger' },
  { file: '20260126122926_create_ledger_functions.sql', name: 'Ledger Functions' },
  { file: '20260126122927_create_webhook_deliveries.sql', name: 'Webhook Deliveries' },
  { file: '20260126122928_create_usage_tracking.sql', name: 'Usage Tracking' },
];

async function checkTableExists(tableName) {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);
    
    return !(error && error.code === '42P01');
  } catch {
    return false;
  }
}

async function checkColumnExists(tableName, columnName) {
  try {
    const { error } = await supabase
      .from(tableName)
      .select(columnName)
      .limit(0);
    
    return !(error && error.message.includes(columnName));
  } catch {
    return false;
  }
}

async function checkFunctionExists(functionName) {
  try {
    // Try to call with dummy params - if it errors with "does not exist", it's missing
    await supabase.rpc(functionName, {});
    return true;
  } catch (err) {
    if (err.message.includes('does not exist')) {
      return false;
    }
    // Function exists but params wrong
    return true;
  }
}

async function checkMigrationStatus() {
  console.log('🔍 Checking Migration Status...\n');

  const status = {
    '20260126122920_create_partners_system.sql': {
      check: async () => {
        const partners = await checkTableExists('partners');
        const apiKeys = await checkTableExists('partner_api_keys');
        const users = await checkTableExists('partner_users');
        const settings = await checkTableExists('partner_settings');
        return partners && apiKeys && users && settings;
      },
    },
    '20260126122921_create_restricted_wallets.sql': {
      check: async () => {
        const restrictions = await checkTableExists('wallet_restrictions');
        const policies = await checkTableExists('wallet_policies');
        const partnerId = await checkColumnExists('wallets', 'partner_id');
        const isRestricted = await checkColumnExists('wallets', 'is_restricted');
        return restrictions && policies && partnerId && isRestricted;
      },
    },
    '20260126122922_add_partner_context.sql': {
      check: async () => {
        const payoutPlans = await checkColumnExists('payout_plans', 'partner_id');
        const transactions = await checkColumnExists('transactions', 'partner_id');
        const bankAccounts = await checkColumnExists('bank_accounts', 'partner_id');
        return payoutPlans && transactions && bankAccounts;
      },
    },
    '20260126122923_create_policy_engine_functions.sql': {
      check: async () => {
        const checkRestrictions = await checkFunctionExists('check_wallet_restrictions');
        const getApprovals = await checkFunctionExists('get_required_approvals');
        const evaluatePolicy = await checkFunctionExists('evaluate_wallet_policy');
        return checkRestrictions && getApprovals && evaluatePolicy;
      },
    },
    '20260126122924_create_approval_workflows.sql': {
      check: async () => {
        const workflows = await checkTableExists('approval_workflows');
        const requests = await checkTableExists('approval_requests');
        const actions = await checkTableExists('approval_actions');
        return workflows && requests && actions;
      },
    },
    '20260126122925_create_audit_ledger.sql': {
      check: async () => {
        const ledger = await checkTableExists('audit_ledger');
        const events = await checkTableExists('audit_events');
        return ledger && events;
      },
    },
    '20260126122926_create_ledger_functions.sql': {
      check: async () => {
        const append = await checkFunctionExists('append_ledger_entry');
        const verify = await checkFunctionExists('verify_ledger_integrity');
        const history = await checkFunctionExists('get_ledger_history');
        return append && verify && history;
      },
    },
    '20260126122927_create_webhook_deliveries.sql': {
      check: async () => {
        const configs = await checkTableExists('webhook_configurations');
        const deliveries = await checkTableExists('webhook_deliveries');
        return configs && deliveries;
      },
    },
    '20260126122928_create_usage_tracking.sql': {
      check: async () => {
        const logs = await checkTableExists('api_usage_logs');
        const limits = await checkTableExists('partner_rate_limits');
        const checkLimit = await checkFunctionExists('check_rate_limit');
        return logs && limits && checkLimit;
      },
    },
  };

  const results = {};
  const applied = [];
  const pending = [];

  for (const migration of migrationFiles) {
    const fileName = migration.file;
    console.log(`Checking: ${migration.name}...`);
    
    const isApplied = await status[fileName].check();
    results[fileName] = isApplied;
    
    if (isApplied) {
      console.log(`  ✅ Applied\n`);
      applied.push(fileName);
    } else {
      console.log(`  ❌ Not applied\n`);
      pending.push(fileName);
    }
  }

  return { results, applied, pending };
}

async function generateRemainingSQL() {
  const { applied, pending } = await checkMigrationStatus();

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Status Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Applied: ${applied.length}/${migrationFiles.length}`);
  console.log(`❌ Pending: ${pending.length}/${migrationFiles.length}`);
  console.log('='.repeat(60));

  if (pending.length === 0) {
    console.log('\n🎉 All migrations have been applied!');
    return;
  }

  console.log('\n📋 Remaining Migrations to Apply:\n');
  pending.forEach((file, index) => {
    const migration = migrationFiles.find(m => m.file === file);
    console.log(`${index + 1}. ${migration.name} (${file})`);
  });

  // Generate combined SQL for remaining migrations
  console.log('\n📝 Generating SQL for remaining migrations...\n');
  
  const combinedSQL = [];
  for (const fileName of pending) {
    const filePath = path.join(__dirname, '..', 'supabase', 'migrations', fileName);
    if (fs.existsSync(filePath)) {
      const sql = fs.readFileSync(filePath, 'utf-8');
      const migration = migrationFiles.find(m => m.file === fileName);
      combinedSQL.push(`-- ========================================`);
      combinedSQL.push(`-- Migration: ${migration.name}`);
      combinedSQL.push(`-- File: ${fileName}`);
      combinedSQL.push(`-- ========================================`);
      combinedSQL.push(sql);
      combinedSQL.push('');
    }
  }

  // Save to file
  const outputPath = path.join(__dirname, '..', 'supabase', 'migrations', 'REMAINING_MIGRATIONS.sql');
  fs.writeFileSync(outputPath, combinedSQL.join('\n'));
  
  console.log(`✅ Combined SQL saved to: ${outputPath}`);
  console.log('\n📋 To apply remaining migrations:');
  console.log('   1. Go to Supabase Dashboard > SQL Editor');
  console.log('   2. Open the file: supabase/migrations/REMAINING_MIGRATIONS.sql');
  console.log('   3. Copy and paste into SQL Editor');
  console.log('   4. Execute');
  console.log('\n   OR apply each migration file individually in order\n');

  // Also show first few lines of first pending migration
  if (pending.length > 0) {
    const firstPending = pending[0];
    const filePath = path.join(__dirname, '..', 'supabase', 'migrations', firstPending);
    const sql = fs.readFileSync(filePath, 'utf-8');
    console.log(`\n📄 Preview of first pending migration (${firstPending}):`);
    console.log('─'.repeat(60));
    console.log(sql.substring(0, 500));
    console.log('...');
    console.log('─'.repeat(60));
  }
}

generateRemainingSQL()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
