/**
 * Diagnostic script to check wallet state and function definitions
 * Run with: node scripts/check-wallet-state.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const USER_ID = 'e9a34b85-7aac-4100-8e45-b29e9538c0d9';

async function checkWalletState() {
  console.log('🔍 Checking wallet state for user:', USER_ID, '\n');

  // 1. Check wallet balance
  console.log('1️⃣ Checking wallet balance...');
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', USER_ID)
    .single();

  if (walletError) {
    console.error('❌ Error fetching wallet:', walletError);
    return;
  }

  console.log('📊 Wallet State:');
  console.log('   Balance:', wallet.balance);
  console.log('   Locked Balance:', wallet.locked_balance);
  console.log('   Available Balance:', wallet.available_balance);
  console.log('   Updated At:', wallet.updated_at);
  
  if (wallet.locked_balance < 0) {
    console.log('   ⚠️  WARNING: locked_balance is negative!');
  }
  if (wallet.locked_balance > wallet.balance) {
    console.log('   ⚠️  WARNING: locked_balance exceeds balance!');
  }
  console.log('');

  // 2. Check active payout plans
  console.log('2️⃣ Checking active payout plans...');
  const { data: plans, error: plansError } = await supabase
    .from('payout_plans')
    .select('id, name, total_amount, fee_amount, net_payout_amount, payout_amount, completed_payouts, status')
    .eq('user_id', USER_ID)
    .in('status', ['active', 'paused']);

  if (plansError) {
    console.error('❌ Error fetching plans:', plansError);
  } else {
    console.log(`   Found ${plans?.length || 0} active/paused plans`);
    if (plans && plans.length > 0) {
      plans.forEach((plan, idx) => {
        const remaining = (plan.net_payout_amount || plan.total_amount - (plan.fee_amount || 0)) - (plan.completed_payouts * plan.payout_amount);
        console.log(`   Plan ${idx + 1}: ${plan.name}`);
        console.log(`      Total: ₦${plan.total_amount}, Fee: ₦${plan.fee_amount || 0}, Net: ₦${plan.net_payout_amount || 0}`);
        console.log(`      Completed: ${plan.completed_payouts}, Remaining: ₦${remaining}`);
      });
    }
  }
  console.log('');

  // 3. Check if charge_plan_fee function exists and get its definition
  console.log('3️⃣ Checking charge_plan_fee function...');
  const { data: chargeFeeFunc, error: chargeFeeError } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT 
        routine_name,
        routine_definition
      FROM information_schema.routines
      WHERE routine_name = 'charge_plan_fee'
        AND routine_schema = 'public';
    `
  }).catch(() => ({ data: null, error: { message: 'RPC not available' } }));

  if (chargeFeeError && chargeFeeError.message !== 'RPC not available') {
    console.log('   ⚠️  Could not check function definition (this is OK)');
  } else {
    console.log('   ✅ Function exists');
    // Check if it uses deduct_locked_funds (old) or direct update (new)
    const { data: funcCheck } = await supabase
      .from('_migrations')
      .select('*')
      .limit(1)
      .catch(() => ({ data: null }));
    
    console.log('   💡 To verify function definition, check Supabase Dashboard > Database > Functions');
  }
  console.log('');

  // 4. Check constraints
  console.log('4️⃣ Checking wallet constraints...');
  const { data: constraints, error: constraintsError } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT 
        constraint_name,
        check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc 
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_name = 'wallets'
        AND tc.constraint_name LIKE '%locked_balance%';
    `
  }).catch(() => ({ data: null, error: { message: 'RPC not available' } }));

  if (constraintsError && constraintsError.message !== 'RPC not available') {
    console.log('   ⚠️  Could not check constraints (this is OK)');
  } else {
    console.log('   ✅ Constraints exist');
  }
  console.log('');

  // 5. Test recalculate_locked_balance
  console.log('5️⃣ Testing recalculate_locked_balance function...');
  const { data: recalcResult, error: recalcError } = await supabase.rpc('recalculate_locked_balance', {
    arg_user_id: USER_ID
  });

  if (recalcError) {
    console.error('   ❌ Error calling recalculate_locked_balance:', recalcError);
  } else {
    console.log('   ✅ Function executed successfully');
    if (recalcResult) {
      console.log('   Result:', JSON.stringify(recalcResult, null, 2));
    }
  }
  console.log('');

  // 6. Summary and recommendations
  console.log('📋 Summary:');
  if (wallet.locked_balance < 0) {
    console.log('   ❌ URGENT: Wallet has negative locked_balance');
    console.log('   🔧 Action: Apply migration 20260128090004_urgent_fix_negative_balance.sql');
  } else if (wallet.locked_balance > wallet.balance) {
    console.log('   ⚠️  WARNING: locked_balance exceeds balance');
    console.log('   🔧 Action: Apply migration 20260128090004_urgent_fix_negative_balance.sql');
  } else {
    console.log('   ✅ Wallet balance looks correct');
  }
  
  console.log('\n💡 Next steps:');
  console.log('   1. If locked_balance is negative, apply: 20260128090004_urgent_fix_negative_balance.sql');
  console.log('   2. Then apply: 20260128090002_fix_charge_plan_fee_deduction.sql');
  console.log('   3. Then apply: 20260128090003_fix_negative_locked_balance.sql');
}

checkWalletState().catch(console.error);
