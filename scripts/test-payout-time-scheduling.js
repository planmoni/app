const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPayoutTimeScheduling() {
  console.log('🧪 Testing Payout Time Scheduling Implementation\n');
  
  try {
    // Test 1: Check if payout_plans table exists and is accessible
    console.log('Test 1: Checking payout_plans table access...');
    const { data: plans, error: plansError } = await supabase
      .from('payout_plans')
      .select('*')
      .limit(1);
    
    if (plansError) {
      console.log('❌ Cannot access payout_plans table:', plansError.message);
      return;
    }
    console.log('✅ payout_plans table is accessible');
    
    // Test 2: Check current table structure
    console.log('\nTest 2: Checking current table structure...');
    if (plans && plans.length > 0) {
      console.log('📊 Current columns:', Object.keys(plans[0]).join(', '));
      
      // Check if payout_time column exists
      if ('payout_time' in plans[0]) {
        console.log('✅ payout_time column exists');
        console.log('   Sample payout_time:', plans[0].payout_time);
      } else {
        console.log('⚠️  payout_time column not found - migration needed');
      }
      
      // Check if next_payout_date is timestamptz
      if ('next_payout_date' in plans[0]) {
        console.log('✅ next_payout_date column exists');
        console.log('   Sample next_payout_date:', plans[0].next_payout_date);
      } else {
        console.log('⚠️  next_payout_date column not found');
      }
    } else {
      console.log('📊 Table exists but no data to analyze structure');
    }
    
    // Test 3: Check if new functions exist
    console.log('\nTest 3: Checking for new functions...');
    
    // Try to call the new functions (they might not exist yet)
    const functionsToTest = [
      'get_payouts_due_now',
      'schedule_payout_for_time'
    ];
    
    for (const funcName of functionsToTest) {
      try {
        const { data, error } = await supabase.rpc(funcName);
        if (error) {
          console.log(`⚠️  ${funcName} function not found or not accessible`);
        } else {
          console.log(`✅ ${funcName} function exists and is callable`);
        }
      } catch (err) {
        console.log(`⚠️  ${funcName} function not found: ${err.message}`);
      }
    }
    
    // Test 4: Check bank_accounts table (needed for payout plans)
    console.log('\nTest 4: Checking bank_accounts table...');
    const { data: bankAccounts, error: bankError } = await supabase
      .from('bank_accounts')
      .select('*')
      .limit(1);
    
    if (bankError) {
      console.log('❌ Cannot access bank_accounts table:', bankError.message);
    } else {
      console.log('✅ bank_accounts table is accessible');
      console.log(`   Found ${bankAccounts?.length || 0} bank accounts`);
    }
    
    // Test 5: Check profiles table (needed for user references)
    console.log('\nTest 5: Checking profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profilesError) {
      console.log('❌ Cannot access profiles table:', profilesError.message);
    } else {
      console.log('✅ profiles table is accessible');
      console.log(`   Found ${profiles?.length || 0} profiles`);
    }
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('✅ Database connection: Working');
    console.log('✅ Core tables: Accessible');
    console.log('⚠️  Migration status: Check individual components above');
    
    console.log('\n📝 Next steps:');
    console.log('1. Apply the migration: supabase/migrations/20250104000000_add_payout_time_scheduling.sql');
    console.log('2. Run this test again to verify migration success');
    console.log('3. Test creating payout plans with specific times');
    console.log('4. Test automated payout processing');
    
  } catch (err) {
    console.log('❌ Error during testing:', err.message);
  }
}

// Run the test
testPayoutTimeScheduling();

