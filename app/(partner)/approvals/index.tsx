/**
 * Partner Approvals Queue
 * 
 * View and manage approval requests.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { CheckCircle, XCircle, Clock } from 'lucide-react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabase = createClient<Database>(supabaseUrl);

export default function PartnerApprovals() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    loadApprovals();
  }, [session, filter]);

  const loadApprovals = async () => {
    if (!session?.user?.id) return;

    try {
      const { data: partnerUser } = await supabase
        .from('partner_users')
        .select('partner_id')
        .eq('user_id', session.user.id)
        .single();

      if (!partnerUser) return;

      let query = supabase
        .from('approval_requests')
        .select('*, wallets(*), transactions(*)')
        .eq('partner_id', partnerUser.partner_id)
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('status', 'pending');
      }

      const { data: approvalsData, error } = await query.limit(50);

      if (error) throw error;

      setApprovals(approvalsData || []);
    } catch (error) {
      console.error('Error loading approvals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadApprovals();
  };

  const styles = createStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Approvals</Text>
        <View style={styles.filterButtons}>
          <Pressable
            style={[styles.filterButton, filter === 'pending' && styles.filterButtonActive]}
            onPress={() => setFilter('pending')}
          >
            <Text
              style={[
                styles.filterButtonText,
                filter === 'pending' && styles.filterButtonTextActive,
              ]}
            >
              Pending
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => setFilter('all')}
          >
            <Text
              style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}
            >
              All
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {approvals.length === 0 ? (
          <View style={styles.emptyState}>
            <Clock size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No approvals</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'pending' ? 'No pending approvals' : 'No approval requests'}
            </Text>
          </View>
        ) : (
          approvals.map((approval) => (
            <Pressable
              key={approval.id}
              style={styles.approvalCard}
              onPress={() => {
                router.push(`/(partner)/approvals/${approval.id}`);
              }}
            >
              <View style={styles.approvalHeader}>
                <View style={styles.statusIcon}>
                  {approval.status === 'approved' ? (
                    <CheckCircle size={24} color="#2e7d32" />
                  ) : approval.status === 'rejected' ? (
                    <XCircle size={24} color="#d32f2f" />
                  ) : (
                    <Clock size={24} color={colors.primary} />
                  )}
                </View>
                <View style={styles.approvalInfo}>
                  <Text style={styles.approvalType}>{approval.request_type}</Text>
                  {approval.amount && (
                    <Text style={styles.approvalAmount}>₦{approval.amount.toLocaleString()}</Text>
                  )}
                </View>
                <View style={styles.stepIndicator}>
                  <Text style={styles.stepText}>
                    Step {approval.current_step + 1} / {approval.total_steps}
                  </Text>
                </View>
              </View>

              <View style={styles.approvalMeta}>
                <Text style={styles.metaText}>
                  Status: <Text style={styles.statusText}>{approval.status}</Text>
                </Text>
                <Text style={styles.metaText}>
                  {new Date(approval.created_at).toLocaleString()}
                </Text>
              </View>
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
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    filterButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    filterButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    filterButtonTextActive: {
      color: '#fff',
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
    approvalCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      margin: 16,
      marginBottom: 0,
      borderWidth: 1,
      borderColor: colors.border,
    },
    approvalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusIcon: {
      marginRight: 12,
    },
    approvalInfo: {
      flex: 1,
    },
    approvalType: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textTransform: 'capitalize',
    },
    approvalAmount: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.primary,
      marginTop: 4,
    },
    stepIndicator: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.primary + '20',
      borderRadius: 4,
    },
    stepText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
    },
    approvalMeta: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    metaText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    statusText: {
      fontWeight: '600',
      color: colors.text,
      textTransform: 'capitalize',
    },
  });
}
