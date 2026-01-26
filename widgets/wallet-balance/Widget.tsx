/**
 * Wallet Balance Widget
 * 
 * React component for displaying wallet balance in embedded contexts.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WidgetSDK } from '../core/WidgetSDK';
import type { WidgetConfig, WalletBalanceWidgetProps } from '../core/types';

interface WalletBalanceWidgetState {
  balance: number;
  available: number;
  locked: number;
  currency: string;
  loading: boolean;
  error: string | null;
}

export default function WalletBalanceWidget({
  config,
  props,
}: {
  config: WidgetConfig;
  props: WalletBalanceWidgetProps;
}) {
  const [state, setState] = useState<WalletBalanceWidgetState>({
    balance: 0,
    available: 0,
    locked: 0,
    currency: 'NGN',
    loading: true,
    error: null,
  });

  const sdk = new WidgetSDK(config);

  useEffect(() => {
    const loadBalance = async () => {
      try {
        await sdk.initialize();

        // Get wallet balance
        const response = await sdk.apiRequest(`/wallets/${props.wallet_id}/balance`);
        const balance = response.balance;

        setState({
          balance: balance.total,
          available: balance.available,
          locked: balance.locked,
          currency: balance.currency,
          loading: false,
          error: null,
        });

        // Notify parent of balance update
        sdk.postMessage({
          type: 'balance_updated',
          data: balance,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error.message || 'Failed to load balance',
        }));

        sdk.postMessage({
          type: 'error',
          data: { message: error.message },
          timestamp: new Date().toISOString(),
        });
      }
    };

    loadBalance();

    // Poll for balance updates every 30 seconds
    const interval = setInterval(loadBalance, 30000);

    return () => clearInterval(interval);
  }, [props.wallet_id]);

  if (state.loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#1E3A8A" />
      </View>
    );
  }

  if (state.error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{state.error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.balanceContainer}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>
          {state.currency} {state.available.toLocaleString()}
        </Text>
      </View>
      {props.show_restrictions && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Total: {state.currency} {state.balance.toLocaleString()}
          </Text>
          {state.locked > 0 && (
            <Text style={styles.infoText}>
              Locked: {state.currency} {state.locked.toLocaleString()}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    minWidth: 200,
  },
  balanceContainer: {
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  infoContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#d32f2f',
  },
});
