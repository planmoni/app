import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type PayoutAccount = {
  id: string;
  user_id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  bank_code?: string | null;
  safehaven_bank_code?: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  active_payout_plans_count?: number;
};

export function usePayoutAccounts() {
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (session?.user?.id) {
      fetchPayoutAccounts();
    }
  }, [session?.user?.id]);

  const fetchPayoutAccounts = async () => {
    try {
      setError(null);
      
      // First, fetch payout accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('payout_accounts')
        .select('*')
        .eq('user_id', session?.user?.id)
        .order('created_at', { ascending: false });

      if (accountsError) throw accountsError;

      // Then, fetch active payout plans count for each account (only for own plans)
      const userId = session?.user?.id;
      const accountsWithPlanCounts = await Promise.all(
        (accounts || []).map(async (account: PayoutAccount) => {
          if (!userId) return { ...account, active_payout_plans_count: 0 };
          try {
            const { count, error: countError } = await supabase
              .from('payout_plans')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('payout_account_id', account.id)
              .in('status', ['active', 'paused']);

            if (countError) {
              if (__DEV__) {
                console.warn('Payout plans count for account', account.id, countError.message || countError);
              }
              return { ...account, active_payout_plans_count: 0 };
            }
            return { ...account, active_payout_plans_count: count ?? 0 };
          } catch {
            return { ...account, active_payout_plans_count: 0 };
          }
        })
      );

      setPayoutAccounts(accountsWithPlanCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payout accounts');
    } finally {
      setIsLoading(false);
    }
  };

  const getProfileFullName = async (): Promise<string | null> => {
    // Try session metadata first
    const metaName = session?.user?.user_metadata?.full_name;
    if (metaName && typeof metaName === 'string' && metaName.trim().length > 0) {
      return metaName.trim();
    }

    // Fallback to profiles table (full_name, or first_name + last_name)
    if (!session?.user?.id) return null;
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, first_name, last_name')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profileError) {
      console.warn('Error fetching profile full_name for payout validation:', profileError);
      return null;
    }

    const combined = data?.full_name && data.full_name.trim().length > 0
      ? data.full_name.trim()
      : `${data?.first_name || ''} ${data?.last_name || ''}`.trim();

    return combined.length > 0 ? combined : null;
  };

  const normalizeTokens = (value: string | null | undefined) => {
    if (!value) return [] as string[];
    return value
      .split(/\s+/)
      .map(t => t.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(Boolean);
  };

  const addPayoutAccount = async (accountData: {
    account_name: string;
    account_number: string;
    bank_name: string;
    bank_code?: string;
    safehaven_bank_code?: string;
    is_default?: boolean;
  }) => {
    try {
      setError(null);
      
      if (!session?.user?.id) {
        const msg = 'User not authenticated';
        setError(msg);
        throw new Error(msg);
      }

      // Enforce max 3 accounts
      if (payoutAccounts.length >= 3) {
        const msg = 'You can only add up to 3 payout accounts. Please remove one to add another.';
        setError(msg);
        throw new Error(msg);
      }

      // Get profile name for validation
      const profileFullName = await getProfileFullName();
      const profileTokens = normalizeTokens(profileFullName);
      
      // Check if account already exists
      const { data: existingAccount, error: checkError } = await supabase
        .from('payout_accounts')
        .select('id, account_number, bank_name')
        .eq('user_id', session?.user?.id)
        .eq('account_number', accountData.account_number.trim())
        .eq('bank_name', accountData.bank_name.trim())
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingAccount) {
        const errorMessage = `This account (${accountData.account_number.slice(-4)}) at ${accountData.bank_name} already exists in your payout accounts.`;
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      // Name validation: require at least 2 matching tokens
      const accountNameTokens = normalizeTokens(accountData.account_name);

      // Only enforce client-side if we have both sides
      if (profileTokens.length > 0 && accountNameTokens.length > 0) {
        const profileSet = new Set(profileTokens);
        const matches = accountNameTokens.filter(tok => profileSet.has(tok));
        if (matches.length < 2) {
          const msg = 'The payout account does not match your name, please contact support';
          setError(msg);
          throw new Error(msg);
        }
      }
      
      // Log the data being inserted for debugging
      console.log('💾 Inserting payout account to database:', {
        user_id: session?.user?.id,
        account_name: accountData.account_name,
        account_number: accountData.account_number,
        bank_name: accountData.bank_name,
        bank_code: accountData.bank_code || 'N/A',
        safehaven_bank_code: accountData.safehaven_bank_code || 'N/A'
      });
      
      const { data, error: insertError } = await supabase
        .from('payout_accounts')
        .insert({
          user_id: session?.user?.id,
          ...accountData
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error inserting payout account:', insertError);
        throw insertError;
      }
      
      console.log('✅ Payout account inserted successfully:', {
        id: data.id,
        bank_code: data.bank_code || 'N/A',
        safehaven_bank_code: data.safehaven_bank_code || 'N/A'
      });
      
      // Update local state with the new account
      setPayoutAccounts(prev => [data, ...prev]);
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add payout account';
      setError(errorMessage);
      throw err;
    }
  };

  const updatePayoutAccount = async (accountId: string, accountData: {
    account_name?: string;
    account_number?: string;
    bank_name?: string;
  }) => {
    try {
      setError(null);
      
      const { error: updateError } = await supabase
        .from('payout_accounts')
        .update(accountData)
        .eq('id', accountId)
        .eq('user_id', session?.user?.id);

      if (updateError) throw updateError;
      
      // Update local state
      setPayoutAccounts(prev => 
        prev.map(account => 
              account.id === accountId
            ? { ...account, ...accountData, updated_at: new Date().toISOString() }
            : account
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payout account');
      throw err;
    }
  };

  const setDefaultAccount = async (accountId: string) => {
    try {
      setError(null);
      
      // First, remove default from all accounts
      await supabase
        .from('payout_accounts')
        .update({ is_default: false })
        .eq('user_id', session?.user?.id);

      // Then set the selected account as default
      const { error: updateError } = await supabase
        .from('payout_accounts')
        .update({ is_default: true })
        .eq('id', accountId)
        .eq('user_id', session?.user?.id);

      if (updateError) throw updateError;
      
      // Update local state - ensure only one account is default
      setPayoutAccounts(prev => 
        prev.map(account => ({
          ...account,
          is_default: account.id === accountId, // Only the selected account is default
          updated_at: new Date().toISOString()
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default account');
      throw err;
    }
  };

  const deleteAccount = async (accountId: string) => {
    try {
      setError(null);
      
      const { error: deleteError } = await supabase
        .from('payout_accounts')
        .delete()
        .eq('id', accountId)
        .eq('user_id', session?.user?.id);

      if (deleteError) throw deleteError;
      
      // Update local state
      setPayoutAccounts(prev => prev.filter(account => account.id !== accountId));
      
      // If we deleted the default account and there are other accounts, make the first one default
      const remainingAccounts = payoutAccounts.filter(account => account.id !== accountId);
      if (payoutAccounts.find(a => a.id === accountId)?.is_default && remainingAccounts.length > 0) {
        await setDefaultAccount(remainingAccounts[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      throw err;
    }
  };

  return {
    payoutAccounts,
    isLoading,
    error,
    fetchPayoutAccounts,
    addPayoutAccount,
    updatePayoutAccount,
    setDefaultAccount,
    deleteAccount,
  };
}