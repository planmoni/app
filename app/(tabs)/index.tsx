import React, { useState, useEffect, useRef } from 'react';
import TransactionModal from '@/components/TransactionModal';
import AccountCreationSuccessModal from '@/components/AccountCreationSuccessModal';
import ClaimAccountModal from '@/components/ClaimAccountModal';
import NewPlanInfoModal from '@/components/NewPlanInfoModal';
import AccountInformationModal from '@/components/AccountInformationModal';
import PlanCreationModal from '@/components/PlanCreationModal';
import AppLockModal from '@/components/AppLockModal';
import InitialsAvatar from '@/components/InitialsAvatar';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import PendingActionsCard from '@/components/PendingActionsCard';
import KYCCard from '@/components/KYCCard';
import ImageCarousel from '@/components/ImageCarousel';
import MostRecentPayoutsCard from '@/components/MostRecentPayoutsCard';
// import { IntercomButton } from '@/components/IntercomButton';
import { useRoute, useNavigation } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  HelpCircleIcon,
  Eye,
  EyeOff,
  Plus,
  CalendarCheck,
  Clock,
} from 'lucide-react-native';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  ImageBackground,
  Image,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBalance } from '@/contexts/BalanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { useAppLock } from '@/contexts/AppLockContext';
import { getScaledFontSize } from '@/lib/textSize';
import { usePin } from '@/contexts/PinContext';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions';
import { useKYCProgress } from '@/hooks/useKYCProgress';
// import { usePaystackTransactions } from '@/hooks/usePaystackTransactions';
import { useHaptics } from '@/hooks/useHaptics';
import { useRecentAccountCreation } from '@/hooks/useRecentAccountCreation';
import { logAnalyticsEvent } from '@/lib/firebase';
// import { intercomInstant } from '@/lib/IntercomInstant';
import NotificationIcon from '@/components/NotificationIcon';
import { supabase } from '@/lib/supabase';
import NextPayoutCard from '@/components/NextPayoutCard';
import PayoutPlansSection from '@/components/PayoutPlansSection';
import RatingCard from '@/components/RatingCard';
import AISuggestionCard from '@/components/AISuggestionCard';
import OnTrackCard from '@/components/OnTrackCard';
// import { intercomService } from '@/lib/intercom';
import { useIntercom } from '@/hooks/useIntercom';
// import LivenessTestEnhanced from '@/components/LivenessTestEnhanced';

interface Banner {
  id: string;
  title?: string;
  description?: string | null;
  image_url: string;
  cta_text?: string | null;
  link_url?: string | null;
  order_index?: number;
  is_active?: boolean;
}

export default function HomeScreen() {
  const { showBalances, toggleBalances, balance, lockedBalance, availableBalance, refreshWallet, isLoading: balanceLoading } = useBalance();
  const { session } = useAuth();
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { updateLastActiveOnInteraction } = useAppLock();
  const { payoutPlans, isLoading: payoutPlansLoading, fetchPayoutPlans } = useRealtimePayoutPlans();
  const { isRecentAccount, isLoading: recentAccountLoading } = useRecentAccountCreation();
  const { checkTierCompletion, loading: kycProgressLoading, progress, loadProgress } = useKYCProgress();
  const navigation = useNavigation();
  
  // Debug: Track payoutPlans changes
  useEffect(() => {
    console.log('📊 Dashboard: payoutPlans updated', {
      count: payoutPlans.length,
      plans: payoutPlans.map(p => ({ id: p.id, name: p.name, status: p.status }))
    });
  }, [payoutPlans]);
  const { transactions, isLoading: transactionsLoading, fetchTransactions } = useRealtimeTransactions();
  // const { fetchPaystackTransactions, isLoading: paystackLoading } = usePaystackTransactions();
  const { impact, notification } = useHaptics();
  const [isTransactionModalVisible, setIsTransactionModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [carouselImages, setCarouselImages] = useState<any[]>([]);
  const [imagesReady, setImagesReady] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [hasShownWelcomeModal, setHasShownWelcomeModal] = useState(false);
  const [showClaimAccountModal, setShowClaimAccountModal] = useState(false);
  const [hasShownTier1ClaimModal, setHasShownTier1ClaimModal] = useState(false);
  const [showNewPlanInfoModal, setShowNewPlanInfoModal] = useState(false);
  const [showAccountInfoModal, setShowAccountInfoModal] = useState(false);
  const [hasShownAccountInfoModal, setHasShownAccountInfoModal] = useState(false);
  const accountInfoModalShownRef = useRef(false);
  const [showPlanCreationModal, setShowPlanCreationModal] = useState(false);
  const [lastDepositAmount, setLastDepositAmount] = useState<number | null>(null);
  const [lastShownDepositId, setLastShownDepositId] = useState<string | null>(null);
  const [shownDepositIds, setShownDepositIds] = useState<Set<string>>(new Set());
  const [hasDismissedDepositModal, setHasDismissedDepositModal] = useState(false);
  const [showAppLockModal, setShowAppLockModal] = useState(false);
  const [hasShownAppLockModal, setHasShownAppLockModal] = useState(false);
  const { hasAppLockPin } = usePin();
  const route = useRoute();
  const scrollY = (route.params as { scrollY?: Animated.Value })?.scrollY || new Animated.Value(0);

  // Prevent navigation back to welcome page when authenticated
  useEffect(() => {
    if (!session?.user?.id) return;

    // Dynamically disable gestures when authenticated
    navigation.setOptions({
      gestureEnabled: false,
    });

    // Handle Android back button
    const backHandler = Platform.OS === 'android' 
      ? BackHandler.addEventListener('hardwareBackPress', () => {
          // Prevent back navigation when authenticated
          return true; // Return true to prevent default back behavior
        })
      : null;

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Always prevent going back when authenticated - block all back navigation
      // This prevents going back to welcome page (index route) or any previous screen
      const action = e.data.action;
      
      // Only block back navigation types, not forward navigation
      if (action.type === 'GO_BACK' || action.type === 'POP') {
        e.preventDefault();
        return;
      }
      
      // Also block navigation to index route
      if (action.type === 'NAVIGATE') {
        const targetRoute = (action.payload as any)?.name;
        if (targetRoute === 'index') {
          e.preventDefault();
          return;
        }
      }
      
      // Allow PUSH actions (forward navigation) to proceed
      if (action.type === 'PUSH' || action.type === 'NAVIGATE') {
        // Check if it's navigating away from tabs (forward navigation)
        const targetRoute = (action.payload as any)?.name;
        if (targetRoute && targetRoute !== 'index' && !targetRoute.includes('(tabs)')) {
          // Allow forward navigation to proceed
          return;
        }
      }
    });

    return () => {
      unsubscribe();
      if (backHandler) {
        backHandler.remove();
      }
      // Re-enable gestures when component unmounts (if needed)
      navigation.setOptions({
        gestureEnabled: false, // Keep disabled even on unmount
      });
    };
  }, [navigation, session?.user?.id]);

  // Intercom
  const { openChat, isLoading, isSupported } = useIntercom();
  // Get user info from session
  const firstName = session?.user?.user_metadata?.first_name || 'User';
  const lastName = session?.user?.user_metadata?.last_name || '';
  const email = session?.user?.email || '';

  // Show welcome modal if account was created recently
  useEffect(() => {
    if (!recentAccountLoading && isRecentAccount && !showWelcomeModal && !hasShownWelcomeModal) {
      // Add a small delay to ensure the dashboard is fully loaded
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isRecentAccount, recentAccountLoading, showWelcomeModal, hasShownWelcomeModal]);

  // Don't show ClaimAccountModal after Tier 1 completion - user can navigate directly to add funds
  // Removed the useEffect that automatically shows ClaimAccountModal after Tier 1 completion

  // Show AccountInformationModal only when coming from Tier1CompletionModal
  const params = useLocalSearchParams();
  useEffect(() => {
    if (!session?.user?.id) return;
    
    const shouldShowAccountInfo = params.showAccountInfo === 'true';
    
    if (shouldShowAccountInfo && !hasShownAccountInfoModal && !accountInfoModalShownRef.current) {
      accountInfoModalShownRef.current = true;
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setShowAccountInfoModal(true);
      }, 500);
      
      // Clear the param after showing modal
      router.setParams({ showAccountInfo: undefined });
      
      return () => clearTimeout(timer);
    }
  }, [params.showAccountInfo, session?.user?.id, hasShownAccountInfoModal]);

  // Load shown deposit IDs and dismissed modal flag from storage on mount
  useEffect(() => {
    if (!session?.user?.id) return;

    const loadDepositModalState = async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const key = `shown_deposit_ids_${session.user.id}`;
        const dismissedKey = `deposit_modal_dismissed_${session.user.id}`;
        
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const ids = JSON.parse(stored) as string[];
          setShownDepositIds(new Set(ids));
        }
        
        const dismissed = await AsyncStorage.getItem(dismissedKey);
        if (dismissed === 'true') {
          setHasDismissedDepositModal(true);
        }
      } catch (error) {
        console.error('Error loading deposit modal state:', error);
      }
    };

    loadDepositModalState();
  }, [session?.user?.id]);

  // Detect new deposits and show PlanCreationModal
  useEffect(() => {
    if (!session?.user?.id || transactions.length === 0 || hasDismissedDepositModal) return;

    const depositTransactions = transactions.filter(
      t => t.type === 'deposit' && t.status === 'completed'
    );

    if (depositTransactions.length > 0) {
      const latestDeposit = depositTransactions[0];
      const depositAmount = latestDeposit.amount;
      const depositId = latestDeposit.id;

      // Check if this deposit has already been shown
      if (!shownDepositIds.has(depositId)) {
        // Small delay to ensure transaction is processed
        const timer = setTimeout(async () => {
          setShowPlanCreationModal(true);
          setLastDepositAmount(depositAmount);
          setLastShownDepositId(depositId);
          
          // Mark this deposit as shown and persist it
          const newShownIds = new Set(shownDepositIds);
          newShownIds.add(depositId);
          setShownDepositIds(newShownIds);
          
          // Persist to AsyncStorage
          try {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            const key = `shown_deposit_ids_${session.user.id}`;
            await AsyncStorage.setItem(key, JSON.stringify(Array.from(newShownIds)));
          } catch (error) {
            console.error('Error saving shown deposit IDs:', error);
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [transactions, session?.user?.id, shownDepositIds, hasDismissedDepositModal]);

  // Show AppLockModal if no PIN is set up AND user just created their first plan
  useEffect(() => {
    if (!session?.user?.id || hasAppLockPin || hasShownAppLockModal) return;

    // Check if this is the first plan
    if (payoutPlans.length === 1) {
      // Small delay to ensure plan is created
      const timer = setTimeout(() => {
        setShowAppLockModal(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [payoutPlans.length, hasAppLockPin, session?.user?.id, hasShownAppLockModal]);
  
  // Log screen view for analytics
  useEffect(() => {
    logAnalyticsEvent('screen_view', {
      screen_name: 'Home',
      screen_class: 'HomeScreen',
    });
  }, []);

  // Fetch carousel images from Supabase
  const fetchCarouselImages = async () => {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (error) {
        return;
      }

      if (data && data.length > 0) {
        // Pre-load all images to ensure they're available
        const preloadedImages = await Promise.all(
          data.map(async (banner: Banner) => {
            try {
              // Use React Native's Image.getSize to preload the image
              await new Promise<void>((resolve, reject) => {
                Image.getSize(
                  banner.image_url,
                  () => resolve(),
                  (error) => reject(error)
                );
              });
              return banner;
            } catch (error) {
              return banner; // Return banner even if image fails to load
            }
          })
        );

        setCarouselImages(preloadedImages);
        setImagesReady(true);
      }
    } catch (error) {
    }
  };

  // Fetch images on component mount
  useEffect(() => {
    fetchCarouselImages();
  }, []);

  const handleProfilePress = () => {
    router.push('/profile');
    logAnalyticsEvent('profile_click');
  };

  // Handle pull-to-refresh - refresh all page data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Refresh all data in parallel for better performance
      await Promise.all([
        // Refresh wallet balance
        refreshWallet(),
        // Refresh payout plans
        fetchPayoutPlans(),
        // Refresh transactions
        fetchTransactions(),
        // Refresh KYC progress
        loadProgress(),
        // Refresh carousel images
        fetchCarouselImages(),
      ]);
      
      // Add haptic feedback for successful refresh
      impact();
    } catch (error) {
      console.error('Error refreshing page data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  // Intercom not supported on web
  if (!isSupported) {
    return null; // Don't render on web
  }
  const handleHelpPress = async () => {
    try {
      // setIsHelpLoading(true);
      console.log('🎯 Help button pressed - opening Intercom instantly');
      await openChat();
      
      logAnalyticsEvent('help_click');
      
    } catch (error) {
      console.error('❌ Failed to open Intercom:', error);
      
      // Show user-friendly error
      Alert.alert(
        'Support Chat Unavailable',
        'Unable to open support chat at the moment. This might be due to network connectivity issues. Would you like to try again?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Retry', 
            onPress: () => {
              console.log('🔄 Retrying Intercom...');
              handleHelpPress();
            }
          }
        ]
      );
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const getGreeting = () => {
    const hour = currentDate.getHours();
    
    if (hour >= 0 && hour < 12) {
      return 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good afternoon';
    } else {
      return 'Good evening';
    }
  };

  const buttonOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const formatBalance = (amount: number) => {
    return showBalances ? `₦${amount.toLocaleString()}` : '*********';
  };

  const handleAddFunds = async () => {
    // Trigger medium impact haptic feedback
    impact();
    
    // Check if user has completed Tier 1
    const tierCompletion = checkTierCompletion();
    
    // Check if user has an account
    let hasAccount = false;
    if (session?.user?.id) {
      try {
        const { data } = await supabase
          .from('safehaven_accounts')
          .select('id, account_number')
          .eq('user_id', session.user.id)
          .eq('is_deleted', false)
          .not('account_number', 'ilike', 'PENDING_%')
          .maybeSingle();
        
        hasAccount = !!(data && data.account_number && !data.account_number.startsWith('PENDING_'));
      } catch (error) {
        console.error('Error checking account:', error);
      }
    }
    
    // If Tier 1 is complete, navigate directly to add funds page
    if (tierCompletion.tier1) {
      router.push('/add-funds');
      logAnalyticsEvent('add_funds_click');
      return;
    }
    
    // If Tier 1 not complete or no account, show ClaimAccountModal
    if (!hasAccount || !tierCompletion.tier1) {
      setShowClaimAccountModal(true);
      logAnalyticsEvent('add_funds_click_claim_modal');
    } else {
    // Navigate directly to add funds page
    router.push('/add-funds');
    logAnalyticsEvent('add_funds_click');
    }
  };

  const handleCreatePayout = () => {
    // Trigger medium impact haptic feedback
    impact();
    
    // Check if balance is ₦0 and no payout plans exist
    const hasNoBalance = balance === 0 && availableBalance === 0;
    const hasNoPlans = payoutPlans.length === 0;
    
    // If no balance and no plans, show info modal
    if (hasNoBalance && hasNoPlans) {
      setShowNewPlanInfoModal(true);
      logAnalyticsEvent('create_payout_click_no_balance_modal');
    } else {
      // Navigate directly to create payout
    router.push('/create-payout/amount');
    logAnalyticsEvent('create_payout_click');
    }
  };

  const handleAISuggestionPress = (suggestion: any) => {
    // Trigger haptic feedback
    impact();
    // Navigate directly to schedule page with full balance and suggested frequency
    router.push({
      pathname: '/create-payout/schedule',
      params: {
        totalAmount: availableBalance.toString(),
        suggestedFrequency: suggestion.frequency,
        suggestedDuration: suggestion.duration.toString()
      }
    });
    logAnalyticsEvent('ai_suggestion_used', {
      suggestion_id: suggestion.id,
      suggestion_title: suggestion.title,
      suggested_amount: suggestion.amount,
      total_amount: availableBalance
    });
  };  const handleViewPayout = (id?: string) => {
    // Trigger selection haptic feedback
    notification();
    if (id) {
      router.push({
        pathname: '/view-payout',
        params: { id }
      });
      logAnalyticsEvent('view_payout', { payout_id: id });
    } else {
      router.push('/view-payout');
      logAnalyticsEvent('view_payout');
    }
  };

  const handleViewAllPayouts = () => {
    router.push('/all-payouts');
    logAnalyticsEvent('view_all_payouts');
  };

  const handleStartVerification = async () => {
    try {
      // Create audit log for KYC verification start
      const { data: auditLogId } = await supabase.rpc('create_kyc_audit_log', {
        p_user_id: session?.user?.id,
        p_operation_type: 'kyc_initiated',
        p_verification_type: 'document',
        p_verification_provider: 'internal',
        p_request_data: {
          action: 'start_kyc_verification',
          source: 'home_screen',
          timestamp: new Date().toISOString()
        },
        p_response_data: {
          user_action: 'clicked_start_verification_button',
          navigation_target: '/kyc-upgrade'
        },
        p_status: 'success',
        p_result_message: 'User initiated KYC verification process',
        p_metadata: {
          component: 'HomeScreen',
          action: 'start_verification',
          source: 'welcome_modal'
        }
      });

      // Create audit event for KYC initiation
      if (auditLogId) {
        await supabase
          .from('kyc_audit_events')
          .insert({
            audit_log_id: auditLogId,
            user_id: session?.user?.id,
            event_type: 'verification_started',
            event_data: {
              action: 'kyc_initiation',
              source: 'home_screen',
              component: 'HomeScreen'
            },
            severity: 'medium'
          });
      }
    } catch (error) {
      console.error('Error creating KYC audit log for verification start:', error);
      // Continue with the action even if audit fails
    }

    setShowWelcomeModal(false);
    setHasShownWelcomeModal(true);
    router.push('/kyc-upgrade');
  };

  const handleGoToDashboard = () => {
    setShowWelcomeModal(false);
    setHasShownWelcomeModal(true);
    // Modal is already on dashboard, just close it
  };

  // Handle transaction press from MostRecentPayoutsCard
  const handleTransactionPress = (transaction: any) => {
    // Find the payout plan to get bank information
    const plan = payoutPlans.find(p => p.id === transaction.payout_plan_id);
    
    // Get bank info from the payout plan's linked account
    let bankName = 'Unknown Bank';
    let accountNumber = '****';
    
    if (plan?.payout_accounts) {
      bankName = plan.payout_accounts.bank_name;
      accountNumber = plan.payout_accounts.account_number;
    } else if (plan?.bank_accounts) {
      bankName = plan.bank_accounts.bank_name;
      accountNumber = plan.bank_accounts.account_number;
    }

    // Format transaction data for the modal
    const formattedTransaction = {
      ...transaction,
      amount: `₦${transaction.amount.toLocaleString()}`,
      status: transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1),
      date: new Date(transaction.created_at).toLocaleDateString(),
      time: new Date(transaction.created_at).toLocaleTimeString(),
      type: transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1),
      source: plan?.name || transaction.source,
      destination: `${bankName} •••• ${accountNumber.slice(-4)}`, // Use actual bank name
      transactionId: transaction.id,
      planRef: transaction.payout_plan_id || '',
      paymentMethod: transaction.type === 'deposit' ? 'Bank Transfer' : 
        transaction.bank_account_id ? 
        `Bank Account •••• ${transaction.bank_account_id.slice(-4)}` : 
        'Bank Account',
      initiatedBy: 'You',
      processingTime: transaction.status === 'completed' ? 'Instant' : '2-3 business days',
    };
    
    setSelectedTransaction(formattedTransaction);
    setIsTransactionModalVisible(true);
    logAnalyticsEvent('view_transaction', { transaction_id: transaction.id, transaction_type: transaction.type });
  };

  // Get active payout plans for display
  const activePlans = payoutPlans.filter(plan => plan.status === 'active').slice(0, 3);
  
  // Debug: Track activePlans changes
  useEffect(() => {
    console.log('🎯 Dashboard: activePlans updated', {
      count: activePlans.length,
      plans: activePlans.map(p => ({ id: p.id, name: p.name }))
    });
  }, [activePlans]);
  
  // Find the next payout - the one with the earliest next_payout_date that hasn't expired
  const nextPayout = payoutPlans
    .filter(plan => {
      // Only include active plans with a valid next payout date
      if (plan.status !== 'active' || !plan.next_payout_date) return false;
      
      // Check if the plan has remaining payouts
      if (plan.completed_payouts >= plan.duration) return false;
      
      // Check if the next payout date is in the future (not expired)
      // Allow a small buffer (1 minute) to account for processing delays
      const nextPayoutDate = new Date(plan.next_payout_date);
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      return nextPayoutDate > oneMinuteAgo;
    })
    .sort((a, b) => {
      const dateA = new Date(a.next_payout_date!);
      const dateB = new Date(b.next_payout_date!);
      return dateA.getTime() - dateB.getTime();
    })[0]; // Get the first one (earliest date)

  const recentTransactions = transactions.slice(0, 5);

  const handleViewHistory = () => {
    router.push('/transactions');
    logAnalyticsEvent('view_transaction_history', { source: 'balance_card' });
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  // Show loader if any data is loading
  if (payoutPlansLoading || transactionsLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <PlanmoniLoader 
          blurBackground={true} 
          size="medium" 
          description="Loading your financial data..."
        />
      </SafeAreaView>
    );
  }

  // Calculate the next payout date across all active plans
  const getNextPayoutDate = () => {
    const activePlans = payoutPlans.filter(plan => plan.status === 'active');
    if (activePlans.length === 0) return null;
    
    const nextPayoutDates = activePlans
      .map(plan => plan.next_payout_date)
      .filter((date): date is string => date !== null && date !== undefined)
      .map(date => new Date(date))
      .sort((a, b) => a.getTime() - b.getTime());
    
    return nextPayoutDates.length > 0 ? nextPayoutDates[0] : null;
  };

  const nextPayoutDate = getNextPayoutDate();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        onScrollBeginDrag={() => updateLastActiveOnInteraction()}
        onTouchStart={() => updateLastActiveOnInteraction()}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable onPress={handleProfilePress} style={styles.avatarButton}>
              <InitialsAvatar 
                firstName={firstName} 
                lastName={lastName} 
                size={48}
                fontSize={getScaledFontSize(18, textSizeMultiplier)}
              />
            </Pressable>
            <View style={styles.headerActions}>
              <NotificationIcon />
              <Pressable 
                onPress={handleHelpPress} 
                style={styles.helpButton}
                disabled={isLoading}
              >
                {isLoading ? (
                  <PlanmoniLoader size="small" />
                ) : (
                  <HelpCircleIcon size={24} color={colors.text} />
                )}
              </Pressable>
            </View>
          </View>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>{getGreeting()}, {firstName}.</Text>
            {/* <Text style={styles.subGreeting}>It's time to plan some payouts</Text> */}
          </View>
        </View>

        <ImageBackground 
          source={require('@/assets/images/background.png')} 
          style={styles.balanceCard}
          resizeMode="cover"
        >
          <View style={styles.balanceCardContent}>
            <View style={styles.balanceLabelContainer}>
              <View style={styles.balanceLabelGroup}>
                <Text style={styles.balanceLabel}>Your balance</Text>
                <Pressable 
                  onPress={toggleBalances}
                  style={styles.eyeIconButton}
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  {showBalances ? (
                    <EyeOff size={16} color={colors.textSecondary} />
                  ) : (
                    <Eye size={16} color={colors.textSecondary} />
                  )}
                </Pressable>
              </View>
              {/* <Pressable 
                onPress={handleViewHistory}
                style={styles.historyButton}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <History size={20} color={colors.textSecondary} />
              </Pressable> */}
            </View>
            <Text style={styles.balanceAmount}>{formatBalance(availableBalance)}</Text>
            <View style={styles.lockedSection}>
              <View style={styles.lockedLabelContainer}>
                <Clock size={16} color={colors.textSecondary} />
                <Text style={styles.lockedLabel}>{formatBalance(lockedBalance)} in active payout plans</Text>
              </View>
              {/* <Text style={styles.lockedAmount}>{formatBalance(lockedBalance)}</Text> */}
            </View>
            <View style={styles.buttonGroup}>
              <Pressable 
                style={styles.addFundsButton} 
                onPress={handleAddFunds}
              >
                
                <Plus size={20} color={isDark ? '#fff' : colors.primary}/>
                <Text style={[styles.addFundsText, { color: isDark ? '#fff' : colors.primary }]}>Add funds</Text>
              </Pressable>
              <Pressable 
                style={styles.createButton} 
                onPress={handleCreatePayout}
              >
                <CalendarCheck size={22} color={'#fff'} />
                <Text style={styles.createButtonText}>New plan</Text>
              </Pressable>
              
            </View>
          </View>
        </ImageBackground>
        
        {/* On Track Card */}
        <OnTrackCard payoutPlans={payoutPlans} />
        
        {/* AI Suggestion Section */}
        <AISuggestionCard 
          availableBalance={availableBalance}
          onSuggestionPress={handleAISuggestionPress}
        />
        {/* <IntercomButton /> */}

        {/* KYC Tiers Test Buttons */}
        {/* <View style={styles.kycTiersContainer}>
          <Text style={[styles.kycTiersTitle, { color: colors.text }]}>KYC Tiers Test</Text>
          <View style={styles.kycTiersButtons}>
            <Pressable
              style={[styles.kycTierButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/kyc-tiers/tier-one')}
            >
              <Text style={styles.kycTierButtonText}>Tier 1</Text>
            </Pressable>
            <Pressable
              style={[styles.kycTierButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/kyc-tiers/tier-two')}
            >
              <Text style={styles.kycTierButtonText}>Tier 2</Text>
            </Pressable>
            <Pressable
              style={[styles.kycTierButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/kyc-tiers/tier-three')}
            >
              <Text style={styles.kycTierButtonText}>Tier 3</Text>
            </Pressable>
          </View>
        </View> */}

        <ImageCarousel images={carouselImages} />
        {!checkTierCompletion().tier1 && <KYCCard />}
        <PendingActionsCard />
        <MostRecentPayoutsCard onTransactionPress={handleTransactionPress} />


        {/* Most Recent Payouts Section */}

        {/* Next Payout Section */}
        <NextPayoutCard nextPayout={nextPayout} />

        {/* Payout Plans Section */}
        <PayoutPlansSection 
          activePlans={activePlans} 
          onShowNewPlanInfo={() => setShowNewPlanInfoModal(true)}
        />

        <View style={styles.bottomPadding} />

        <RatingCard />

      </ScrollView>

      <Animated.View style={[
        styles.stickyButtons,
        {
          opacity: buttonOpacity,
          transform: [{
            translateY: buttonOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [100, 0],
            }),
          }],
        },
      ]}>
        <Pressable 
          style={styles.addFundsButton} 
          onPress={handleAddFunds}
        >
          <Plus size={20} color={isDark ? '#fff' : colors.primary} />
          <Text style={[styles.addFundsText, { color: isDark ? '#fff' : colors.primary }]}>Add funds</Text>
        </Pressable>
        <Pressable 
          style={styles.createButton} 
          onPress={handleCreatePayout}
        >
          <CalendarCheck size={22} color={'#fff'} />
          <Text style={styles.createButtonText}>New plan</Text>
        </Pressable>
        
      </Animated.View>

      {/* Transaction Modal - Rendered at the top level */}
      {selectedTransaction && (
        <TransactionModal
          isVisible={isTransactionModalVisible}
          onClose={() => setIsTransactionModalVisible(false)}
          transaction={selectedTransaction}
        />
      )}
      
      <AccountCreationSuccessModal
        isVisible={showWelcomeModal}
        onClose={() => {
          setShowWelcomeModal(false);
          setHasShownWelcomeModal(true);
        }}
        firstName={firstName}
        lastName={lastName}
        email={email}
        onStartVerification={handleStartVerification}
        onGoToDashboard={handleGoToDashboard}
      />

      <ClaimAccountModal
        isVisible={showClaimAccountModal}
        onClose={() => setShowClaimAccountModal(false)}
        accountNumber="01177 XXXXX"
        bankName="SAFEHAVEN MFB"
        accountName={`PLANMONI/${(firstName || 'YOUR').toUpperCase()} ${(lastName || 'NAME').toUpperCase()}`}
        onClaim={() => {
          router.push('/add-funds');
          logAnalyticsEvent('claim_account_click');
        }}
      />

      <NewPlanInfoModal
        isVisible={showNewPlanInfoModal}
        onClose={() => setShowNewPlanInfoModal(false)}
        onAddFundsAfterClose={() => {
          // Navigate after modal is fully closed
          handleAddFunds();
        }}
      />

      <AccountInformationModal
        isVisible={showAccountInfoModal}
        onClose={() => {
          setShowAccountInfoModal(false);
          setHasShownAccountInfoModal(true);
        }}
        onDone={async () => {
          setShowAccountInfoModal(false);
          setHasShownAccountInfoModal(true);
          // Refresh the app to clear any blocking state
          await handleRefresh();
        }}
      />

      <PlanCreationModal
        isVisible={showPlanCreationModal}
        onClose={async () => {
          setShowPlanCreationModal(false);
          setHasDismissedDepositModal(true);
          
          // Persist the dismissed state to AsyncStorage
          try {
            if (session?.user?.id) {
              const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
              const dismissedKey = `deposit_modal_dismissed_${session.user.id}`;
              await AsyncStorage.setItem(dismissedKey, 'true');
            }
          } catch (error) {
            console.error('Error saving dismissed modal state:', error);
          }
        }}
        depositAmount={lastDepositAmount || 0}
      />

      <AppLockModal
        isVisible={showAppLockModal}
        onClose={() => {
          setShowAppLockModal(false);
          setHasShownAppLockModal(true);
        }}
      />

      {/* <LivenessTestEnhanced 
        isVisible={showLivenessTest}
        onClose={() => setShowLivenessTest(false)}
      /> */}
      
      {/* Floating Intercom Support Button */}
      {/* <IntercomButton variant="floating" /> */}
      
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 6},
    shadowOpacity: 0.09,
    shadowRadius: 9,
    elevation: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  header: {
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 10 : 5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarButton: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  helpButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingContainer: {
    marginLeft: 0,
  },
  greeting: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 20 : 19, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    marginTop: Platform.OS === 'ios' ? 5 : 5,
    marginBottom: Platform.OS === 'ios' ? 5 : 5,
  },
  subGreeting: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 15, textSizeMultiplier),
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 18,
  },
  livenessTestButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    paddingHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  livenessTestButtonText: {
    color: '#FFFFFF',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  balanceCard: {
    borderRadius: 15,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 10,
  },
  balanceCardContent: {
    paddingVertical: Platform.OS === 'ios' ? 16 : 15,
    paddingHorizontal: Platform.OS === 'ios' ? 16 : 15,
  },
  balanceLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 8 : 0,
  },
  balanceLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceLabel: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 15, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
  },
  historyButton: {
    padding: 4,
  },
  eyeIconButton: {
    padding: 4,
  },
  balanceAmount: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 35 : 34, textSizeMultiplier),
    fontWeight: '700',
    color: colors.text,
    marginBottom: Platform.OS === 'ios' ? 5 : 0,
  },
  lockedSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    marginBottom: Platform.OS === 'ios' ? 10 : 10,
  },
  lockedLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedLabel: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 15, textSizeMultiplier),
    color: colors.textSecondary,
  },
  lockedAmount: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: Platform.OS === 'ios' ? 14 : 10,
    borderRadius: 20,
    height: Platform.OS === 'ios' ? 55 : 55,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 17 : 15, textSizeMultiplier),
    fontWeight: '600',
  },
  addFundsButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.backgroundBlack + '70',
    padding: Platform.OS === 'ios' ? 14 : 10,
    borderWidth: 2, 
    borderColor: isDark ? '#fff' : colors.primary,
    borderRadius: 20,
    height: Platform.OS === 'ios' ? 55 : 55,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addFundsText: {
    color: colors.primary,
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 17 : 15, textSizeMultiplier),
    fontWeight: '600',
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 6},
    shadowOpacity: 0.04,
    shadowRadius: 9,
    elevation: 6,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  summaryTitle: {
    fontSize: getScaledFontSize(16, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
  },
  summaryItems: {
    paddingHorizontal: 16,
    gap: 16,
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 16,
  },
  seeMoreText: {
    fontSize: getScaledFontSize(16, textSizeMultiplier),
    color: colors.textSecondary,
    fontWeight: '600',
  },
  payoutCard: {
    borderRadius: 16,
    padding: 15,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  payoutCardContent: {
    padding: 1,
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  payoutTitle: {
    fontSize: getScaledFontSize(16, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
  },
  activeTag: {
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeTagText: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: '#22C55E',
    fontWeight: '600',
  },
  payoutDetails: {
    marginBottom: 1,
  },
  payoutInfo: {
    marginBottom: 10,
  },
  payoutName: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    fontWeight: '400',
    color: colors.text,
  },
  payoutAmount: {
    fontSize: getScaledFontSize(24, textSizeMultiplier),
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  payoutAccountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  payoutAccountLabel: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    color: colors.textSecondary,
    fontWeight: '500',
  },
  bankIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bankIcon: {
    width: 12,
    height: 12,
  },
  bankIconFallback: {
    width: 12,
    height: 12,
    backgroundColor: '#EF4444',
    borderRadius: 6,
  },
  payoutAccountText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  payoutDate: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressAmount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  payoutActions: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  viewButton: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  viewButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  viewAllButton: {
    paddingVertical: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 10,
  },
  emptyPayoutsContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyPayoutsText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  emptyTransactionsContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTransactionsText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  createFirstPayoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  createFirstPayoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  payoutPlansContainer: {
    paddingRight: 1,
  },
  payoutPlanCard: {
    width: 300,
    marginRight: 16,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  planType: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  planAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  planDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  planFrequency: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  planDot: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  planValue: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  planProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  nextPayoutDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  planViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  planViewButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  addPayoutCard: {
    width: 300,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPayoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 12,
    marginBottom: 4,
  },
  addPayoutDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  transactionCard: {
    marginBottom: 10,
    borderRadius: 16,
    padding: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  transaction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 5,
  },
  transactionMethod: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  transactionDateTime: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  kycTiersContainer: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kycTiersTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  kycTiersButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  kycTierButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kycTierButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  viewAllTransactionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  viewAllTransactionsText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  stickyButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bottomPadding: {
    height: 1,
  },

});