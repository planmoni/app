/**
 * Partner Dashboard
 * 
 * Overview with key metrics and recent activity.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { BarChart3, Wallet, CheckCircle, XCircle, Clock } from 'lucide-react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabase = createClient<Database>(supabaseUrl);

export default function PartnerDashboard() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const [stats, setStats] = useState({
    total_wallets: 0,
    total_disbursements: 0,
    pending_approvals: 0,
    total_volume: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [session]);

  const loadDashboardData = async () => {
    if (!session?.user?.id) return;

    try {
      // Get partner
      const { data: partnerUser } = await supabase
        .from('partner_users')
        .select('partner_id')
        .eq('user_id', session.user.id)
        .single();

      if (!partnerUser) return;

      const partnerId = partnerUser.partner_id;

      // Get stats
      const [walletsResult, disbursementsResult, approvalsResult] = await Promise.all([
        supabase
          .from('wallets')
          .select('id', { count: 'exact', head: true })
          .eq('partner_id', partnerId),
        supabase
          .from('transactions')
          .select('amount', { count: 'exact' })
          .eq('partner_id', partnerId)
          .eq('type', 'disbursement'),
        supabase
          .from('approval_requests')
          .select('id', { count: 'exact', head: true })
          .eq('partner_id', partnerId)
          .eq('status', 'pending'),
      ]);

      // Calculate total volume
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('partner_id', partnerId)
        .eq('type', 'disbursement')
        .eq('status', 'completed');

      const totalVolume = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

      setStats({
        total_wallets: walletsResult.count || 0,
        total_disbursements: disbursementsResult.count || 0,
        pending_approvals: approvalsResult.count || 0,
        total_volume: totalVolume,
      });

      // Get recent activity
      const { data: recent } = await supabase
        .from('transactions')
        .select('*, wallets(*)')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentActivity(recent || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const styles = createStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Partner Dashboard</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Wallet size={24} color={colors.primary} />
            <Text style={styles.statValue}>{stats.total_wallets}</Text>
            <Text style={styles.statLabel}>Total Wallets</Text>
          </View>

          <View style={styles.statCard}>
            <BarChart3 size={24} color={colors.primary} />
            <Text style={styles.statValue}>{stats.total_disbursements}</Text>
            <Text style={styles.statLabel}>Disbursements</Text>
          </View>

          <View style={styles.statCard}>
            <Clock size={24} color={colors.primary} />
            <Text style={styles.statValue}>{stats.pending_approvals}</Text>
            <Text style={styles.statLabel}>Pending Approvals</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>₦{(stats.total_volume / 100).toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Volume</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentActivity.map((activity) => (
            <View key={activity.id} style={styles.activityItem}>
              <View style={styles.activityIcon}>
                {activity.status === 'completed' ? (
                  <CheckCircle size={20} color="#2e7d32" />
                ) : activity.status === 'failed' ? (
                  <XCircle size={20} color="#d32f2f" />
                ) : (
                  <Clock size={20} color={colors.primary} />
                )}
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityType}>{activity.type}</Text>
                <Text style={styles.activityAmount}>₦{activity.amount?.toLocaleString()}</Text>
                <Text style={styles.activityDate}>
                  {new Date(activity.created_at).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
        </View>
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
    scrollView: {
      flex: 1,
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
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 16,
      gap: 12,
    },
    statCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 8,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    activityItem: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    activityIcon: {
      marginRight: 12,
      justifyContent: 'center',
    },
    activityContent: {
      flex: 1,
    },
    activityType: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      textTransform: 'capitalize',
    },
    activityAmount: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.primary,
      marginTop: 4,
    },
    activityDate: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
  });
}
