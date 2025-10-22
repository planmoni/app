const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function removePayoutTimeColumn() {
  console.log('🧹 Removing Redundant payout_time Column...\n');
  
  try {
    // Read the cleanup migration file
    const migrationSQL = fs.readFileSync('supabase/migrations/20250104000002_remove_redundant_payout_time.sql', 'utf8');
    
    console.log('📝 Cleanup migration file loaded successfully');
    console.log('📊 Migration size:', migrationSQL.length, 'characters');
    
    console.log('\n🔧 This migration will:');
    console.log('   ✅ Drop the redundant payout_time column');
    console.log('   ✅ Update all functions to work with next_payout_date timestamptz');
    console.log('   ✅ Add helper functions to extract/set time from next_payout_date');
    console.log('   ✅ Remove unnecessary indexes');
    console.log('   ✅ Preserve all existing functionality');
    
    console.log('\n💡 Why this makes sense:');
    console.log('   - next_payout_date (timestamptz) already contains time information');
    console.log('   - Having both columns is redundant and can cause confusion');
    console.log('   - Simplifies the data model and reduces storage');
    console.log('   - All time operations can be done on the single timestamptz column');
    
    console.log('\n📋 To apply this cleanup:');
    console.log('   1. Copy the SQL from: supabase/migrations/20250104000002_remove_redundant_payout_time.sql');
    console.log('   2. Paste it in your Supabase Dashboard SQL Editor');
    console.log('   3. Execute the SQL');
    console.log('   4. Run verification: node scripts/test-payout-time-scheduling.js');
    
    console.log('\n🛡️  Safety features:');
    console.log('   - Checks if column exists before dropping');
    console.log('   - Preserves all existing data and functionality');
    console.log('   - Updates all related functions to work with the new structure');
    console.log('   - Provides helper functions for time operations');
    
    console.log('\n🚀 Ready to clean up! The redundant column removal is prepared.');
    
  } catch (err) {
    console.log('❌ Error preparing cleanup migration:', err.message);
  }
}

removePayoutTimeColumn();

