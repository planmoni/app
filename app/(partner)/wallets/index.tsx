/**
 * Partner Wallets Management
 * 
 * View and manage restricted wallets for partners.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { Wallet, Plus, Eye } from 'lucide-react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabase = createClient<Database>(supabaseUrl);

export default function PartnerWallets() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWallets();
  }, [session]);

  const loadWallets = async () => {
    if (!session?.user?.id) return;

    try {
      const { data: partnerUser } = await supabase
        .from('partner_users')
        .select('partner_id')
        .eq('user_id', session.user.id)
        .single();

      if (!partnerUser) return;

      const { data: walletsData, error } = await supabase
        .from('wallets')
        .select('*, partner_users(external_user_id)')
        .eq('partner_id', partnerUser.partner_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get restrictions for each wallet
      const walletsWithRestrictions = await Promise.all(
        (walletsData || []).map(async (wallet) => {
          const { data: restrictions } = await supabase
            .from('wallet_restrictions')
            .select('*')
            .eq('wallet_id', wallet.id)
            .eq('is_active', true);

          return {
            ...wallet,
            restrictions: restrictions || [],
          };
        })
      );

      setWallets(walletsWithRestrictions);
    } catch (error) {
      console.error('Error loading wallets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWallets();
  };

  const styles = createStyles(colors, isDark);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ color: colors.text }}>Loading wallets...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Wallets</Text>
        <Pressable
          style={styles.createButton}
          onPress={() => {
            // Navigate to create wallet screen
            router.push('/(partner)/wallets/create');
          }}
        >
          <Plus size={20} color="#fff" />
          <Text style={styles.createButtonText}>Create Wallet</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {wallets.length === 0 ? (
          <View style={styles.emptyState}>
            <Wallet size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No wallets yet</Text>
            <Text style={styles.emptySubtext}>Create your first restricted wallet</Text>
          </View>
        ) : (
          wallets.map((wallet) => (
            <Pressable
              key={wallet.id}
              style={styles.walletCard}
              onPress={() => {
                router.push(`/(partner)/wallets/${wallet.id}`);
              }}
            >
              <View style={styles.walletHeader}>
                <View style={styles.walletIcon}>
                  <Wallet size={24} color={colors.primary} />
                </View>
                <View style={styles.walletInfo}>
                  <Text style={styles.walletId}>Wallet {wallet.id.substring(0, 8)}...</Text>
                  {wallet.partner_users?.[0]?.external_user_id && (
                    <Text style={styles.externalUserId}>
                      User: {wallet.partner_users[0].external_user_id}
                    </Text>
                  )}
                </View>
                <Eye size={20} color={colors.textSecondary} />
              </View>

              <View style={styles.walletBalance}>
                <Text style={styles.balanceLabel}>Available Balance</Text>
                <Text style={styles.balanceAmount}>
                  ₦{(wallet.available_balance || 0).toLocaleString()}
                </Text>
              </View>

              {wallet.is_restricted && (
                <View style={styles.restrictionsBadge}>
                  <Text style={styles.restrictionsText}>
                    {wallet.restrictions?.length || 0} Restrictions
                  </Text>
                </View>
              )}

              {wallet.requires_approval && (
                <View style={styles.approvalBadge}>
                  <Text style={styles.approvalText}>Requires Approval</Text>
                </View>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 8,
    },
    createButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
    scrollView: {
      flex: 1,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
    },
    walletCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      margin: 16,
      marginBottom: 0,
      borderWidth: 1,
      borderColor: colors.border,
    },
    walletHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    walletIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    walletInfo: {
      flex: 1,
    },
    walletId: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    externalUserId: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    walletBalance: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    balanceLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    balanceAmount: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.primary,
    },
    restrictionsBadge: {
      marginTop: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.warning + '20',
      borderRadius: 4,
      alignSelf: 'flex-start',
    },
    restrictionsText: {
      fontSize: 12,
      color: colors.warning,
      fontWeight: '500',
    },
    approvalBadge: {
      marginTop: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.primary + '20',
      borderRadius: 4,
      alignSelf: 'flex-start',
    },
    approvalText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '500',
    },
  });
}
