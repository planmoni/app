/**
 * Plan Wallet Spend Utilities
 * Handles spending from plan wallets with lock rule enforcement
 */

import { supabase } from '@/lib/supabase';

export interface PlanWallet {
  id: string;
  plan_id: string;
  balance: number;
  spending_permission: 'open' | 'restricted';
  lock_type: 'none' | 'instant' | '24h_delay' | 'pin_required';
  pin_hash?: string | null;
}

export interface SpendRequest {
  planId: string;
  amount: number;
  categoryId: string;
  subcategoryId: string;
  description?: string;
  pin?: string; // Required if lock_type is 'pin_required'
}

export interface SpendResult {
  success: boolean;
  transactionId?: string;
  newBalance?: number;
  error?: string;
  requiresConfirmation?: boolean;
  unlockDelayHours?: number;
}

/**
 * Check if wallet is locked and what action is needed
 */
export async function checkWalletLock(planId: string): Promise<{
  isLocked: boolean;
  lockType: 'none' | 'instant' | '24h_delay' | 'pin_required';
  requiresPin: boolean;
  unlockDelayHours?: number;
}> {
  const { data: wallet, error } = await supabase
    .from('plan_wallets')
    .select('*')
    .eq('plan_id', planId)
    .single();

  if (error || !wallet) {
    throw new Error('Wallet not found');
  }

  const lockType = wallet.lock_type || 'none';
  const isLocked = lockType !== 'none';

  return {
    isLocked,
    lockType: lockType as any,
    requiresPin: lockType === 'pin_required',
    unlockDelayHours: lockType === '24h_delay' ? 24 : undefined,
  };
}

/**
 * Process spending from plan wallet
 */
export async function processPlanSpend(request: SpendRequest): Promise<SpendResult> {
  try {
    // Get wallet and check lock status
    const { data: wallet, error: walletError } = await supabase
      .from('plan_wallets')
      .select('*')
      .eq('plan_id', request.planId)
      .single();

    if (walletError || !wallet) {
      return {
        success: false,
        error: 'Wallet not found',
      };
    }

    // Check balance
    if (wallet.balance < request.amount) {
      return {
        success: false,
        error: 'Insufficient balance in plan wallet',
      };
    }

    // Check lock rules
    if (wallet.lock_type === 'pin_required') {
      if (!request.pin) {
        return {
          success: false,
          error: 'PIN required',
          requiresConfirmation: true,
        };
      }
      // TODO: Verify PIN hash
      // For now, we'll skip PIN verification (should hash and compare)
    }

    if (wallet.lock_type === '24h_delay') {
      // Check if there's a pending unlock request
      // For now, we'll require confirmation
      return {
        success: false,
        error: 'Wallet is locked with 24-hour delay. Unlock request required.',
        requiresConfirmation: true,
        unlockDelayHours: 24,
      };
    }

    if (wallet.lock_type === 'instant') {
      // Requires confirmation but can proceed immediately
      // This would be handled in UI
    }

    // Process the spend
    const { data: transaction, error: transactionError } = await supabase
      .from('plan_transactions')
      .insert({
        plan_id: request.planId,
        wallet_id: wallet.id,
        type: 'spending',
        amount: request.amount,
        category_id: request.categoryId,
        subcategory_id: request.subcategoryId,
        description: request.description || 'Spending from plan wallet',
      })
      .select()
      .single();

    if (transactionError) {
      return {
        success: false,
        error: transactionError.message,
      };
    }

    // Wallet balance and plan balance are updated automatically by trigger
    // But we can fetch the updated balance
    const { data: updatedWallet } = await supabase
      .from('plan_wallets')
      .select('balance')
      .eq('id', wallet.id)
      .single();

    return {
      success: true,
      transactionId: transaction.id,
      newBalance: updatedWallet?.balance || wallet.balance - request.amount,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to process spend',
    };
  }
}

/**
 * Request unlock for 24h delay lock
 */
export async function requestUnlock(planId: string): Promise<{ success: boolean; unlockTime?: Date; error?: string }> {
  // TODO: Implement unlock request logic
  // This would create an unlock request that becomes active after 24 hours
  return {
    success: false,
    error: 'Unlock request functionality coming soon',
  };
}
