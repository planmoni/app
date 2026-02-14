import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ScrollView, 
  TextInput, 
  Alert, 
  Image, 
  Animated,
  RefreshControl,
  Modal
} from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { 
  ArrowLeft, 
  Calendar, 
  Building2, 
  TriangleAlert as AlertTriangle, 
  PencilLine, 
  BarChart3,
  Activity,
  DollarSign,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  MoreHorizontal,
  Share2,
  Eye,
  EyeOff
} from 'lucide-react-native';
import Button from '@/components/Button';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import SafeFooter from '@/components/SafeFooter';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { useBalance } from '@/contexts/BalanceContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import { useEmergencyWithdrawal } from '@/hooks/useEmergencyWithdrawal';
import { useAuth } from '@/contexts/AuthContext';
import { usePayoutPlanShare } from '@/hooks/usePayoutPlanShare';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { formatPayoutFrequency, formatDisplayDate } from '@/lib/formatters';
import { getBankIconLogo } from '@/lib/bankIcons';
import CustomAmountsBreakdownModal from '@/components/CustomAmountsBreakdownModal';
import { supabase } from '@/lib/supabase';
import { Users, Link, Hash, Copy } from 'lucide-react-native';


export default function ViewPayoutScreen() {
  const { colors, isDark } = useTheme();
  const { id, openShare } = useLocalSearchParams<{ id: string; openShare?: string }>();
  const { payoutPlans, isLoading, updatePlan, fetchPayoutPlans } = useRealtimePayoutPlans();
  const { showBalances, toggleBalances } = useBalance();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const { checkExistingWithdrawal, isLoading: isWithdrawalLoading } = useEmergencyWithdrawal();
  
  const [isEditing, setIsEditing] = useState(false);
  const [payoutName, setPayoutName] = useState('');
  const [payoutDescription, setPayoutDescription] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'settings'>('overview');
  const [isCheckingWithdrawal, setIsCheckingWithdrawal] = useState(false);
  const [hasExistingWithdrawal, setHasExistingWithdrawal] = useState(false);
  const [customDateAmounts, setCustomDateAmounts] = useState<Record<string, number>>({});
  const [customDatesCount, setCustomDatesCount] = useState<number>(0);
  const [nextPayoutAmount, setNextPayoutAmount] = useState<number | null>(null);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [pairedUsers, setPairedUsers] = useState<{ id: string; first_name: string; last_name: string; email?: string }[]>([]);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [sharedPlanBankDisplay, setSharedPlanBankDisplay] = useState<{ bank_name: string; account_number_last4: string; account_name: string } | null>(null);

  const { session } = useAuth();
  const { getShareUrl, ensureShareCode, isLoading: isShareLoading } = usePayoutPlanShare();
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareCode, setShareCode] = useState<string | null>(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const plan = payoutPlans.find(p => p.id === id);
  const isOwner = plan && session?.user?.id && plan.user_id === session.user.id;
  const styles = createStyles(colors, isDark);

  // Open share modal when navigated with openShare=1 (e.g. from create-payout success "Share plan")
  useEffect(() => {
    if (plan?.id && openShare === '1') setShowShareModal(true);
  }, [plan?.id, openShare]);

  // When share modal opens, fetch link and code
  useEffect(() => {
    if (!showShareModal || !plan?.id) {
      if (!showShareModal) {
        setShareLink(null);
        setShareCode(null);
      }
      return;
    }
    let cancelled = false;
    (async () => {
      const [url, code] = await Promise.all([
        getShareUrl(plan.id),
        ensureShareCode(plan.id),
      ]);
      if (!cancelled) {
        setShareLink(url ?? null);
        setShareCode(code ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [showShareModal, plan?.id]);

  // Fetch creator name when viewing as paired user
  useEffect(() => {
    if (!plan?.user_id || !plan?.is_paired) {
      setCreatorName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('profiles').select('first_name, last_name').eq('id', plan.user_id).single();
      if (!cancelled && data) {
        const name = [data.first_name, data.last_name].filter(Boolean).join(' ');
        setCreatorName(name || 'Creator');
      }
    })();
    return () => { cancelled = true; };
  }, [plan?.user_id, plan?.is_paired]);

  // Fetch bank display when inline join is missing (e.g. shared plan: recipient can't see creator's payout_accounts via RLS)
  useEffect(() => {
    const hasInlineBank = plan?.payout_accounts?.bank_name || plan?.bank_accounts?.bank_name;
    if (!plan?.id || hasInlineBank) {
      setSharedPlanBankDisplay(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('get_payout_plan_bank_display', { p_plan_id: plan.id });
      if (cancelled) return;
      if (data && typeof data === 'object' && 'bank_name' in data) {
        setSharedPlanBankDisplay({
          bank_name: String((data as any).bank_name ?? ''),
          account_number_last4: String((data as any).account_number_last4 ?? ''),
          account_name: String((data as any).account_name ?? ''),
        });
      } else {
        setSharedPlanBankDisplay(null);
      }
    })();
    return () => { cancelled = true; };
  }, [plan?.id, plan?.payout_accounts?.bank_name, plan?.bank_accounts?.bank_name]);

  // Fetch paired users when owner (via RPC: profiles RLS blocks reading other users' profiles in a join)
  useEffect(() => {
    if (!plan?.id || !isOwner) {
      setPairedUsers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('get_payout_plan_paired_users', { p_plan_id: plan.id });
      if (cancelled) return;
      const arr = Array.isArray(data) ? data : [];
      const list = arr.map((row: any) => ({
        id: row?.id ?? '',
        first_name: row?.first_name ?? '',
        last_name: row?.last_name ?? '',
        email: row?.email,
      })).filter((u) => u.id);
      setPairedUsers(list);
    })();
    return () => { cancelled = true; };
  }, [plan?.id, isOwner]);

  // Check for existing emergency withdrawals when plan is loaded
  useEffect(() => {
    let isMounted = true;
    
    const checkWithdrawal = async () => {
      if (!plan?.id) return;
      
      setIsCheckingWithdrawal(true);
      try {
        const existing = await checkExistingWithdrawal(plan.id);
        if (isMounted) {
          setHasExistingWithdrawal(existing.exists);
        }
      } catch (error) {
        console.error('Error checking existing withdrawal:', error);
        if (isMounted) {
          setHasExistingWithdrawal(false);
        }
      } finally {
        if (isMounted) {
          setIsCheckingWithdrawal(false);
        }
      }
    };
    
    checkWithdrawal();
    
    return () => {
      isMounted = false;
    };
  }, [plan?.id, checkExistingWithdrawal]);

  // Fetch custom payout dates with amounts for custom frequency plans
  useEffect(() => {
    const fetchCustomAmounts = async () => {
      if (!plan || plan.frequency !== 'custom') {
        setCustomDateAmounts({});
        setCustomDatesCount(0);
        setNextPayoutAmount(null);
        return;
      }

      try {
        console.log('Fetching custom amounts for plan:', plan.id);
        const { data, error } = await supabase
          .from('custom_payout_dates')
          .select('payout_date, amount')
          .eq('payout_plan_id', plan.id)
          .order('payout_date', { ascending: true });

        if (error) {
          console.error('Supabase error fetching custom amounts:', error);
          throw error;
        }

        console.log('Custom dates data received:', data);

        // Set the count of dates
        setCustomDatesCount(data?.length || 0);

        // Convert to Record<string, number>
        const amounts: Record<string, number> = {};
        if (data && data.length > 0) {
          data.forEach((item: any) => {
            const amount = item.amount !== null && item.amount !== undefined 
              ? parseFloat(item.amount.toString()) 
              : 0;
            // If amount is null, undefined, or 0, use plan's payout_amount as fallback
            amounts[item.payout_date] = amount > 0 ? amount : plan.payout_amount;
          });

          // Get the next payout amount if next_payout_date exists
          if (plan.next_payout_date) {
            const nextDateString = new Date(plan.next_payout_date).toISOString().split('T')[0];
            const nextAmount = amounts[nextDateString];
            if (nextAmount !== undefined) {
              setNextPayoutAmount(nextAmount);
            } else {
              // If no custom amount found for next date, use plan's payout_amount
              setNextPayoutAmount(plan.payout_amount);
            }
          } else {
            setNextPayoutAmount(null);
          }
        }

        console.log('Processed custom amounts:', amounts, 'Count:', Object.keys(amounts).length);
        setCustomDateAmounts(amounts);
      } catch (error) {
        console.error('Error fetching custom payout amounts:', error);
        setCustomDateAmounts({});
        setCustomDatesCount(0);
        setNextPayoutAmount(null);
      }
    };

    if (plan?.id) {
      fetchCustomAmounts();
    }
  }, [plan?.id, plan?.frequency, plan?.next_payout_date]);

  useEffect(() => {
    if (plan) {
      setPayoutName(plan.name);
      setPayoutDescription(plan.description || '');
      
      // Animate progress bar
      const progress = Math.round((plan.completed_payouts / plan.duration) * 100);
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }
  }, [plan, progressAnim]);

  // Entry animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchPayoutPlans();
      haptics.notification();
    } catch (error) {
      console.error('Error refreshing payout plan:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Payout Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <PlanmoniLoader size="medium" description="Loading payout details..." />
        </View>
        <SafeFooter />
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable 
            onPress={() => {
              haptics.lightImpact();
              router.back();
            }} 
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Payout Details</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Payout plan not found</Text>
          <Button 
            title="Go Back" 
            onPress={() => {
              haptics.mediumImpact();
              router.back();
            }} 
            style={styles.errorButton}
            hapticType="medium"
          />
        </View>
        <SafeFooter />
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    if (!plan) return;
    
    console.log('💾 Starting payout update process...', {
      planId: plan.id,
      currentName: plan.name,
      newName: payoutName.trim(),
      currentDescription: plan.description,
      newDescription: payoutDescription.trim()
    });
    
    try {
      // Validate inputs
      if (!payoutName.trim()) {
        haptics.notification(Haptics.NotificationFeedbackType.Error);
        showToast('Payout name cannot be empty', 'error');
        return;
      }
      
      // Check if there are any changes
      if (payoutName.trim() === plan.name && payoutDescription.trim() === (plan.description || '')) {
        console.log('ℹ️ No changes detected, exiting edit mode');
        setIsEditing(false);
        return;
      }
      
      console.log('🔄 Calling updatePlan with data:', {
        planId: plan.id,
        updates: {
          name: payoutName.trim(),
          description: payoutDescription.trim() || undefined
        }
      });
      
      // Update the plan
      await updatePlan(plan.id, {
        name: payoutName.trim(),
        description: payoutDescription.trim() || undefined
      });
      
      console.log('✅ updatePlan completed successfully');
      
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      showToast('Payout plan updated successfully', 'success');
      setIsEditing(false);
      
      // Navigate back to dashboard to show updated data
      console.log('🔄 Navigating back to dashboard to show updated payout data...');
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1000); // Small delay to show success message
    } catch (error) {
      console.error('❌ Error updating payout plan:', error);
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      showToast('Failed to update payout plan', 'error');
    }
  };


  const handleEmergencyWithdrawal = async () => {
    haptics.notification(Haptics.NotificationFeedbackType.Warning);
    
    // Check if emergency withdrawal is enabled for this plan
    if (!plan.emergency_withdrawal_enabled) {
      Alert.alert(
        "Emergency Withdrawal Not Available",
        "This payout plan does not have emergency withdrawal enabled. You can enable this feature when creating new payout plans.",
        [{ text: "OK", style: "default" }]
      );
      return;
    }
    
    // CRITICAL: Check for existing withdrawals before navigation
    if (isCheckingWithdrawal) {
      showToast('Please wait while we check for existing requests...', 'info');
      return;
    }
    
    if (hasExistingWithdrawal) {
      Alert.alert(
        "Withdrawal Already Requested",
        "An emergency withdrawal request for this payout plan is already in progress or has been completed. Please check your withdrawal history.",
        [{ text: "OK", style: "default" }]
      );
      return;
    }
    
    router.push({
      pathname: '/emergency-withdrawal',
      params: {
        id: plan.id,
        name: plan.name,
        amount: formatCurrency(plan.total_amount - calculateCompletedAmount())
      }
    });
  };

  const formatCurrency = (amount: number) => {
    return showBalances ? `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••••';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return { bg: '#DCFCE7', text: '#22C55E' };
      case 'paused':
        return { bg: '#FEE2E2', text: '#EF4444' };
      case 'completed':
        return { bg: '#EFF6FF', text: '#1E3A8A' };
      case 'cancelled':
        return { bg: '#F1F5F9', text: '#64748B' };
      default:
        return { bg: '#F1F5F9', text: '#64748B' };
    }
  };

  const calculateProgress = () => {
    return Math.round((plan.completed_payouts / plan.duration) * 100);
  };

  // Calculate completed amount for custom plans
  const calculateCompletedAmount = () => {
    if (plan.frequency === 'custom' && Object.keys(customDateAmounts).length > 0) {
      // For custom plans, we need to sum the amounts of completed payouts
      // Since we don't track which specific dates were completed, we'll use an average
      // or we could fetch completed automated payouts to get exact amounts
      // For now, use average amount per payout
      const totalCustomAmount = Object.values(customDateAmounts).reduce((sum, amount) => sum + amount, 0);
      const averageAmount = totalCustomAmount / Object.keys(customDateAmounts).length;
      return plan.completed_payouts * averageAmount;
    }
    return plan.completed_payouts * plan.payout_amount;
  };

  // Get the original frequency and day of week from metadata
  const originalFrequency = plan.metadata?.originalFrequency || plan.frequency;
  const dayOfWeek = plan.metadata?.dayOfWeek;

  const statusColors = getStatusColor(plan.status);
  const progress = calculateProgress();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Enhanced Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
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
            <Text style={styles.headerTitle}>Payout Details</Text>
            <Text style={styles.headerSubtitle}>
              {plan?.status ? plan.status.charAt(0).toUpperCase() + plan.status.slice(1) : 'Loading...'}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {isOwner && (
            <Pressable
              style={styles.headerActionButton}
              onPress={() => {
                haptics.selection();
                setShowShareModal(true);
              }}
            >
              <Share2 size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Tab Navigation */}
      {/* <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
          {[
            { key: 'overview', label: 'Overview', icon: BarChart3 },
            { key: 'transactions', label: 'Transactions', icon: Activity },
            { key: 'settings', label: 'Settings', icon: PencilLine }
          ].map((tab) => {
            const IconComponent = tab.icon;
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
                  setActiveTab(tab.key as any);
                }}
              >
                <IconComponent 
                  size={16} 
                  color={activeTab === tab.key ? '#FFFFFF' : colors.textSecondary} 
                />
                <Text style={[
                  styles.tabText,
                  activeTab === tab.key && styles.activeTabText
                ]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View> */}

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
        {/* Hero Card */}
        <Animated.View 
          style={[
            styles.heroCard,
            { backgroundColor: colors.card },
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.heroHeader}>
            <View style={styles.heroTitleContainer}>
              {isEditing ? (
                <View style={styles.editContainer}>
                  <TextInput
                    style={styles.nameInput}
                    value={payoutName}
                    onChangeText={(text) => {
                      if (text.length <= 50) {
                        setPayoutName(text);
                      }
                    }}
                    autoFocus
                    placeholder="Plan name"
                    placeholderTextColor={colors.textTertiary}
                    maxLength={50}
                  />
                  <TextInput
                    style={styles.descriptionInput}
                    value={payoutDescription}
                    onChangeText={setPayoutDescription}
                    placeholder="Add a description"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />
                  <View style={styles.editButtons}>
                    <Pressable 
                      style={styles.cancelButton} 
                      onPress={() => {
                        haptics.lightImpact();
                        setPayoutName(plan.name);
                        setPayoutDescription(plan.description || '');
                        setIsEditing(false);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.saveButton} onPress={handleSave}>
                      <Text style={styles.saveButtonText}>Save</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.nameContainer}>
                    <Text style={styles.heroTitle}>{plan.name}</Text>
                    {plan.status === 'active' && isOwner && (
                      <Pressable 
                        style={styles.editButton} 
                        onPress={() => {
                          haptics.selection();
                          setIsEditing(true);
                        }}
                      >
                        <PencilLine size={20} color={colors.textSecondary} />
                      </Pressable>
                    )}
                  </View>
                  {plan.is_paired && creatorName && (
                    <Text style={[styles.sharedByText, { color: colors.textSecondary }]}>
                      Shared by {creatorName}
                    </Text>
                  )}
                  {plan.description && (
                    <Text style={styles.heroDescription}>{plan.description}</Text>
                  )}
                </>
              )}
            </View>
            {/* <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
              </Text>
            </View> */}
          </View>
          
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{formatCurrency(plan.total_amount)}</Text>
              <Text style={styles.heroStatLabel}>Total Value</Text>
            </View>
            <View style={styles.heroStat}>
              {plan.frequency === 'custom' && customDatesCount > 0 ? (
                <View style={styles.customAmountsHero}>
                  <Text style={styles.heroStatValue}>Custom</Text>
                  {/* <Text style={styles.heroStatLabel}>Per Payout</Text> */}
                  {Object.keys(customDateAmounts).length > 0 && (
                    <Pressable
                      onPress={() => {
                        setShowBreakdownModal(true);
                        haptics.selection();
                      }}
                      style={styles.seeBreakdownLinkHero}
                    >
                      <Text style={styles.seeBreakdownTextHero}>breakdown</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <>
                  <Text style={styles.heroStatValue}>{formatCurrency(plan.payout_amount)}</Text>
                  <Text style={styles.heroStatLabel}>Per Payout</Text>
                </>
              )}
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{plan.duration}</Text>
              <Text style={styles.heroStatLabel}>Duration</Text>
            </View>
          </View>
        </Animated.View>

        {/* Progress Card */}
        <Animated.View 
          style={[
            styles.progressCard,
            { backgroundColor: colors.card },
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Progress Overview</Text>
            <Text style={styles.progressPercentage}>{progress}%</Text>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <Animated.View 
                style={[
                  styles.progressFill, 
                  { 
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                      extrapolate: 'clamp',
                    })
                  }
                ]} 
              />
            </View>
          </View>
          
          <View style={styles.progressStats}>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatValue}>
                {formatCurrency(calculateCompletedAmount())}
              </Text>
              <Text style={styles.progressStatLabel}>Completed</Text>
            </View>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatValue}>
                {formatCurrency(plan.total_amount - calculateCompletedAmount())}
              </Text>
              <Text style={styles.progressStatLabel}>Remaining</Text>
            </View>
            <View style={styles.progressStat}>
              <Text style={styles.progressStatValue}>
                {plan.completed_payouts}/{plan.duration}
              </Text>
              <Text style={styles.progressStatLabel}>Payouts</Text>
            </View>
          </View>
          
          <View style={styles.nextPayoutInfo}>
            <Calendar size={16} color={colors.textSecondary} />
            <Text style={styles.nextPayoutText}>
              {plan.status === 'cancelled' 
                ? `Cancelled: ${new Date(plan.updated_at).toLocaleDateString()}`
                : plan.next_payout_date 
                  ? plan.frequency === 'custom' && nextPayoutAmount !== null
                    ? `Next payout: ${new Date(plan.next_payout_date).toLocaleDateString()} • ${formatCurrency(nextPayoutAmount)}`
                    : `Next payout: ${new Date(plan.next_payout_date).toLocaleDateString()}`
                  : plan.status === 'completed' 
                    ? 'Plan completed'
                    : 'Plan paused'
              }
            </Text>
          </View>
        </Animated.View>

        {/* Schedule Information */}
        <Animated.View 
          style={[
            styles.scheduleCard,
            { backgroundColor: colors.card },
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={styles.sectionTitle}>Schedule Information</Text>
          
          <View style={styles.scheduleGrid}>
            <View style={styles.scheduleItem}>
              <View style={[styles.scheduleIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <CalendarIcon size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={styles.scheduleLabel}>Frequency</Text>
                <Text style={styles.scheduleValue}>
                  {formatPayoutFrequency(originalFrequency, dayOfWeek)}
                </Text>
              </View>
            </View>

            <View style={styles.scheduleItem}>
              <View style={[styles.scheduleIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <ClockIcon size={20} color={colors.textSecondary}/>
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={styles.scheduleLabel}>Duration</Text>
                <Text style={styles.scheduleValue}>{plan.duration} payouts</Text>
              </View>
            </View>

            <View style={styles.scheduleItem}>
              <View style={[styles.scheduleIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <DollarSign size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={styles.scheduleLabel}>Per Payout</Text>
                {plan.frequency === 'custom' && customDatesCount > 0 ? (
                  <View style={styles.customAmountsSchedule}>
                    <Text style={styles.scheduleValue}>Custom Amounts</Text>
                    {Object.keys(customDateAmounts).length > 0 && (
                      <Pressable
                        onPress={() => {
                          setShowBreakdownModal(true);
                          haptics.selection();
                        }}
                        style={styles.seeBreakdownLink}
                      >
                        <Text style={styles.seeBreakdownText}>See breakdown</Text>
                      </Pressable>
                    )}
                  </View>
                ) : (
                  <Text style={styles.scheduleValue}>{formatCurrency(plan.payout_amount)}</Text>
                )}
              </View>
            </View>

            <View style={styles.scheduleItem}>
              <View style={[styles.scheduleIcon, { backgroundColor: colors.backgroundTertiary }]}>
                {(() => {
                  const bankName = plan.payout_accounts?.bank_name || plan.bank_accounts?.bank_name || sharedPlanBankDisplay?.bank_name || '';
                  const bankIcon = getBankIconLogo(bankName);
                  if (bankIcon.logoSvg) {
                    return React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
                      width: 20,
                      height: 20,
                      fill: "#0EA5E9"
                    });
                  } else if (bankIcon.logo) {
                    return (
                      <Image 
                        source={bankIcon.logo} 
                        style={{ width: 20, height: 20, resizeMode: 'contain' }}
                      />
                    );
                  } else {
                    return <Building2 size={20} color={colors.textSecondary} />;
                  }
                })()}
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={styles.scheduleLabel}>Bank Account</Text>
                <Text style={styles.scheduleValue}>
                  {(plan.payout_accounts?.bank_name || plan.bank_accounts?.bank_name || sharedPlanBankDisplay?.bank_name || 'Unknown Bank')} •••• {(plan.payout_accounts?.account_number || plan.bank_accounts?.account_number) != null ? (plan.payout_accounts?.account_number || plan.bank_accounts?.account_number || '').slice(-4) : (sharedPlanBankDisplay?.account_number_last4 || '')}
                </Text>
                <Text style={styles.scheduleSubtext}>
                  {(plan.payout_accounts?.account_name || plan.bank_accounts?.account_name || sharedPlanBankDisplay?.account_name || 'Unknown Account')}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {isOwner && (
          <Animated.View 
            style={[
              styles.scheduleCard,
              { backgroundColor: colors.card },
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.pairedSectionHeader}>
              <Users size={20} color={colors.textSecondary} />
            </View>
            {pairedUsers.length === 0 ? (
              <Text style={[styles.pairedEmpty, { color: colors.textSecondary }]}>
                No one has joined yet. Tap the share icon above to copy a link and invite others.
              </Text>
            ) : (
              <>
                <Text style={[styles.pairedCount, { color: colors.textSecondary }]}>
                  {pairedUsers.length} {pairedUsers.length === 1 ? 'person' : 'people'} joined
                </Text>
                {pairedUsers.map((u) => (
                  <View key={u.id} style={[styles.pairedRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.pairedName, { color: colors.text }]} numberOfLines={1}>
                      {[u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'Unknown'}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </Animated.View>
        )}

        {/* {plan.status !== 'cancelled' && plan.status !== 'completed' && (
          <Animated.View 
            style={[
              styles.emergencyCard,
              { backgroundColor: colors.card },
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Text style={styles.sectionTitle}>Emergency Access</Text>
            <View style={styles.warningHeader}>
              <AlertTriangle size={20} color="#F97316" />
              <Text style={styles.warningTitle}>
                {plan.emergency_withdrawal_enabled 
                  ? "Emergency Withdrawal Available" 
                  : "Emergency Withdrawal Not Enabled"}
              </Text>
            </View>
            <Text style={styles.warningDescription}>
              {plan.emergency_withdrawal_enabled 
                ? "You can withdraw your funds before the scheduled date, but this may attract a fee depending on how quickly you need the funds."
                : "This payout plan does not have emergency withdrawal enabled. You can enable this feature when creating new payout plans."}
            </Text>
            <Pressable 
              style={[
                styles.withdrawButton,
                (!plan.emergency_withdrawal_enabled || hasExistingWithdrawal || isCheckingWithdrawal) && styles.disabledButton
              ]}
              onPress={handleEmergencyWithdrawal}
              disabled={!plan.emergency_withdrawal_enabled || hasExistingWithdrawal || isCheckingWithdrawal || isWithdrawalLoading}
            >
              <Text style={[
                styles.withdrawButtonText,
                (!plan.emergency_withdrawal_enabled || hasExistingWithdrawal || isCheckingWithdrawal) && styles.disabledButtonText
              ]}>
                {isCheckingWithdrawal 
                  ? "Checking..." 
                  : hasExistingWithdrawal 
                    ? "Withdrawal Already Requested"
                    : "Request Emergency Withdrawal"}
              </Text>
            </Pressable>
          </Animated.View>
        )} */}

        {plan.status === 'cancelled' && plan.emergency_withdrawal_enabled && (
          <Animated.View 
            style={[
              styles.emergencyCard,
              { backgroundColor: colors.card },
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Text style={styles.sectionTitle}>Cancellation Details</Text>
            <View style={styles.warningHeader}>
              <AlertTriangle size={20} color="#F97316" />
              <Text style={styles.warningTitle}>Emergency Withdrawal Completed</Text>
            </View>
            <Text style={styles.warningDescription}>
              This payout plan was cancelled due to an emergency withdrawal. The remaining funds have been withdrawn and the plan is no longer active.
            </Text>
            <Text style={styles.cancellationDate}>
              Withdrawn on: {new Date(plan.updated_at).toLocaleDateString()}
            </Text>
          </Animated.View>
        )}
      </ScrollView>
      
      <SafeFooter />

      {/* Share plan modal: link and code preview with copy buttons */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <Pressable
          style={[styles.shareModalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          onPress={() => setShowShareModal(false)}
        >
          <Pressable style={[styles.shareModalCard, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.shareModalTitle, { color: colors.text }]}>Share plan</Text>
            <Text style={[styles.shareModalSubtitle, { color: colors.textSecondary }]}>
              Others can follow this plan using the link or code.
            </Text>

            {/* Link row */}
            <View style={[styles.shareModalRow, { borderBottomColor: colors.border }]}>
              <View style={styles.shareModalRowLabel}>
                <Link size={18} color={colors.textSecondary} />
                <Text style={[styles.shareModalRowLabelText, { color: colors.textSecondary }]}>Link</Text>
              </View>
              {isShareLoading && !shareLink ? (
                <Text style={[styles.shareModalPreview, { color: colors.textSecondary }]}>Loading…</Text>
              ) : shareLink ? (
                <>
                  <Text style={[styles.shareModalPreview, { color: colors.text }]} numberOfLines={2} ellipsizeMode="middle">
                    {shareLink}
                  </Text>
                  <Pressable
                    style={[styles.shareModalCopyBtn, { backgroundColor: colors.backgroundTertiary }]}
                    onPress={async () => {
                      haptics.selection();
                      await Clipboard.setStringAsync(shareLink);
                      showToast('Link copied.');
                    }}
                  >
                    <Copy size={18} color={colors.primary} />
                  </Pressable>
                </>
              ) : (
                <Text style={[styles.shareModalPreview, { color: colors.textSecondary }]}>Could not load link</Text>
              )}
            </View>

            {/* Code row */}
            <View style={[styles.shareModalRow, { borderBottomColor: colors.border }]}>
              <View style={styles.shareModalRowLabel}>
                <Hash size={18} color={colors.textSecondary} />
                <Text style={[styles.shareModalRowLabelText, { color: colors.textSecondary }]}>Code</Text>
              </View>
              {isShareLoading && !shareCode ? (
                <Text style={[styles.shareModalPreview, { color: colors.textSecondary }]}>Loading…</Text>
              ) : shareCode ? (
                <>
                  <Text style={[styles.shareModalCodePreview, { color: colors.text }]} selectable>
                    {shareCode}
                  </Text>
                  <Pressable
                    style={[styles.shareModalCopyBtn, { backgroundColor: colors.backgroundTertiary }]}
                    onPress={async () => {
                      haptics.selection();
                      await Clipboard.setStringAsync(shareCode);
                      showToast('Code copied.');
                    }}
                  >
                    <Copy size={18} color={colors.primary} />
                  </Pressable>
                </>
              ) : (
                <Text style={[styles.shareModalPreview, { color: colors.textSecondary }]}>Could not load code</Text>
              )}
            </View>

            <Pressable
              style={[styles.shareModalCancel, { borderTopColor: colors.border }]}
              onPress={() => setShowShareModal(false)}
            >
              <Text style={[styles.shareModalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {plan && plan.frequency === 'custom' && customDatesCount > 0 && Object.keys(customDateAmounts).length > 0 && (
        <CustomAmountsBreakdownModal
          isVisible={showBreakdownModal}
          onClose={() => setShowBreakdownModal(false)}
          customAmounts={customDateAmounts}
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
    fontWeight: '600',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  shareModalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    overflow: 'hidden',
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 20,
    marginHorizontal: 20,
  },
  shareModalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  shareModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  shareModalRowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 44,
  },
  shareModalRowLabelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  shareModalPreview: {
    flex: 1,
    fontSize: 13,
  },
  shareModalCodePreview: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
  },
  shareModalCopyBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareModalCancel: {
    borderTopWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shareModalCancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  tabContainer: {
    backgroundColor: colors.surface,
    paddingVertical: 8,
  },
  tabContent: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  errorButton: {
    minWidth: 120,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
    gap: 20,
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  heroTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  sharedByText: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 2,
  },
  heroDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroStat: {
    alignItems: 'center',
    flex: 1,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  heroStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  customPayoutSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  customAmountsHero: {
    alignItems: 'center',
    gap: 4,
  },
  seeBreakdownLinkHero: {
    marginTop: 4,
  },
  seeBreakdownTextHero: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  progressCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  progressPercentage: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.primary,
  },
  progressBarContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  progressStat: {
    alignItems: 'center',
    flex: 1,
  },
  progressStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  progressStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  nextPayoutInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextPayoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  scheduleCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 20,
  },
  scheduleGrid: {
    gap: 16,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scheduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  scheduleValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  customAmountsSchedule: {
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
  scheduleSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pairedSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pairedEmpty: {
    fontSize: 14,
    lineHeight: 20,
  },
  pairedCount: {
    fontSize: 14,
    marginBottom: 8,
  },
  pairedRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  pairedName: {
    fontSize: 15,
    fontWeight: '500',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editContainer: {
    gap: 12,
  },
  nameInput: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    padding: 0,
  },
  descriptionInput: {
    fontSize: 16,
    color: colors.textSecondary,
    padding: 0,
    minHeight: 40,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  emergencyCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F97316',
  },
  warningDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  withdrawButton: {
    backgroundColor: colors.primary,
    padding: 12,
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  withdrawButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff'
  },
  disabledButton: {
    backgroundColor: colors.textTertiary,
    opacity: 0.7,
  },
  disabledButtonText: {
    color: colors.textTertiary,
  },
  cancellationDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    fontWeight: '500',
  },
});