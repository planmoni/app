import PlanmoniLoader from '@/components/PlanmoniLoader';
import SafeFooter from '@/components/SafeFooter';
import { router } from 'expo-router';
import { 
  ArrowLeft, 
  ChevronRight, 
  Plus, 
  Pause, 
  TrendingUp,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Filter,
  Search,
  BarChart3,
  Target,
  Wallet,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  X
} from 'lucide-react-native';
import React, { useState, useMemo } from 'react';
import { 
  Pressable, 
  ScrollView, 
  StyleSheet, 
  Text, 
  View, 
  RefreshControl,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { useBalance } from '@/contexts/BalanceContext';
import { useHaptics } from '@/hooks/useHaptics';
import { formatPayoutFrequency, formatPayoutDateTime } from '@/lib/formatters';
import { getBankIconLogo } from '@/lib/bankIcons';
import NewPlanInfoModal from '@/components/NewPlanInfoModal';

type TabType = 'all' | 'active' | 'cancelled' | 'completed';


export default function AllPayoutsScreen() {
  const { colors, isDark } = useTheme();
  const { payoutPlans, isLoading, fetchPayoutPlans } = useRealtimePayoutPlans();
  const { showBalances, balance, availableBalance } = useBalance();
  const haptics = useHaptics();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showNewPlanInfoModal, setShowNewPlanInfoModal] = useState(false);

  const handleCreatePayout = () => {
    haptics.mediumImpact();
    
    // Check if balance is ₦0 and no plans exist
    const hasNoBalance = balance === 0 && availableBalance === 0;
    const hasNoPlans = payoutPlans.length === 0;
    
    // If no balance and no plans, show info modal
    if (hasNoBalance && hasNoPlans) {
      setShowNewPlanInfoModal(true);
    } else {
      // Navigate directly to create payout
    router.push('/create-payout/amount');
    }
  };

  const handleAddFunds = () => {
    haptics.mediumImpact();
    router.push('/add-funds');
  };

  const handleViewPayout = (planId: string) => {
    haptics.selection();
    router.push({
      pathname: '/view-payout',
      params: { id: planId }
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchPayoutPlans();
      haptics.notification();
    } catch (error) {
      console.error('Error refreshing payout plans:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    haptics.lightImpact();
  };


  const formatCurrency = (amount: number) => {
    return showBalances ? `₦${amount.toLocaleString()}` : '••••••••';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: '#DCFCE7', text: '#22C55E', icon: TrendingUp };
      case 'cancelled':
        return { bg: '#FEE2E2', text: '#EF4444', icon: XCircle };
      case 'completed':
        return { bg: '#EFF6FF', text: '#1E3A8A', icon: CheckCircle };
      case 'paused':
        return { bg: '#FEF3C7', text: '#F59E0B', icon: Pause };
      default:
        return { bg: '#F1F5F9', text: '#64748B', icon: ClockIcon };
    }
  };

  const calculateProgress = (plan: any) => {
    return Math.round((plan.completed_payouts / plan.duration) * 100);
  };

  // Advanced filtering with search and statistics
  const filteredPayoutPlans = useMemo(() => {
    let filtered = payoutPlans;

    // Filter by tab
    if (activeTab !== 'all') {
      filtered = filtered.filter(plan => plan.status === activeTab);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(plan => 
        plan.name.toLowerCase().includes(query) ||
        (plan.description && plan.description.toLowerCase().includes(query)) ||
        plan.frequency.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [payoutPlans, activeTab, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalAmount = payoutPlans.reduce((sum, plan) => sum + plan.total_amount, 0);
    const completedAmount = payoutPlans.reduce((sum, plan) => 
      sum + (plan.completed_payouts * plan.payout_amount), 0
    );
    const activePlans = payoutPlans.filter(p => p.status === 'active').length;
    const completedPlans = payoutPlans.filter(p => p.status === 'completed').length;
    
    return {
      totalAmount,
      completedAmount,
      activePlans,
      completedPlans,
      completionRate: totalAmount > 0 ? Math.round((completedAmount / totalAmount) * 100) : 0
    };
  }, [payoutPlans]);

  const tabs = [
    { key: 'all', label: 'All', count: payoutPlans.length },
    { key: 'active', label: 'Active', count: payoutPlans.filter(p => p.status === 'active').length },
    { key: 'cancelled', label: 'Cancelled', count: payoutPlans.filter(p => p.status === 'cancelled').length },
    { key: 'completed', label: 'Completed', count: payoutPlans.filter(p => p.status === 'completed').length },
  ];

  const styles = createStyles(colors, isDark);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Your Payouts</Text>
        </View>
        <View style={styles.loadingContainer}>
          <PlanmoniLoader size="large" />
          <Text style={styles.loadingText}>Loading your payout plans...</Text>
        </View>
        <SafeFooter />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Enhanced Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable 
            onPress={() => {
              haptics.lightImpact();
              router.back();
            }} 
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Your Payouts</Text>
            <Text style={styles.headerSubtitle}>{payoutPlans.length} total plans</Text>
          </View>
        </View>
        <Pressable 
          style={styles.createButton} 
          onPress={handleCreatePayout}
        >
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Statistics Cards */}
      {/* {payoutPlans.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.statsContainer}
          contentContainerStyle={styles.statsContent}
        >
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={styles.statIconContainer}>
              <Target size={20} color="#22C55E" />
            </View>
            <Text style={styles.statValue}>{formatCurrency(stats.totalAmount)}</Text>
            <Text style={styles.statLabel}>Total Value</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={styles.statIconContainer}>
              <CheckCircle size={20} color="#1E3A8A" />
            </View>
            <Text style={styles.statValue}>{formatCurrency(stats.completedAmount)}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={styles.statIconContainer}>
              <TrendingUp size={20} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{stats.activePlans}</Text>
            <Text style={styles.statLabel}>Active Plans</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={styles.statIconContainer}>
              <BarChart3 size={20} color="#8B5CF6" />
            </View>
            <Text style={styles.statValue}>{stats.completionRate}%</Text>
            <Text style={styles.statLabel}>Progress</Text>
          </View>
        </ScrollView>
      )} */}


      {/* Enhanced Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {tabs.map((tab) => {
            const StatusIcon = getStatusColor(tab.key as any).icon;
            return (
              <Pressable
                key={tab.key}
                style={[
                  styles.tab,
                  { backgroundColor: colors.card },
                  activeTab === tab.key && styles.activeTab
                ]}
                onPress={() => {
                  haptics.selection();
                  setActiveTab(tab.key as TabType);
                }}
              >
                <StatusIcon size={16} color={activeTab === tab.key ? '#FFFFFF' : colors.textSecondary} />
                <Text style={[
                  styles.tabText,
                  activeTab === tab.key && styles.activeTabText
                ]}>
                  {tab.label}
                </Text>
                <View style={[
                  styles.tabBadge,
                  { backgroundColor: activeTab === tab.key ? 'rgba(255, 255, 255, 0.2)' : colors.border }
                ]}>
                  <Text style={[
                    styles.tabBadgeText,
                    { color: activeTab === tab.key ? '#FFFFFF' : colors.textSecondary }
                  ]}>
                    {tab.count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Search and Filter Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search plans..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={clearSearch} style={styles.clearButton}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
        {/* <Pressable 
          style={[styles.filterButton, { backgroundColor: colors.card }]}
          onPress={() => {
            haptics.selection();
            setShowFilters(!showFilters);
          }}
        >
          <Filter size={20} color={colors.textSecondary} />
        </Pressable> */}
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {filteredPayoutPlans.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Target size={48} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'all' ? 'No Payout Plans Yet' : `No ${tabs.find(t => t.key === activeTab)?.label} Plans`}
            </Text>
            <Text style={styles.emptyDescription}>
              {activeTab === 'all' 
                ? 'Create your first payout plan to start automating your financial goals'
                : `You don't have any ${tabs.find(t => t.key === activeTab)?.label.toLowerCase()} payout plans yet`
              }
            </Text>
            {activeTab === 'all' && (
              <Pressable style={styles.createFirstButton} onPress={handleCreatePayout}>
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.createFirstButtonText}>Create Your First Plan</Text>
              </Pressable>
            )}
          </View>
        ) : (
          filteredPayoutPlans.map((plan) => {
            const statusColors = getStatusColor(plan.status);
            const StatusIcon = statusColors.icon;
            const progress = calculateProgress(plan);
            
            // Get the day of week from metadata if available
            const dayOfWeek = plan.metadata?.dayOfWeek;
            const originalFrequency = plan.metadata?.originalFrequency || plan.frequency;
            
            // Get bank icon
            const bankName = plan.payout_accounts?.bank_name || plan.bank_accounts?.bank_name || '';
            const bankIcon = getBankIconLogo(bankName);
            
            return (
              <Pressable 
                key={plan.id} 
                style={[styles.payoutCard, { backgroundColor: colors.card }]}
                onPress={() => handleViewPayout(plan.id)}
              >
                <View style={styles.payoutContent}>
                  {/* Header with status and actions */}
                  <View style={styles.payoutHeader}>
                    <View style={styles.planInfo}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      {plan.description && (
                        <Text style={styles.planDescription}>{plan.description}</Text>
                      )}
                    </View>
                    <View style={styles.headerActions}>
                      <View style={[styles.statusTag, { backgroundColor: statusColors.bg }]}>
                        <StatusIcon size={12} color={statusColors.text} />
                        <Text style={[styles.statusText, { color: statusColors.text }]}>
                          {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                        </Text>
                      </View>
                      {/* <Pressable style={styles.moreButton}>
                        <MoreHorizontal size={20} color={colors.textSecondary} />
                      </Pressable> */}
                    </View>
                  </View>

                  {/* Amount and progress */}
                  <View style={styles.amountSection}>
                    <Text style={styles.amount}>{formatCurrency(plan.total_amount)}</Text>
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progress}%` }]} />
                      </View>
                      <Text style={styles.progressPercentage}>{progress}%</Text>
                    </View>
                  </View>

                  {/* Details grid */}
                  <View style={styles.detailsGrid}>
                    <View style={styles.detailItem}>
                      <View style={styles.detailIcon}>
                        <CalendarIcon size={16} color="#1E3A8A" />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Frequency</Text>
                        <Text style={styles.detailValue}>
                          {formatPayoutFrequency(originalFrequency, dayOfWeek)}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.detailItem}>
                      <View style={styles.detailIcon}>
                        <Wallet size={16} color="#22C55E" />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Per Payout</Text>
                        <Text style={styles.detailValue}>
                          {formatCurrency(plan.payout_amount)}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.detailItem}>
                      <View style={styles.detailIcon}>
                        <ClockIcon size={16} color="#8B5CF6" />
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Progress</Text>
                        <Text style={styles.detailValue}>
                          {plan.completed_payouts}/{plan.duration}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.detailItem}>
                      <View style={styles.detailIcon}>
                        {bankIcon.logoSvg ? (
                          React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
                            width: 16,
                            height: 16,
                            fill: "#0EA5E9"
                          })
                        ) : bankIcon.logo ? (
                          <View style={styles.bankIconContainer}>
                            <Text style={styles.bankIconText}>{bankName.charAt(0)}</Text>
                          </View>
                        ) : (
                          <View style={styles.bankIconContainer}>
                            <Text style={styles.bankIconText}>B</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.detailContent}>
                        <Text style={styles.detailLabel}>Bank</Text>
                        <Text style={styles.detailValue}>
                          {bankName || 'Unknown'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Footer with next payout */}
                  <View style={styles.footer}>
                    <View style={styles.footerLeft}>
                      <Text style={styles.nextPayoutLabel}>Next Payout</Text>
                      <Text style={styles.nextPayout}>
                        {plan.next_payout_date 
                          ? formatPayoutDateTime(plan.next_payout_date)
                          : plan.status === 'completed' 
                            ? 'Plan completed'
                            : plan.status === 'paused'
                              ? 'Plan paused'
                              : 'No schedule'
                        }
                      </Text>
                    </View>
                    <ChevronRight size={20} color={colors.textSecondary} />
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      
      <SafeFooter />

      <NewPlanInfoModal
        isVisible={showNewPlanInfoModal}
        onClose={() => setShowNewPlanInfoModal(false)}
        onAddFundsAfterClose={() => {
          // Navigate after modal is fully closed
          handleAddFunds();
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  createButton: {
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // statsContainer: {
  //   marginBottom: 4,
  // },
  // statsContent: {
  //   paddingHorizontal: 10,
  //   gap: 4,
  // },
  // statCard: {
  //   width: 95,
  //   height: 100,
  //   padding: 12,
  //   borderRadius: 12,
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: 1 },
  //   shadowOpacity: 0.05,
  //   shadowRadius: 2,
  //   elevation: 2,
  // },
  // statIconContainer: {
  //   width: 24,
  //   height: 24,
  //   borderRadius: 12,
  //   backgroundColor: 'rgba(59, 130, 246, 0.1)',
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   marginBottom: 6,
  // },
  // statValue: {
  //   fontSize: 16,
  //   fontWeight: '700',
  //   color: colors.text,
  //   marginBottom: 2,
  // },
  // statLabel: {
  //   fontSize: 11,
  //   color: colors.textSecondary,
  //   fontWeight: '500',
  // },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    padding: 0,
  },
  clearButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: colors.backgroundTertiary,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    backgroundColor: colors.surface,
    paddingVertical: 8,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    marginRight: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  tabBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 32,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    gap: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 24,
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 24,
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  payoutCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: .1,
  },
  payoutContent: {
    padding: 20,
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planInfo: {
    flex: 1,
    marginRight: 12,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountSection: {
    marginBottom: 20,
  },
  amount: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    minWidth: 40,
    textAlign: 'right',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    gap: 12,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  bankIconContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankIconText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerLeft: {
    flex: 1,
  },
  nextPayoutLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  nextPayout: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});