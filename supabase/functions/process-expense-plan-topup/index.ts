import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Process Expense Plan Auto Top-Up Function
 *
 * This function processes a single auto top-up for an expense plan.
 * It transfers funds from the user's main wallet to the expense plan.
 * process-expense-plan-topup
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    const { plan_id, user_id, amount } = await req.json();

    if (!plan_id || !user_id || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: plan_id, user_id, amount' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('expense_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('user_id', user_id)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: 'Plan not found', details: planError?.message }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user's wallet
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('available_balance, balance')
      .eq('user_id', user_id)
      .single();

    if (walletError || !wallet) {
      return new Response(
        JSON.stringify({ error: 'Wallet not found', details: walletError?.message }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const availableBalance = (wallet as any).available_balance || 0;

    // Check if user has sufficient available balance
    if (availableBalance < amount) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient funds',
          required: amount,
          available: availableBalance,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use RPC function to process the top-up atomically
    const { data, error: rpcError } = await supabase.rpc('process_expense_plan_topup', {
      p_plan_id: plan_id,
      p_user_id: user_id,
      p_amount: amount,
    });

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: 'Failed to process top-up', details: rpcError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Top-up processed successfully',
        plan_id,
        amount,
        new_plan_balance: data?.new_plan_balance,
        new_wallet_balance: data?.new_wallet_balance,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

