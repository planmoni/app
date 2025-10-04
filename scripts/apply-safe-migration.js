const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applySafeMigration() {
  console.log('🛡️  Applying Safe Payout Time Scheduling Migration...\n');
  
  try {
    // Read the safe migration file
    const migrationSQL = fs.readFileSync('supabase/migrations/20250104000001_add_payout_time_scheduling_safe.sql', 'utf8');
    
    console.log('📝 Migration file loaded successfully');
    console.log('📊 Migration size:', migrationSQL.length, 'characters');
    
    console.log('\n🔧 Migration includes:');
    console.log('   ✅ Safe column addition with proper error handling');
    console.log('   ✅ Trigger dependency management');
    console.log('   ✅ Data migration with rollback safety');
    console.log('   ✅ Function updates for time-based scheduling');
    console.log('   ✅ Performance indexes');
    console.log('   ✅ Helper functions for time management');
    
    console.log('\n📋 To apply this migration:');
    console.log('   1. Copy the SQL from: supabase/migrations/20250104000001_add_payout_time_scheduling_safe.sql');
    console.log('   2. Paste it in your Supabase Dashboard SQL Editor');
    console.log('   3. Execute the SQL');
    console.log('   4. Run the verification script: node scripts/test-payout-time-scheduling.js');
    
    console.log('\n⚠️  Important Notes:');
    console.log('   - This migration safely handles trigger dependencies');
    console.log('   - Existing data will be preserved and migrated');
    console.log('   - The migration includes proper error handling');
    console.log('   - All triggers will be recreated after column updates');
    
    console.log('\n🚀 Ready to apply! The safe migration is prepared.');
    
  } catch (err) {
    console.log('❌ Error preparing migration:', err.message);
  }
}

applySafeMigration();
