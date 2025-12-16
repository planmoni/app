import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Schedule Expense Plan Auto Top-Up Function
 *
 * This function runs daily via cron to check for expense plans that need
 * automatic top-ups and processes them by transferring funds from the user's
 * main wallet balance to the expense plan.
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface ExpensePlan {
  id: string;
  user_id: string;
  name: string;
  total_budget: number;
  current_balance: number;
  auto_topup_enabled: boolean;
  auto_topup_frequency: string;
  auto_topup_amount: number;
  auto_topup_start_date: string;
  auto_topup_end_date: string;
  auto_topup_next_date: string;
  auto_topup_total_cycles: number;
  status: string;
  start_date: string;
}

interface UserWallet {
  available_balance: number;
  balance: number;
}

serve(async (req) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // Find all expense plans that need top-ups today
    const { data: plansToTopUp, error: fetchError } = await supabase
      .from('expense_plans')
      .select('*')
      .eq('auto_topup_enabled', true)
      .eq('auto_topup_next_date', today)
      .in('status', ['draft', 'active']);

    if (fetchError) {
      console.error('Error fetching plans:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch plans', details: fetchError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!plansToTopUp || plansToTopUp.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No plans need top-ups today', count: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      processed: 0,
      failed: 0,
      insufficient_funds: 0,
      errors: [] as string[],
    };

    // Process each plan
    for (const plan of plansToTopUp as ExpensePlan[]) {
      try {
        // Get user's main wallet available balance
        const { data: wallet, error: walletError } = await supabase
          .from('wallets')
          .select('available_balance, balance')
          .eq('user_id', plan.user_id)
          .single();

        if (walletError || !wallet) {
          console.error(`Error fetching wallet for user ${plan.user_id}:`, walletError);
          results.failed++;
          results.errors.push(`Plan ${plan.id}: Wallet not found`);
          continue;
        }

        const userAvailableBalance = (wallet as any).available_balance || 0;

        // Check if user has sufficient available balance
        if (userAvailableBalance < plan.auto_topup_amount) {
          console.warn(`Insufficient funds for plan ${plan.id}. Required: ${plan.auto_topup_amount}, Available: ${userAvailableBalance}`);
          results.insufficient_funds++;
          
          // Send notification to user about insufficient funds
          await supabase
            .from('notifications')
            .insert({
              user_id: plan.user_id,
              type: 'auto_topup_failed',
              title: 'Auto Top-Up Failed',
              message: `Insufficient funds for automatic top-up of ${plan.name}. Required: ₦${plan.auto_topup_amount.toLocaleString()}, Available: ₦${userAvailableBalance.toLocaleString()}`,
              metadata: {
                plan_id: plan.id,
                plan_name: plan.name,
                required_amount: plan.auto_topup_amount,
                available_balance: userAvailableBalance,
              },
            });

          continue;
        }

        // Process the top-up
        const { error: processError } = await supabase.rpc('process_expense_plan_topup', {
          p_plan_id: plan.id,
          p_user_id: plan.user_id,
          p_amount: plan.auto_topup_amount,
        });

        if (processError) {
          console.error(`Error processing top-up for plan ${plan.id}:`, processError);
          results.failed++;
          results.errors.push(`Plan ${plan.id}: ${processError.message}`);
          continue;
        }

        results.processed++;

        // Calculate next top-up date
        const endDate = new Date(plan.auto_topup_end_date);
        endDate.setHours(0, 0, 0, 0);
        const currentDate = new Date(plan.auto_topup_next_date);
        currentDate.setHours(0, 0, 0, 0);
        
        // Calculate next top-up date based on frequency
        let nextTopUpDate = new Date(currentDate);
        switch (plan.auto_topup_frequency) {
          case 'daily':
            nextTopUpDate.setDate(nextTopUpDate.getDate() + 1);
            break;
          case 'weekly':
            nextTopUpDate.setDate(nextTopUpDate.getDate() + 7);
            break;
          case 'biweekly':
            nextTopUpDate.setDate(nextTopUpDate.getDate() + 14);
            break;
          case 'monthly':
            nextTopUpDate.setMonth(nextTopUpDate.getMonth() + 1);
            break;
          case 'quarterly':
            nextTopUpDate.setMonth(nextTopUpDate.getMonth() + 3);
            break;
          case 'yearly':
            nextTopUpDate.setFullYear(nextTopUpDate.getFullYear() + 1);
            break;
          default:
            nextTopUpDate.setDate(nextTopUpDate.getDate() + 1);
        }
        
        const nextDateStr = nextTopUpDate.toISOString().split('T')[0];
        
        // If next date is after end date, disable auto top-up
        if (nextTopUpDate > endDate) {
          await supabase
            .from('expense_plans')
            .update({
              auto_topup_enabled: false,
              auto_topup_next_date: null,
            })
            .eq('id', plan.id);
        } else {
          // Update next top-up date
          await supabase
            .from('expense_plans')
            .update({
              auto_topup_next_date: nextDateStr,
            })
            .eq('id', plan.id);
        }

      } catch (error) {
        console.error(`Error processing plan ${plan.id}:`, error);
        results.failed++;
        results.errors.push(`Plan ${plan.id}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Top-up processing completed',
        ...results,
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

