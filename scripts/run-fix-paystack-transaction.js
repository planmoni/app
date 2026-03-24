const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Running Paystack Transaction Fix Migration...\n');
  
  try {
    // Read the SQL file
    const sqlFile = fs.readFileSync('scripts/fix-paystack-transaction-amount.sql', 'utf8');
    
    // Extract SQL statements (remove comments, split by semicolon)
    const lines = sqlFile.split('\n');
    const sqlStatements = [];
    let currentStatement = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comment-only lines
      if (trimmed.startsWith('--')) continue;
      
      // Remove inline comments
      const withoutComments = trimmed.split('--')[0].trim();
      if (withoutComments) {
        currentStatement += withoutComments + ' ';
      }
      
      // If line ends with semicolon, complete the statement
      if (trimmed.endsWith(';')) {
        if (currentStatement.trim()) {
          sqlStatements.push(currentStatement.trim());
          currentStatement = '';
        }
      }
    }
    
    const statements = sqlStatements.filter(s => s.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip SELECT statements (verification queries)
      if (statement.trim().toUpperCase().startsWith('SELECT')) {
        console.log(`📊 Verification query (${i + 1}/${statements.length}):`);
        console.log(statement.substring(0, 100) + '...\n');
        
        // For SELECT, use RPC or query
        try {
          // Try to execute as a query if it's a simple SELECT
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql_query: statement 
          }).catch(() => {
            // If RPC doesn't exist, we'll need to use a different approach
            return { data: null, error: { message: 'RPC not available' } };
          });
          
          if (error) {
            console.log('⚠️  Could not execute verification query directly');
            console.log('   You can run this manually in Supabase SQL Editor\n');
          } else if (data) {
            console.log('✅ Verification results:', JSON.stringify(data, null, 2));
          }
        } catch (err) {
          console.log('⚠️  Verification query skipped (run manually in Supabase SQL Editor)\n');
        }
        continue;
      }
      
      console.log(`🔧 Executing statement ${i + 1}/${statements.length}...`);
      console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));
      
      // For UPDATE statements, we need to use RPC or direct table operations
      if (statement.trim().toUpperCase().startsWith('UPDATE')) {
        // Parse UPDATE statement manually
        const updateMatch = statement.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i);
        
        if (updateMatch) {
          const [, table, setClause, whereClause] = updateMatch;
          
          // For transactions table
          if (table === 'transactions') {
            const amountMatch = setClause.match(/amount\s*=\s*(\d+)/i);
            const refMatch = whereClause.match(/reference\s*=\s*'([^']+)'/i);
            const amountMatch2 = whereClause.match(/amount\s*=\s*(\d+)/i);
            
            if (amountMatch && refMatch && amountMatch2) {
              const newAmount = parseFloat(amountMatch[1]);
              const reference = refMatch[1];
              const oldAmount = parseFloat(amountMatch2[1]);
              
              console.log(`   Updating transaction ${reference} from ${oldAmount} to ${newAmount}`);
              
              // First check if transaction exists and what its current amount is
              const { data: existing, error: checkError } = await supabase
                .from('transactions')
                .select('id, amount')
                .eq('reference', reference)
                .maybeSingle();
              
              if (checkError) {
                console.error(`   ❌ Error checking transaction: ${checkError.message}`);
              } else if (!existing) {
                console.log(`   ⚠️  Transaction ${reference} not found`);
              } else if (parseFloat(existing.amount) === newAmount) {
                console.log(`   ✅ Transaction already has correct amount: ${newAmount}`);
              } else {
                const { data, error } = await supabase
                  .from('transactions')
                  .update({ amount: newAmount })
                  .eq('reference', reference)
                  .select();
                
                if (error) {
                  console.error(`   ❌ Error: ${error.message}`);
                } else {
                  console.log(`   ✅ Updated transaction from ${existing.amount} to ${newAmount}`);
                }
              }
            }
          }
          // For wallets table
          else if (table === 'wallets') {
            const balanceMatch = setClause.match(/balance\s*=\s*balance\s*-\s*(\d+)/i);
            const userIdMatch = whereClause.match(/user_id\s*=\s*'([^']+)'/i);
            
            if (balanceMatch && userIdMatch) {
              const deduction = parseFloat(balanceMatch[1]);
              const userId = userIdMatch[1];
              
              console.log(`   Deducting ${deduction} from wallet for user ${userId}`);
              
              // Get current balance
              const { data: wallets, error: fetchError } = await supabase
                .from('wallets')
                .select('id, balance')
                .eq('user_id', userId);
              
              if (fetchError) {
                console.error(`   ❌ Error fetching wallet: ${fetchError.message}`);
              } else if (!wallets || wallets.length === 0) {
                console.error(`   ❌ No wallet found for user ${userId}`);
              } else {
                const wallet = wallets[0]; // Use first wallet if multiple exist
                const currentBalance = parseFloat(wallet.balance);
                const newBalance = currentBalance - deduction;
                
                console.log(`   Current balance: ${currentBalance}, Deducting: ${deduction}, New balance: ${newBalance}`);
                
                const { data, error } = await supabase
                  .from('wallets')
                  .update({ 
                    balance: newBalance,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', wallet.id)
                  .select();
                
                if (error) {
                  console.error(`   ❌ Error: ${error.message}`);
                } else {
                  console.log(`   ✅ Updated wallet balance from ${currentBalance} to ${newBalance}`);
                }
              }
            }
          }
        }
      }
      
      console.log('');
    }
    
    console.log('✅ Migration completed!\n');
    console.log('📊 Verification:');
    console.log('   Run the SELECT query from the SQL file in Supabase SQL Editor to verify the changes.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
