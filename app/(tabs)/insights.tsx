import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TrendingUp, TrendingDown, Users, ArrowUpRight, ArrowDownRight, Wallet, Clock, Calendar, Send } from 'lucide-react-native';
import Card from '@/components/Card';
import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export default function InsightsScreen() {
  const { colors } = useTheme();

  // Calculate metrics based on transaction data
  const metrics = useMemo(() => {
    return [
      {
        title: 'Payouts',
        value: '₦2.45M',
        change: '+12.5%',
        positive: true,
        icon: Send,
        description: 'Total payouts this month',
      },
      {
        title: 'Deposits',
        value: '₦4.5M',
        change: '+18.2%',
        positive: true,
        icon: Wallet,
        description: 'Total deposits this month',
      },
      {
        title: 'Active',
        value: '4',
        change: '+2',
        positive: true,
        icon: Clock,
        description: 'Currently active payouts',
      },
      {
        title: 'Txns',
        value: '993',
        change: '+2.4%',
        positive: true,
        icon: TrendingUp,
        description: 'Total payout transactions',
      },
    ];
  }, []);

  const trends = useMemo(() => {
    return [
      {
        title: 'Monthly Growth',
        value: '+25.8%',
        description: 'Compared to last month',
        positive: true,
        details: [
          { label: 'Last Month', value: '₦1.95M' },
          { label: 'This Month', value: '₦2.45M' },
        ],
      },
      {
        title: 'Average Payout',
        value: '₦850K',
        description: '₦50K more than usual',
        positive: true,
        details: [
          { label: 'Previous Avg', value: '₦800K' },
          { label: 'Current Avg', value: '₦850K' },
        ],
      },
      {
        title: 'Upcoming Payouts',
        value: '₦3.2M',
        description: 'Next 30 days',
        positive: true,
        details: [
          { label: 'This Week', value: '₦750K' },
          { label: 'Next Week', value: '₦1.2M' },
        ],
      },
    ];
  }, []);

  const vaultStats = useMemo(() => {
    return [
      {
        title: 'Monthly Salary',
        total: '₦10M',
        progress: '30%',
        nextPayout: 'Jun 30',
        status: 'Active',
      },
      {
        title: 'House Rent',
        total: '₦5M',
        progress: '50%',
        nextPayout: 'Jul 15',
        status: 'Active',
      },
      {
        title: 'Car Purchase',
        total: '₦8M',
        progress: '0%',
        nextPayout: 'Aug 1',
        status: 'Pending',
      },
    ];
  }, []);

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Insights</Text>
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.contentPadding}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.metricsGrid}>
            {metrics.map((metric, index) => (
              <Card key={index} style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricTitle}>{metric.title}</Text>
                  <View style={[
                    styles.metricIcon,
                    { backgroundColor: metric.positive ? '#DCFCE7' : '#FEE2E2' }
                  ]}>
                    <metric.icon
                      size={20}
                      color={metric.positive ? '#22C55E' : '#EF4444'}
                    />
                  </View>
                </View>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <View style={styles.metricChange}>
                  {metric.positive ? (
                    <ArrowUpRight size={16} color="#22C55E" />
                  ) : (
                    <ArrowDownRight size={16} color="#EF4444" />
                  )}
                  <Text
                    style={[
                      styles.metricChangeText,
                      { color: metric.positive ? '#22C55E' : '#EF4444' },
                    ]}>
                    {metric.change}
                  </Text>
                </View>
                <Text style={styles.metricDescription}>{metric.description}</Text>
              </Card>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance Trends</Text>
            {trends.map((trend, index) => (
              <Card key={index} style={styles.trendCard}>
                <View style={styles.trendContent}>
                  <View>
                    <Text style={styles.trendTitle}>{trend.title}</Text>
                    <Text style={styles.trendDescription}>{trend.description}</Text>
                    <View style={styles.trendDetails}>
                      {trend.details.map((detail, i) => (
                        <View key={i} style={styles.detailItem}>
                          <Text style={styles.detailLabel}>{detail.label}</Text>
                          <Text style={styles.detailValue}>{detail.value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={[
                    styles.trendValue,
                    { backgroundColor: trend.positive ? '#F0FDF4' : '#FEF2F2' }
                  ]}>
                    <Text style={[
                      styles.trendValueText,
                      { color: trend.positive ? '#22C55E' : '#EF4444' }
                    ]}>
                      {trend.value}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vault Performance</Text>
            {vaultStats.map((vault, index) => (
              <Card key={index} style={styles.vaultCard}>
                <View style={styles.vaultHeader}>
                  <Text style={styles.vaultTitle}>{vault.title}</Text>
                  <View style={[
                    styles.vaultStatus,
                    { backgroundColor: vault.status === 'Active' ? '#DCFCE7' : '#FEF3C7' }
                  ]}>
                    <Text style={[
                      styles.vaultStatusText,
                      { color: vault.status === 'Active' ? '#22C55E' : '#D97706' }
                    ]}>{vault.status}</Text>
                  </View>
                </View>
                <View style={styles.vaultStats}>
                  <View style={styles.vaultStat}>
                    <Text style={styles.vaultStatLabel}>Total</Text>
                    <Text style={styles.vaultStatValue}>{vault.total}</Text>
                  </View>
                  <View style={styles.vaultStat}>
                    <Text style={styles.vaultStatLabel}>Progress</Text>
                    <Text style={styles.vaultStatValue}>{vault.progress}</Text>
                  </View>
                  <View style={styles.vaultStat}>
                    <Text style={styles.vaultStatLabel}>Next Payout</Text>
                    <Text style={styles.vaultStatValue}>{vault.nextPayout}</Text>
                  </View>
                </View>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill,
                      { width: vault.progress }
                    ]} 
                  />
                </View>
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    paddingTop: 50, // Add padding to account for status bar
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    minWidth: '48%',
    padding: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricTitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  metricChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  metricChangeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  metricDescription: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  trendCard: {
    marginBottom: 12,
  },
  trendContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  trendDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  trendDetails: {
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  trendValue: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  trendValueText: {
    fontSize: 16,
    fontWeight: '600',
  },
  vaultCard: {
    marginBottom: 12,
    padding: 16,
  },
  vaultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  vaultTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  vaultStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  vaultStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  vaultStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  vaultStat: {
    alignItems: 'center',
  },
  vaultStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  vaultStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
});