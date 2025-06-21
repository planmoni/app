import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to ensure JSON response
function createJsonResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Verify user authentication
async function verifyAuth(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    return data.user;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

// Process emergency withdrawal
export async function POST(request: Request) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Get withdrawal data from request body
    const { 
      planId, 
      option, 
      amount, 
      feeAmount, 
      netAmount 
    } = await request.json();

    if (!planId || !option || !amount || !netAmount) {
      return createJsonResponse({ error: 'Missing required parameters' }, 400);
    }

    // Convert string amounts to numbers
    const amountNum = parseFloat(amount.replace(/[^0-9.]/g, ''));
    const feeAmountNum = parseFloat(feeAmount || '0');
    const netAmountNum = parseFloat(netAmount.replace(/[^0-9.]/g, ''));

    // Validate amounts
    if (isNaN(amountNum) || isNaN(netAmountNum) || amountNum <= 0 || netAmountNum <= 0) {
      return createJsonResponse({ error: 'Invalid amount values' }, 400);
    }

    // Get the payout plan
    const { data: plan, error: planError } = await supabase
      .from('payout_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', user.id)
      .single();

    if (planError || !plan) {
      return createJsonResponse({ 
        error: planError?.message || 'Payout plan not found',
        details: planError
      }, 404);
    }

    // Check if emergency withdrawal is enabled for this plan
    if (!plan.emergency_withdrawal_enabled) {
      return createJsonResponse({ 
        error: 'Emergency withdrawal is not enabled for this plan' 
      }, 400);
    }

    // Calculate remaining amount in the plan
    const remainingAmount = plan.total_amount - (plan.completed_payouts * plan.payout_amount);
    
    // Validate withdrawal amount doesn't exceed remaining amount
    if (amountNum > remainingAmount) {
      return createJsonResponse({ 
        error: 'Withdrawal amount exceeds remaining amount in the plan' 
      }, 400);
    }

    // Start a transaction to ensure all operations succeed or fail together
    const { data: transaction, error: transactionError } = await supabase.rpc('process_emergency_withdrawal', {
      p_plan_id: planId,
      p_amount: amountNum,
      p_fee_amount: feeAmountNum,
      p_net_amount: netAmountNum,
      p_option: option
    });

    if (transactionError) {
      console.error('Transaction error:', transactionError);
      return createJsonResponse({ 
        error: 'Failed to process emergency withdrawal',
        details: transactionError.message
      }, 500);
    }

    // If we don't have the RPC function yet, we'll implement the logic here
    if (!transaction) {
      // Begin a supabase transaction
      // 1. Update wallet: decrease locked_balance by amountNum, increase balance by netAmountNum
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ 
          locked_balance: supabase.rpc('decrement', { x: amountNum }),
          balance: supabase.rpc('increment', { x: netAmountNum })
        })
        .eq('user_id', user.id);

      if (walletError) {
        return createJsonResponse({ 
          error: 'Failed to update wallet balance',
          details: walletError.message
        }, 500);
      }

      // 2. Create a transaction record
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'withdrawal',
          amount: netAmountNum,
          status: 'completed',
          source: `Payout Plan: ${plan.name}`,
          destination: 'Wallet',
          payout_plan_id: planId,
          description: `Emergency withdrawal (${option}) from payout plan`,
          reference: `ew-${Date.now()}`
        })
        .select()
        .single();

      if (txError) {
        return createJsonResponse({ 
          error: 'Failed to create transaction record',
          details: txError.message
        }, 500);
      }

      // 3. Update the payout plan
      // If the withdrawal is for the full amount, mark the plan as cancelled
      // Otherwise, reduce the total_amount and recalculate duration
      let planUpdate: any = {};
      
      if (amountNum >= remainingAmount) {
        // Full withdrawal - cancel the plan
        planUpdate = {
          status: 'cancelled',
          updated_at: new Date().toISOString()
        };
      } else {
        // Partial withdrawal - adjust plan amounts
        const newTotalAmount = plan.total_amount - amountNum;
        const newDuration = Math.floor(newTotalAmount / plan.payout_amount);
        
        planUpdate = {
          total_amount: newTotalAmount,
          duration: newDuration,
          updated_at: new Date().toISOString()
        };
      }

      const { error: planUpdateError } = await supabase
        .from('payout_plans')
        .update(planUpdate)
        .eq('id', planId)
        .eq('user_id', user.id);

      if (planUpdateError) {
        return createJsonResponse({ 
          error: 'Failed to update payout plan',
          details: planUpdateError.message
        }, 500);
      }

      // 4. Create an event notification
      const { error: eventError } = await supabase
        .from('events')
        .insert({
          user_id: user.id,
          type: 'disbursement_failed', // Using this type as it's closest to withdrawal
          title: 'Emergency Withdrawal Processed',
          description: `Your emergency withdrawal of ₦${netAmountNum.toLocaleString()} has been processed successfully.`,
          status: 'unread',
          payout_plan_id: planId
        });

      if (eventError) {
        console.error('Failed to create event notification:', eventError);
        // Continue anyway as this is not critical
      }
    }

    return createJsonResponse({
      success: true,
      message: 'Emergency withdrawal processed successfully',
      data: {
        withdrawalAmount: netAmountNum,
        feeAmount: feeAmountNum,
        option: option,
        planId: planId
      }
    });
  } catch (error) {
    console.error('Error processing emergency withdrawal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return createJsonResponse({ 
      error: 'Internal server error during emergency withdrawal',
      details: errorMessage
    }, 500);
  }
}