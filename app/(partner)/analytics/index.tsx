/**
 * Partner Analytics
 * 
 * API usage charts, transaction volume, and metrics.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { BarChart3, TrendingUp, Clock, AlertCircle } from 'lucide-react-native';
import { rateLimiter } from '@/lib/rate-limiter';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabase = createClient<Database>(supabaseUrl);

export default function PartnerAnalytics() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [rateLimit, setRateLimit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [session]);

  const loadAnalytics = async () => {
    if (!session?.user?.id) return;

    try {
      const { data: partnerUser } = await supabase
        .from('partner_users')
        .select('partner_id')
        .eq('user_id', session.user.id)
        .single();

      if (!partnerUser) return;

      const partnerId = partnerUser.partner_id;

      // Get usage stats
      const usageStats = await rateLimiter.getUsageStats(partnerId);
      setStats(usageStats);

      // Get current rate limit status
      const limitStatus = await rateLimiter.checkLimit(partnerId);
      setRateLimit(limitStatus);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const styles = createStyles(colors, isDark);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ color: colors.text }}>Loading analytics...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Rate Limit Status */}
        {rateLimit && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rate Limit Status</Text>
            <View style={styles.metricCard}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Requests (Hour)</Text>
                <Text style={styles.metricValue}>
                  {rateLimit.current} / {rateLimit.limit}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(rateLimit.current / rateLimit.limit) * 100}%`,
                      backgroundColor:
                        rateLimit.remaining < rateLimit.limit * 0.1
                          ? '#d32f2f'
                          : rateLimit.remaining < rateLimit.limit * 0.3
                          ? '#f57c00'
                          : colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.metricSubtext}>
                {rateLimit.remaining} requests remaining
              </Text>
            </View>
          </View>
        )}

        {/* Usage Statistics */}
        {stats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Usage Statistics</Text>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <BarChart3 size={24} color={colors.primary} />
                <Text style={styles.statValue}>{stats.total_requests}</Text>
                <Text style={styles.statLabel}>Total Requests</Text>
              </View>

              <View style={styles.statCard}>
                <TrendingUp size={24} color="#2e7d32" />
                <Text style={styles.statValue}>{stats.successful_requests}</Text>
                <Text style={styles.statLabel}>Successful</Text>
              </View>

              <View style={styles.statCard}>
                <AlertCircle size={24} color="#d32f2f" />
                <Text style={styles.statValue}>{stats.failed_requests}</Text>
                <Text style={styles.statLabel}>Failed</Text>
              </View>

              <View style={styles.statCard}>
                <Clock size={24} color={colors.primary} />
                <Text style={styles.statValue}>{Math.round(stats.average_response_time)}ms</Text>
                <Text style={styles.statLabel}>Avg Response</Text>
              </View>
            </View>

            {/* Top Endpoints */}
            {stats.endpoints.length > 0 && (
              <View style={styles.endpointsSection}>
                <Text style={styles.sectionTitle}>Top Endpoints</Text>
                {stats.endpoints.slice(0, 5).map((endpoint: any, index: number) => (
                  <View key={index} style={styles.endpointItem}>
                    <Text style={styles.endpointPath}>{endpoint.endpoint}</Text>
                    <Text style={styles.endpointCount}>{endpoint.count} requests</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
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
    },
    scrollView: {
      flex: 1,
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
    metricCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metricRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    metricLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    metricValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
      marginTop: 8,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    metricSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
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
    endpointsSection: {
      marginTop: 16,
    },
    endpointItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    endpointPath: {
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    endpointCount: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
  });
}
