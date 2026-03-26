import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useExpensePlans } from '@/hooks/useExpensePlans';
import { usePayoutAccounts } from '@/hooks/usePayoutAccounts';
import { useHaptics } from '@/hooks/useHaptics';

type CloseVaultParams = {
  planName: string;
  currentBalance: number;
};

/**
 * Shared flow for closing an expense plan / vault (alerts, wallet transfer, bank payout, delete).
 */
export function useCloseExpensePlanVault(planId: string | undefined) {
  const { session } = useAuth();
  const { deleteExpensePlan, transferPlanToWallet } = useExpensePlans();
  const { payoutAccounts, fetchPayoutAccounts } = usePayoutAccounts();
  const haptics = useHaptics();

  const requestCloseVault = useCallback(
    ({ planName, currentBalance }: CloseVaultParams) => {
      if (!planId) return;

      haptics.mediumImpact();

      if (currentBalance === 0) {
        Alert.alert(
          'Close Budget',
          `Are you sure you want to close "${planName}"? This action cannot be undone.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Yes',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteExpensePlan(planId);
                  haptics.success();
                  router.replace('/(tabs)');
                } catch (error: any) {
                  haptics.error();
                  Alert.alert('Error', error.message || 'Failed to close budget. Please try again.');
                }
              },
            },
          ]
        );
        return;
      }

      Alert.alert(
        'Close Vault',
        `What would you like to do with the remaining funds (₦${currentBalance.toLocaleString()})?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Move to Wallet',
            onPress: async () => {
              try {
                haptics.mediumImpact();
                const result = await transferPlanToWallet(planId, currentBalance);
                await deleteExpensePlan(planId);
                router.push({
                  pathname: '/expense-planner/[id]/transfer-success',
                  params: {
                    planId,
                    planName: planName || 'Vault',
                    amountTransferred: currentBalance.toString(),
                    newWalletBalance: (result as any)?.new_wallet_balance?.toString() || '0',
                  },
                });
              } catch (error: any) {
                haptics.error();
                Alert.alert('Error', error.message || 'Failed to transfer funds. Please try again.');
              }
            },
          },
          {
            text: 'Auto Payout to Bank',
            onPress: async () => {
              await fetchPayoutAccounts();

              if (payoutAccounts.length === 0) {
                Alert.alert(
                  'No Payout Account',
                  'You need to add a payout account first to receive funds.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Add Account',
                      onPress: () => {
                        router.push('/payout-accounts');
                      },
                    },
                  ]
                );
                return;
              }

              const defaultAccount = payoutAccounts.find((acc) => acc.is_default) || payoutAccounts[0];

              try {
                haptics.mediumImpact();

                const { data: dbResult, error: dbError } = await supabase.rpc('close_plan_with_payout', {
                  arg_plan_id: planId,
                  arg_amount: currentBalance,
                  arg_account_id: defaultAccount.id,
                });

                if (dbError || !dbResult?.success) {
                  throw new Error(dbResult?.error || dbError?.message || 'Failed to process payout');
                }

                const response = await fetch(
                  `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/withdraw-plan-extra-funds`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${session?.access_token}`,
                    },
                    body: JSON.stringify({
                      planId,
                      amount: currentBalance,
                      accountId: defaultAccount.id,
                    }),
                  }
                );

                const result = await response.json();

                if (!response.ok || !result.success) {
                  console.warn('Bank transfer failed, but plan is closed:', result.error);
                }

                haptics.success();

                await deleteExpensePlan(planId);

                Alert.alert(
                  'Vault Closed',
                  `₦${currentBalance.toLocaleString()} has been transferred to ${defaultAccount.bank_name} ••••${defaultAccount.account_number.slice(-4)}.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        router.replace('/(tabs)');
                      },
                    },
                  ]
                );
              } catch (error: any) {
                haptics.error();
                Alert.alert('Error', error.message || 'Failed to process payout. Please try again.');
              }
            },
          },
        ]
      );
    },
    [
      planId,
      session?.access_token,
      deleteExpensePlan,
      transferPlanToWallet,
      fetchPayoutAccounts,
      payoutAccounts,
      haptics,
    ]
  );

  return requestCloseVault;
}
