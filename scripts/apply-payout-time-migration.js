const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🚀 Starting Payout Time Scheduling Migration...\n');
  
  try {
    // Step 1: Add payout_time column
    console.log('Step 1: Adding payout_time column...');
    const { error: step1Error } = await supabase
      .from('payout_plans')
      .select('id')
      .limit(1);
    
    if (step1Error) {
      console.log('❌ Cannot access payout_plans table:', step1Error.message);
      return;
    }
    
    // Since we can't execute DDL directly, let's create a function to add the column
    console.log('✅ payout_plans table is accessible');
    
    // Step 2: Test if we can create a simple function
    console.log('\nStep 2: Testing function creation...');
    
    // Let's try to create a simple test function first
    const testFunctionSQL = `
      CREATE OR REPLACE FUNCTION test_payout_time_function()
      RETURNS text AS $$
      BEGIN
        RETURN 'Payout time function test successful';
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    // We'll need to use a different approach since we can't execute DDL
    console.log('⚠️  Direct DDL execution not available through client');
    console.log('📋 Migration SQL has been created and saved to:');
    console.log('   supabase/migrations/20250104000000_add_payout_time_scheduling.sql');
    console.log('\n📝 To apply this migration, you can:');
    console.log('   1. Use the Supabase Dashboard SQL Editor');
    console.log('   2. Use the Supabase CLI: supabase db push');
    console.log('   3. Copy the SQL and run it manually');
    
    console.log('\n🔧 Migration includes:');
    console.log('   ✅ Add payout_time column (time type, default 09:00:00)');
    console.log('   ✅ Update next_payout_date to timestamptz for exact scheduling');
    console.log('   ✅ Update processing functions to handle time-based scheduling');
    console.log('   ✅ Add indexes for better performance');
    console.log('   ✅ Add helper functions for time-based payout management');
    
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

applyMigration();
