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
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Pressable, 
  ScrollView, 
  StyleSheet, 
  Text, 
  View, 
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useInfinitePayoutPlansQuery } from '@/hooks/queries/usePayoutPlansQuery';
import { useBalance } from '@/contexts/BalanceContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useHasCreatedPayoutPlan } from '@/hooks/useHasCreatedPayoutPlan';
import { formatPayoutFrequency, formatPayoutDateTime, formatDisplayDate } from '@/lib/formatters';
import { getBankIconLogo } from '@/lib/bankIcons';
import { getPurposeLabel } from '@/lib/payout-purposes';
import NewPlanInfoModal from '@/components/NewPlanInfoModal';
import CustomAmountsBreakdownModal from '@/components/CustomAmountsBreakdownModal';
import { supabase } from '@/lib/supabase';
import { recoverPullToRefresh } from '@/lib/supabase-recover';
import { usePayoutPlanShare } from '@/hooks/usePayoutPlanShare';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from 'react-native';
import Button from '@/components/Button';

type TabType = 'all' | 'active' | 'cancelled' | 'completed';


export default function AllPayoutsScreen() {
  const { colors, isDark } = useTheme();
  const {
    payoutPlans,
    isLoading,
    fetchPayoutPlans,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfinitePayoutPlansQuery();
  const { showBalances, balance, availableBalance } = useBalance();
  const haptics = useHaptics();
  const { hasCreatedPayoutPlan } = useHasCreatedPayoutPlan();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showNewPlanInfoModal, setShowNewPlanInfoModal] = useState(false);
  const [customDateAmounts, setCustomDateAmounts] = useState<Record<string, Record<string, number>>>({});
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [selectedPlanForBreakdown, setSelectedPlanForBreakdown] = useState<string | null>(null);
  const [showAddByCodeModal, setShowAddByCodeModal] = useState(false);
  const [planCodeInput, setPlanCodeInput] = useState('');
  const [addByCodeError, setAddByCodeError] = useState<string | null>(null);

  const { getPlanByShareCode, pairToPlan, isLoading: isAddingByCode } = usePayoutPlanShare();
  const { showToast } = useToast();

  // Fetch custom payout dates with amounts
  useEffect(() => {
    const fetchCustomAmounts = async () => {
      const customPlans = payoutPlans.filter(plan => plan.frequency === 'custom');
      if (customPlans.length === 0) {
        setCustomDateAmounts({});
        return;
      }

      try {
        const planIds = customPlans.map(plan => plan.id);
        const { data, error } = await supabase
          .from('custom_payout_dates')
          .select('payout_plan_id, payout_date, amount')
          .in('payout_plan_id', planIds)
          .order('payout_date', { ascending: true });

        if (error) throw error;

        // Group by plan_id: { planId: { date: amount } }
        const amountsByPlan: Record<string, Record<string, number>> = {};
        data?.forEach(item => {
          if (!amountsByPlan[item.payout_plan_id]) {
            amountsByPlan[item.payout_plan_id] = {};
          }
          amountsByPlan[item.payout_plan_id][item.payout_date] = parseFloat(item.amount?.toString() || '0') || 0;
        });

        setCustomDateAmounts(amountsByPlan);
      } catch (error) {
        console.error('Error fetching custom payout amounts:', error);
        setCustomDateAmounts({});
      }
    };

    fetchCustomAmounts();
  }, [payoutPlans]);

  const handlePlusPress = () => {
    haptics.mediumImpact();
    setShowAddByCodeModal(true);
    setPlanCodeInput('');
    setAddByCodeError(null);
  };

  const handleAddByCode = async () => {
    const code = planCodeInput.trim();
    if (!code) {
      setAddByCodeError('Enter a plan code');
      return;
    }
    setAddByCodeError(null);
    const plan = await getPlanByShareCode(code);
    if (!plan.found) {
      setAddByCodeError(plan.error || 'Invalid or expired code');
      return;
    }
    if (plan.is_owner) {
      setAddByCodeError('You already own this plan');
      return;
    }
    if (plan.is_paired) {
      setAddByCodeError("You're already following this plan");
      return;
    }
    if (!plan.id) {
      setAddByCodeError('Could not add plan');
      return;
    }
    const success = await pairToPlan(plan.id);
    if (success) {
      setShowAddByCodeModal(false);
      setPlanCodeInput('');
      showToast('Plan added. You can now track it with your other plans.');
      fetchPayoutPlans();
    } else {
      setAddByCodeError('Failed to add plan. Try again.');
    }
  };

  const handleCreatePayout = () => {
    haptics.mediumImpact();
    setShowAddByCodeModal(false);
    if (hasCreatedPayoutPlan) {
      router.push('/create-payout/amount');
    } else {
      setShowNewPlanInfoModal(true);
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
      await recoverPullToRefresh();
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
        return { bg: colors.primary, text: colors.accent, icon: TrendingUp };
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
          onPress={handlePlusPress}
        >
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Add payout plan by code modal */}
      <Modal
        visible={showAddByCodeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddByCodeModal(false)}
      >
        <Pressable 
          style={styles.addByCodeModalOverlay} 
          onPress={() => setShowAddByCodeModal(false)}
        >
          <Pressable style={[styles.addByCodeModalContent, { backgroundColor: colors.card }]} onPress={e => e.stopPropagation()}>
            <View style={styles.addByCodeModalHeader}>
              <Text style={[styles.addByCodeModalTitle, { color: colors.text }]}>Add payout plan</Text>
              <Pressable onPress={() => { haptics.lightImpact(); setShowAddByCodeModal(false); }} hitSlop={12}>
                <X size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={[styles.addByCodeModalLabel, { color: colors.textSecondary }]}>Enter plan code</Text>
            <TextInput
              style={[styles.addByCodeInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
              placeholder="e.g. ABC12XYZ"
              placeholderTextColor={colors.textTertiary}
              value={planCodeInput}
              onChangeText={(t) => { setPlanCodeInput(t.toUpperCase()); setAddByCodeError(null); }}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {addByCodeError ? (
              <Text style={[styles.addByCodeError, { color: colors.error }]}>{addByCodeError}</Text>
            ) : null}
            <Button
              title="Add"
              onPress={handleAddByCode}
              isLoading={isAddingByCode}
              style={styles.addByCodeButton}
            />
            <Pressable onPress={handleCreatePayout} style={styles.createNewLink}>
              <Text style={[styles.createNewLinkText, { color: colors.primary }]}>Create new payout plan</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
                <Text style={styles.createFirstButtonText}>Create Your First Payout Schedule</Text>
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
                      <View style={styles.planNameRow}>
                        <Text style={styles.planName}>{plan.name}</Text>
                        {plan.is_paired && (
                          <View style={[styles.sharedBadge, { backgroundColor: colors.backgroundTertiary }]}>
                            <Text style={[styles.sharedBadgeText, { color: colors.primary }]}>Shared with you</Text>
                          </View>
                        )}
                      </View>
                      {plan.description && (
                        <Text style={styles.planDescription}>{plan.description}</Text>
                      )}
                      {(plan as any).purpose && (
                        <Text style={styles.planPurpose} numberOfLines={1}>
                          {getPurposeLabel((plan as any).purpose, (plan as any).purpose_other_text)}
                        </Text>
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
                        {plan.frequency === 'custom' && customDateAmounts[plan.id] && Object.keys(customDateAmounts[plan.id]).length > 0 ? (
                          <View style={styles.customAmountsDetail}>
                            <Text style={styles.detailValue}>Custom Amounts</Text>
                            <Pressable
                              onPress={() => {
                                setSelectedPlanForBreakdown(plan.id);
                                setShowBreakdownModal(true);
                                haptics.selection();
                              }}
                              style={styles.seeBreakdownLink}
                            >
                              <Text style={styles.seeBreakdownText}>See breakdown</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Text style={styles.detailValue}>
                            {formatCurrency(plan.payout_amount)}
                          </Text>
                        )}
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
        {hasNextPage && (
          <Pressable
            style={[styles.loadMoreButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              if (!isFetchingNextPage) void fetchNextPage();
            }}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load more plans</Text>
            )}
          </Pressable>
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

      {selectedPlanForBreakdown && customDateAmounts[selectedPlanForBreakdown] && (
        <CustomAmountsBreakdownModal
          isVisible={showBreakdownModal}
          onClose={() => {
            setShowBreakdownModal(false);
            setSelectedPlanForBreakdown(null);
          }}
          customAmounts={customDateAmounts[selectedPlanForBreakdown]}
          formatCurrency={formatCurrency}
        />
      )}
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
  },
  addByCodeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  addByCodeModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
  },
  addByCodeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  addByCodeModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  addByCodeModalLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  addByCodeInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 8,
  },
  addByCodeError: {
    fontSize: 13,
    marginBottom: 12,
  },
  addByCodeButton: {
    marginTop: 4,
    marginBottom: 16,
  },
  createNewLink: {
    alignSelf: 'center',
  },
  createNewLinkText: {
    fontSize: 14,
    fontWeight: '600',
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
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  sharedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sharedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  planDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  planPurpose: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
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
  customAmountsDetail: {
    gap: 4,
  },
  seeBreakdownLink: {
    marginTop: 4,
  },
  seeBreakdownText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
    textDecorationLine: 'underline',
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
  loadMoreButton: {
    marginTop: 8,
    marginBottom: 16,
    marginHorizontal: 4,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
});