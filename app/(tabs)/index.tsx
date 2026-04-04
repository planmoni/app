import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, Suspense } from 'react';
// import AccountCreationSuccessModal from '@/components/AccountCreationSuccessModal'; // Disabled - success modal removed after onboarding
import NewPlanInfoModal from '@/components/NewPlanInfoModal';
import AddPayoutPlanByCodeModal from '@/components/AddPayoutPlanByCodeModal';
import AccountInformationModal from '@/components/AccountInformationModal';
import PlanCreationModal from '@/components/PlanCreationModal';
import AppLockModal from '@/components/AppLockModal';
import IdentityVerificationSuccessModal from '@/components/IdentityVerificationSuccessModal';
import OnboardingQuestionnaireModal from '@/components/OnboardingQuestionnaireModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import InitialsAvatar from '@/components/InitialsAvatar';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import PendingActionsCard from '@/components/PendingActionsCard';
import KYCCard from '@/components/KYCCard';
import ImageCarousel from '@/components/ImageCarousel';
import KYCVerificationModal from '@/components/KYCVerificationModal';
import MostRecentPayoutsCard from '@/components/MostRecentPayoutsCard';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { router, useGlobalSearchParams, useLocalSearchParams } from 'expo-router';
import {
  HelpCircleIcon,
  Eye,
  EyeOff,
  Plus,
  PieChart,
  CalendarCheck,
  Calendar,
  Clock,
  MoreVertical,
  ArrowDown,
  ArrowRight,
  Send,
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
  InteractionManager,
  useWindowDimensions,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
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
import { useExpensePlans } from '@/hooks/useExpensePlans';
// import { usePaystackTransactions } from '@/hooks/usePaystackTransactions';
import { useHaptics } from '@/hooks/useHaptics';
import { useRecentAccountCreation } from '@/hooks/useRecentAccountCreation';
import { useHasCreatedPayoutPlan } from '@/hooks/useHasCreatedPayoutPlan';
import { logAnalyticsEvent } from '@/lib/firebase';
import { trackLifecycleEvent } from '@/lib/lifecycleTracking';
import { LifecycleEventName } from '@/lib/lifecycleEvents';
import { updateNextPayoutWidget } from '@/lib/widgetStorage';
import { setWelcomeModalOpener } from '@/lib/welcomeModalOpener';
// import { intercomInstant } from '@/lib/IntercomInstant';
import NotificationIcon from '@/components/NotificationIcon';
import { supabase } from '@/lib/supabase';
import NextPayoutCard from '@/components/NextPayoutCard';
import PayoutPlansSection from '@/components/PayoutPlansSection';
import ExpensePlansSection from '@/components/ExpensePlansSection';
import RatingCard from '@/components/RatingCard';
import AISuggestionCard from '@/components/AISuggestionCard';
import OnTrackCard from '@/components/OnTrackCard';
import ActiveSpendingPlansCard from '@/components/ActiveBudgetsCard';
import QuickPlans from '@/components/QuickPlans';
import DailySpendGuidance from '@/components/DailySpendGuidance';
import { getCategoryIcon, getCategoryById } from '@/lib/expenseCategories';
import { getBudgetDuration, isBudgetStarted } from '@/lib/expensePlanUtils';
import { formatTransactionType } from '@/lib/formatters';
// import { intercomService } from '@/lib/intercom';
import { useIntercom } from '@/hooks/useIntercom';
import { useRequireAuth } from '@/hooks/useRequireAuth';
// import LivenessTestEnhanced from '@/components/LivenessTestEnhanced';
import PlansTabContent from '@/components/PlansTabContent';
import CollectTabContent from '@/components/CollectTabContent';
import PayoutsTabContent from '@/components/PayoutsTabContent';
import { useCollectData } from '@/hooks/useCollectData';

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

interface BalanceActionsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onAddFunds: () => void;
  onWithdraw: () => void;
  onViewTransactionHistory: () => void;
  colors: any;
  isDark: boolean;
  textSizeMultiplier: number;
}

function BalanceActionsModal({
  isVisible,
  onClose,
  onAddFunds,
  onWithdraw,
  onViewTransactionHistory,
  colors,
  isDark,
  textSizeMultiplier,
}: BalanceActionsModalProps) {
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setModalVisible(true);
      slideAnim.setValue(Dimensions.get('window').height);
      fadeAnim.setValue(0);
      
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: Dimensions.get('window').height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false);
      });
    }
  }, [isVisible, modalVisible]);

  if (!modalVisible) return null;

  const modalStyles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 20,
      paddingHorizontal: 20,
      maxHeight: Dimensions.get('window').height * 0.4,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 20,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 4,
      gap: 16,
    },
    optionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionText: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
  });

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          style={[
            modalStyles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={modalStyles.handle} />
          
          <Pressable style={modalStyles.option} onPress={onAddFunds}>
            <View style={modalStyles.optionIcon}>
              <Plus size={20} color={colors.primary} />
            </View>
            <Text style={modalStyles.optionText}>Add funds</Text>
          </Pressable>

          <View style={modalStyles.divider} />

          <Pressable style={modalStyles.option} onPress={onWithdraw}>
            <View style={modalStyles.optionIcon}>
              <ArrowDown size={20} color={colors.primary} />
            </View>
            <Text style={modalStyles.optionText}>Withdraw</Text>
          </Pressable>

          <View style={modalStyles.divider} />

          <Pressable style={modalStyles.option} onPress={onViewTransactionHistory}>
            <View style={modalStyles.optionIcon}>
              <Clock size={20} color={colors.primary} />
            </View>
            <Text style={modalStyles.optionText}>Transaction History</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const { showBalances, toggleBalances, balance, lockedBalance, availableBalance, refreshWallet, isLoading: balanceLoading } = useBalance();
  const { session, isLoading: authLoading } = useAuth();
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { updateLastActiveOnInteraction } = useAppLock();
  const insets = useSafeAreaInsets();
  const { payoutPlans, isLoading: payoutPlansLoading, fetchPayoutPlans } = useRealtimePayoutPlans();
  const { isRecentAccount, isLoading: recentAccountLoading } = useRecentAccountCreation();
  const { checkTierCompletion, loading: kycProgressLoading, progress, loadProgress, currentTier } = useKYCProgress();
  const { hasCreatedPayoutPlan, isLoading: hasCreatedPayoutPlanLoading } = useHasCreatedPayoutPlan();
  const navigation = useNavigation();
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const { transactions, isLoading: transactionsLoading, fetchTransactions } = useRealtimeTransactions();
  const { expensePlans, fetchExpensePlans } = useExpensePlans();
  const collectData = useCollectData(session?.user?.id);
  const [activeBalanceTab, setActiveBalanceTab] = useState<'home' | 'plans' | 'collect' | 'payouts'>('home');
  const { width: screenWidth } = useWindowDimensions();
  const tabScrollViewRef = useRef<ScrollView>(null);
  // const { fetchPaystackTransactions, isLoading: paystackLoading } = usePaystackTransactions();
  const { impact, notification, selection } = useHaptics();
  
  // Tab labels + state; horizontal pager position is synced in useLayoutEffect / useEffect below
  const handleTabChange = useCallback((tab: 'home' | 'plans' | 'collect' | 'payouts') => {
    impact();
    setActiveBalanceTab(tab);
  }, [impact]);

  // Handle scroll end to update active tab (swipe between Home / Vaults / Payouts)
  const handleScrollEnd = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const tabIndex = Math.min(3, Math.max(0, Math.round(offsetX / screenWidth)));
    const newTab =
      tabIndex === 0 ? 'home' : tabIndex === 1 ? 'plans' : tabIndex === 2 ? 'collect' : 'payouts';
    setActiveBalanceTab((prev) => {
      if (newTab !== prev) {
        selection();
        return newTab;
      }
      return prev;
    });
  }, [screenWidth, selection]);

  // Keep horizontal pager offset aligned with activeBalanceTab (tap, swipe, or deep link).
  // After stack navigation, a single rAF scroll often runs before layout — labels can show Vaults while offset stays 0.
  const scrollPagerToActiveTab = useCallback(
    (animated: boolean) => {
      if (!screenWidth) return;
      const tabIndex =
        activeBalanceTab === 'home'
          ? 0
          : activeBalanceTab === 'plans'
            ? 1
            : activeBalanceTab === 'collect'
              ? 2
              : 3;
      tabScrollViewRef.current?.scrollTo({
        x: tabIndex * screenWidth,
        animated,
      });
    },
    [activeBalanceTab, screenWidth]
  );

  useLayoutEffect(() => {
    scrollPagerToActiveTab(false);
  }, [scrollPagerToActiveTab]);

  useEffect(() => {
    if (!screenWidth) return;
    const apply = () => scrollPagerToActiveTab(false);
    apply();
    const raf = requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(apply);
    });
    const interaction = InteractionManager.runAfterInteractions(apply);
    return () => {
      cancelAnimationFrame(raf);
      interaction.cancel();
    };
  }, [screenWidth, scrollPagerToActiveTab]);
  const [isTransactionModalVisible, setIsTransactionModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshTimeRef = useRef<number>(0);
  const [carouselImages, setCarouselImages] = useState<any[]>([]);
  const [imagesReady, setImagesReady] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [hasShownWelcomeModal, setHasShownWelcomeModal] = useState(false);
  const welcomeAutoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [isBalanceCardExpanded, setIsBalanceCardExpanded] = useState(false);
  const balanceCardAnimation = useRef(new Animated.Value(0)).current;
  const [showClaimAccountModal, setShowClaimAccountModal] = useState(false);
  const [hasShownTier1ClaimModal, setHasShownTier1ClaimModal] = useState(false);
  const [showNewPlanInfoModal, setShowNewPlanInfoModal] = useState(false);
  const [showAddByCodeModal, setShowAddByCodeModal] = useState(false);
  const [showAccountInfoModal, setShowAccountInfoModal] = useState(false);
  const [hasShownAccountInfoModal, setHasShownAccountInfoModal] = useState(false);
  const accountInfoModalShownRef = useRef(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [showPlanCreationModal, setShowPlanCreationModal] = useState(false);
  const [lastDepositAmount, setLastDepositAmount] = useState<number | null>(null);
  const [lastShownDepositId, setLastShownDepositId] = useState<string | null>(null);
  const [shownDepositIds, setShownDepositIds] = useState<Set<string>>(new Set());
  const [hasDismissedDepositModal, setHasDismissedDepositModal] = useState(false);
  const DEPOSIT_MODAL_DISABLED = true;
  const [showAppLockModal, setShowAppLockModal] = useState(false);
  const [hasShownAppLockModal, setHasShownAppLockModal] = useState(false);
  const [showIdentityVerificationModal, setShowIdentityVerificationModal] = useState(false);
  const [showKYCVerificationModal, setShowKYCVerificationModal] = useState(false);
  const [showOnboardingQuestionnaire, setShowOnboardingQuestionnaire] = useState(false);
  const [hasShownKYCModalThisSession, setHasShownKYCModalThisSession] = useState(false);
  const [showBalanceActionsModal, setShowBalanceActionsModal] = useState(false);
  const { hasAppLockPin } = usePin();
  const route = useRoute();
  const scrollY = (route.params as { scrollY?: Animated.Value })?.scrollY || new Animated.Value(0);

  const ensureAuthenticatedOrWelcome = useCallback(() => {
    if (!isAuthenticated) {
      setShowWelcomeModal(true);
      return false;
    }
    return true;
  }, [isAuthenticated]);

  useEffect(() => {
    setWelcomeModalOpener(() => {
      setShowWelcomeModal(true);
    });
    return () => setWelcomeModalOpener(null);
  }, []);

  // Show welcome modal once auth has resolved and the user is signed out
  useEffect(() => {
    if (authLoading) return;
    if (session?.user?.id) {
      setShowWelcomeModal(false);
      return;
    }
    welcomeAutoTimerRef.current = setTimeout(() => {
      welcomeAutoTimerRef.current = null;
      setShowWelcomeModal(true);
    }, 400);
    return () => {
      if (welcomeAutoTimerRef.current) {
        clearTimeout(welcomeAutoTimerRef.current);
        welcomeAutoTimerRef.current = null;
      }
    };
  }, [authLoading, session?.user?.id]);

  // Lazy load heavy modals
  const [TransactionModalComponent, setTransactionModalComponent] = useState<React.ComponentType<any> | null>(null);
  const [ClaimAccountModalComponent, setClaimAccountModalComponent] = useState<React.ComponentType<any> | null>(null);
  const [WelcomeModalComponent, setWelcomeModalComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    if (activeBalanceTab !== 'plans' || !session?.user?.id) return;
    void trackLifecycleEvent(LifecycleEventName.VAULT_FLOW_OPENED, { source: 'home_balance_tab' });
  }, [activeBalanceTab, session?.user?.id]);

  // Pre-load WelcomeModal immediately for faster launch (especially for unauthenticated users)
  useEffect(() => {
    if (!WelcomeModalComponent) {
      import('@/components/WelcomeModal').then(module => {
        setWelcomeModalComponent(() => module.default);
      });
    }
  }, [WelcomeModalComponent]);

  // Load TransactionModal when needed
  useEffect(() => {
    if (isTransactionModalVisible && !TransactionModalComponent) {
      import('@/components/TransactionModal').then(module => {
        setTransactionModalComponent(() => module.default);
      });
    }
  }, [isTransactionModalVisible, TransactionModalComponent]);

  // Load ClaimAccountModal when needed
  useEffect(() => {
    if (showClaimAccountModal && !ClaimAccountModalComponent) {
      import('@/components/ClaimAccountModal').then(module => {
        setClaimAccountModalComponent(() => module.default);
      });
    }
  }, [showClaimAccountModal, ClaimAccountModalComponent]);

  // Load WelcomeModal when needed (how-it-works or explicit welcome)
  useEffect(() => {
    if ((showHowItWorksModal || showWelcomeModal) && !WelcomeModalComponent) {
      import('@/components/WelcomeModal')
        .then(module => {
          setWelcomeModalComponent(() => module.default);
        })
        .catch(error => {
          console.error('Error loading WelcomeModal:', error);
        });
    }
  }, [showHowItWorksModal, showWelcomeModal, WelcomeModalComponent]);

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
  // Get user info from session - ensure they are strings
  const firstName = (() => {
    const value = session?.user?.user_metadata?.first_name;
    if (typeof value === 'string') return value;
    if (value == null) return 'User';
    return String(value);
  })();
  const lastName = (() => {
    const value = session?.user?.user_metadata?.last_name;
    if (typeof value === 'string') return value;
    if (value == null) return '';
    return String(value);
  })();
  const email = session?.user?.email || '';

  // Check if user has an account
  useEffect(() => {
    const checkAccount = async () => {
      if (!session?.user?.id) {
        setHasAccount(false);
        return;
      }
      
      try {
        const { data } = await supabase
          .from('safehaven_accounts')
          .select('id, account_number')
          .eq('user_id', session.user.id)
          .eq('is_deleted', false)
          .not('account_number', 'ilike', 'PENDING_%')
          .maybeSingle();
        
        setHasAccount(!!(data && data.account_number && !data.account_number.startsWith('PENDING_')));
      } catch (error) {
        console.error('Error checking account:', error);
        setHasAccount(false);
      }
    };
    
    checkAccount();
  }, [session?.user?.id]);

  // Disabled: Show welcome modal if account was created recently
  // The success modal has been disabled - users are navigated directly to home page after account creation
  // useEffect(() => {
  //   if (!recentAccountLoading && isRecentAccount && !showWelcomeModal && !hasShownWelcomeModal) {
  //     // Add a small delay to ensure the dashboard is fully loaded
  //     const timer = setTimeout(() => {
  //       setShowWelcomeModal(true);
  //     }, 1000);
  //     
  //     return () => clearTimeout(timer);
  //   }
  // }, [isRecentAccount, recentAccountLoading, showWelcomeModal, hasShownWelcomeModal]);

  // Don't show ClaimAccountModal after Tier 1 completion - user can navigate directly to add funds
  // Removed the useEffect that automatically shows ClaimAccountModal after Tier 1 completion

  // Check for identity verification success flag and show modal
  useEffect(() => {
    const checkIdentityVerificationSuccess = async () => {
      try {
        const shouldShow = await AsyncStorage.getItem('show_identity_verification_success');
        if (shouldShow === 'true') {
          // Small delay to ensure smooth transition after redirect
          const timer = setTimeout(() => {
            setShowIdentityVerificationModal(true);
            // Clear the flag immediately so it doesn't show again
            AsyncStorage.removeItem('show_identity_verification_success');
          }, 500);
          return () => clearTimeout(timer);
        }
      } catch (error) {
        console.error('Error checking identity verification success flag:', error);
      }
    };
    
    if (session?.user?.id) {
      checkIdentityVerificationSuccess();
    }
  }, [session?.user?.id]);

  // Show onboarding questionnaire modal once after new signup (flag set in creating-account.tsx)
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const checkOnboardingQuestionnaire = async () => {
        if (!session?.user?.id) return;
        try {
          const shouldShow = await AsyncStorage.getItem('show_onboarding_questionnaire');
          if (shouldShow === 'true') {
            timer = setTimeout(() => {
              setShowOnboardingQuestionnaire(true);
              AsyncStorage.removeItem('show_onboarding_questionnaire');
            }, 500);
          }
        } catch (error) {
          console.error('Error checking onboarding questionnaire flag:', error);
        }
      };
      checkOnboardingQuestionnaire();
      return () => { if (timer) clearTimeout(timer); };
    }, [session?.user?.id])
  );

  // Show KYC Verification Modal ONLY after onboarding completes (signup)
  // DISABLED: Modal no longer shows after onboarding completion
  // useFocusEffect(
  //   useCallback(() => {
  //     const checkAndShowKYCModal = async () => {
  //       // Early returns: don't check if already shown, no session, or still loading
  //       if (!session?.user?.id || hasShownKYCModalThisSession || kycProgressLoading) {
  //         return;
  //       }
  //       
  //       try {
  //         // ONLY show if the signup flag is set (onboarding just completed)
  //         const showAfterSignup = await AsyncStorage.getItem('show_kyc_modal_after_signup');
  //         
  //         // Only show modal if signup flag is set (onboarding completed)
  //         if (showAfterSignup === 'true') {
  //           // Small delay to ensure smooth transition
  //           const timer = setTimeout(() => {
  //             setShowKYCVerificationModal(true);
  //             setHasShownKYCModalThisSession(true);
  //             // Clear the signup flag after showing
  //             AsyncStorage.removeItem('show_kyc_modal_after_signup');
  //           }, 1000);
  //           return () => clearTimeout(timer);
  //         }
  //       } catch (error) {
  //         console.error('Error checking KYC modal flag:', error);
  //       }
  //     };
  //     
  //     // Wait for progress to load before checking
  //     if (session?.user?.id && !kycProgressLoading) {
  //       checkAndShowKYCModal();
  //     }
  //   }, [session?.user?.id, kycProgressLoading, hasShownKYCModalThisSession])
  // );

  // Show AccountInformationModal only when coming from Tier1CompletionModal
  const params = useLocalSearchParams();
  const globalSearchParams = useGlobalSearchParams();
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

  // Deep-link / post-create: select Vaults / Payouts without pager haptic (useLayoutEffect syncs scroll)
  useEffect(() => {
    const raw = params.balanceTab ?? globalSearchParams.balanceTab;
    const tab = Array.isArray(raw) ? raw[0] : raw;
    if (tab !== 'plans' && tab !== 'payouts' && tab !== 'home' && tab !== 'collect') return;
    setActiveBalanceTab(tab as 'home' | 'plans' | 'collect' | 'payouts');
    requestAnimationFrame(() => {
      router.setParams({ balanceTab: undefined });
    });
  }, [params.balanceTab, globalSearchParams.balanceTab]);

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
    if (DEPOSIT_MODAL_DISABLED) return;
    if (!session?.user?.id || transactions.length === 0 || hasDismissedDepositModal) return;

    const depositTransactions = transactions.filter(
      t => t.type === 'deposit' && t.status === 'completed'
    );

    if (depositTransactions.length > 0) {
      const latestDeposit = depositTransactions[0];
      const depositAmount = latestDeposit.amount;
      const depositId = latestDeposit.id;

      // Check if this deposit has already been shown
      // Only show modal for deposits >= ₦5,000
      // IMPORTANT: Double-check dismissed state before showing modal
      if (!shownDepositIds.has(depositId) && depositAmount >= 5000) {
        // Small delay to ensure transaction is processed
        const timer = setTimeout(async () => {
          // Final check: verify modal hasn't been dismissed before showing
          try {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            const dismissedKey = `deposit_modal_dismissed_${session.user.id}`;
            const dismissed = await AsyncStorage.getItem(dismissedKey);
            
            // If modal was dismissed, don't show it
            if (dismissed === 'true') {
              setHasDismissedDepositModal(true);
              return;
            }
            
            // Only show if not dismissed
          setShowPlanCreationModal(true);
          setLastDepositAmount(depositAmount);
          setLastShownDepositId(depositId);
          
          // Mark this deposit as shown and persist it
          const newShownIds = new Set(shownDepositIds);
          newShownIds.add(depositId);
          setShownDepositIds(newShownIds);
          
          // Persist to AsyncStorage
            const key = `shown_deposit_ids_${session.user.id}`;
            await AsyncStorage.setItem(key, JSON.stringify(Array.from(newShownIds)));
          } catch (error) {
            console.error('Error checking/saving deposit modal state:', error);
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

  // Fetch carousel images from Supabase (non-blocking, lazy load images)
  const fetchCarouselImages = useCallback(async () => {
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
        // Set images immediately without blocking preload
        // Images will load lazily when displayed in the carousel component
        setCarouselImages(data);
        setImagesReady(true);

        // Preload images in background (non-blocking, deferred)
        // Use InteractionManager to defer until after interactions complete
        InteractionManager.runAfterInteractions(() => {
          data.forEach((banner: Banner) => {
            // Preload images asynchronously without blocking the UI
            // Use Image.getSize in a non-blocking way
                Image.getSize(
                  banner.image_url,
              () => {
                // Image loaded successfully - no action needed
              },
              () => {
                // Image failed to load - will load when displayed
              }
                );
              });
        });
      }
    } catch (error) {
      // Silently fail - carousel is non-critical
    }
  }, []);

  // Fetch images on component mount
  useEffect(() => {
    fetchCarouselImages();
  }, [fetchCarouselImages]);

  // Memoize computed values
  const activePlans = useMemo(() => {
    return payoutPlans.filter(plan => plan.status === 'active');
  }, [payoutPlans]);

  const payoutsTotalAmount = useMemo(() => {
    if (!activePlans || activePlans.length === 0) return 0;
    return activePlans.reduce((sum, plan) => {
      const totalAmount = Number((plan as any)?.total_amount) || 0;
      return sum + totalAmount;
    }, 0);
  }, [activePlans]);

  const payoutsTotalPaid = useMemo(() => {
    if (!activePlans || activePlans.length === 0) return 0;
    return activePlans.reduce((sum, plan) => {
      const completedPayouts = Number((plan as any)?.completed_payouts) || 0;
      const payoutAmount = Number((plan as any)?.payout_amount) || 0;
      const completedAmount = completedPayouts * payoutAmount;
      return sum + completedAmount;
    }, 0);
  }, [activePlans]);

  const handleProfilePress = useCallback(() => {
    router.push('/profile');
    logAnalyticsEvent('profile_click');
  }, []);

  // Handle pull-to-refresh - refresh all page data
  const handleRefresh = useCallback(async () => {
    // Debounce: prevent multiple rapid refreshes (minimum 1 second between refreshes)
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < 1000) {
      return;
    }
    lastRefreshTimeRef.current = now;

    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    setIsRefreshing(true);

    // Set a timeout to ensure refresh state doesn't get stuck (max 10 seconds)
    refreshTimeoutRef.current = setTimeout(() => {
      setIsRefreshing(false);
      refreshTimeoutRef.current = null;
    }, 10000);

    try {
      // Refresh critical data in parallel (excluding carousel images which are non-critical)
      // Use Promise.allSettled to prevent one failure from blocking others
      const results = await Promise.allSettled([
        // Refresh wallet balance
        refreshWallet(),
        // Refresh vault plans
        fetchExpensePlans(),
        // Refresh payout plans
        fetchPayoutPlans(),
        // Refresh transactions
        fetchTransactions(),
        // Refresh KYC progress
        loadProgress(),
        collectData.refresh(),
      ]);

      // Log any failures but don't block the refresh
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const operationNames = ['wallet', 'vault plans', 'payout plans', 'transactions', 'KYC progress', 'collect'];
          console.warn(`Refresh failed for ${operationNames[index]}:`, result.reason);
        }
      });
      
      // Add haptic feedback for successful refresh
      impact();
    } catch (error) {
      console.error('Error refreshing page data:', error);
    } finally {
      // Clear timeout and reset refresh state
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      setIsRefreshing(false);
    }
  }, [refreshWallet, fetchExpensePlans, fetchPayoutPlans, fetchTransactions, loadProgress, collectData, impact]);

  const handleHelpPress = useCallback(async () => {
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
  }, [openChat]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const getGreeting = () => {
    return 'Hi';
  };

  // Sum of all plan balances (funded progress reference)
  const expensePlansFundedBalance = useMemo(() => {
    if (!expensePlans || expensePlans.length === 0) return 0;
    return expensePlans.reduce((total, plan) => {
      const currentBalance = (plan as any).current_balance || 0;
      return total + currentBalance;
    }, 0);
  }, [expensePlans]);

  // Spendable balance = started plans only
  const expensePlansSpendableBalance = useMemo(() => {
    if (!expensePlans || expensePlans.length === 0) return 0;
    return expensePlans.reduce((total, plan) => {
      const started = plan.start_date ? isBudgetStarted(plan.start_date) : false;
      if (!started) return total;
      const currentBalance = (plan as any).current_balance || 0;
      return total + currentBalance;
    }, 0);
  }, [expensePlans]);

  // Active (started) budgets with spendable balance
  const activeSpendableBudgets = useMemo(() => {
    if (!expensePlans || expensePlans.length === 0) return { count: 0, total: 0, minDays: null as number | null };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let count = 0;
    let total = 0;
    let minDays: number | null = null;

    expensePlans.forEach(plan => {
      if (plan.status !== 'active') return;
      if (!isBudgetStarted(plan.start_date)) return;
      const balance = (plan as any)?.current_balance || 0;
      if (balance <= 0) return;

      count += 1;
      total += balance;

      if (plan.end_date) {
        const endDate = new Date(plan.end_date);
        endDate.setHours(0, 0, 0, 0);
        const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilEnd >= 0) {
          if (minDays === null || daysUntilEnd < minDays) {
            minDays = daysUntilEnd;
          }
        }
      }
    });

    return { count, total, minDays };
  }, [expensePlans]);

  // Find ongoing budgets (started budgets with funds)
  const ongoingBudgets = useMemo(() => {
    if (!expensePlans || expensePlans.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return expensePlans
      .filter(p => {
        const hasFunds = (p.current_balance || 0) > 0;
        return p.status === 'active' && isBudgetStarted(p.start_date) && hasFunds;
      })
      .map(plan => {
        let daysUntilEnd: number | null = null;
        if (plan.end_date) {
          const endDate = new Date(plan.end_date);
          endDate.setHours(0, 0, 0, 0);
          daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }
        return { plan, daysUntilEnd };
      })
      .sort((a, b) => {
        // Sort by days until end (ascending), nulls last
        if (a.daysUntilEnd === null && b.daysUntilEnd === null) return 0;
        if (a.daysUntilEnd === null) return 1;
        if (b.daysUntilEnd === null) return -1;
        return a.daysUntilEnd - b.daysUntilEnd;
      });
  }, [expensePlans]);

  // Find next maturing budget
  const nextMaturingBudget = useMemo(() => {
    if (!expensePlans || expensePlans.length === 0) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingPlans = expensePlans
      .filter(p => p.status === 'active' && p.end_date)
      .map(plan => {
        const endDate = new Date(plan.end_date!);
        endDate.setHours(0, 0, 0, 0);
        const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let daysUntilStart: number | null = null;
        if (plan.start_date) {
          const startDate = new Date(plan.start_date);
          startDate.setHours(0, 0, 0, 0);
          daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }
        
        const duration = getBudgetDuration(plan.start_date, plan.end_date);
        const hasStarted = isBudgetStarted(plan.start_date);
        return { plan, daysUntilEnd, daysUntilStart, endDate, duration, hasStarted };
      })
      // Up next should be budgets that haven't started
      .filter(({ hasStarted, daysUntilStart, daysUntilEnd }) => !hasStarted && (daysUntilStart ?? 0) >= 0 && daysUntilEnd >= 0)
      .sort((a, b) => {
        const aStart = a.daysUntilStart ?? Number.MAX_SAFE_INTEGER;
        const bStart = b.daysUntilStart ?? Number.MAX_SAFE_INTEGER;
        if (aStart === bStart) return a.daysUntilEnd - b.daysUntilEnd;
        return aStart - bStart;
      });

    return upcomingPlans.length > 0 ? upcomingPlans[0] : null;
  }, [expensePlans]);

  // Get category icons and selected subcategories for next maturing budget
  const getNextMaturingBudgetCategoryIcons = useMemo(() => {
    if (!nextMaturingBudget?.plan?.buckets || nextMaturingBudget.plan.buckets.length === 0) {
      return [];
    }

    const uniqueCategories = new Set<string>();
    const icons: Array<{ categoryId: string; Icon: any }> = [];

    for (const bucket of nextMaturingBudget.plan.buckets) {
      if (uniqueCategories.size >= 3) break;
      
      if (!uniqueCategories.has(bucket.category_id)) {
        const Icon = getCategoryIcon(bucket.category_id);
        if (Icon) {
          uniqueCategories.add(bucket.category_id);
          icons.push({ categoryId: bucket.category_id, Icon });
        }
      }
    }

    return icons;
  }, [nextMaturingBudget]);

  // Get selected subcategories for next maturing budget
  const getNextMaturingBudgetSubcategories = useMemo(() => {
    if (!nextMaturingBudget?.plan?.buckets || nextMaturingBudget.plan.buckets.length === 0) {
      return [];
    }

    const subcategories: Array<{ categoryId: string; subcategoryId: string; subcategoryName: string }> = [];

    for (const bucket of nextMaturingBudget.plan.buckets) {
      const category = getCategoryById(bucket.category_id);
      if (category) {
        const subcategory = category.subCategories.find(sub => sub.id === bucket.subcategory_id);
        if (subcategory) {
          subcategories.push({
            categoryId: bucket.category_id,
            subcategoryId: bucket.subcategory_id,
            subcategoryName: subcategory.name
          });
        }
      }
    }

    return subcategories;
  }, [nextMaturingBudget]);

  const buttonOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const formatBalance = (amount: number) => {
    return showBalances ? `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '******';
  };

  const getBalanceParts = (amount: number) => {
    if (!showBalances) return { main: '******', decimal: '' };
    const formatted = amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dotIndex = formatted.lastIndexOf('.');
    if (dotIndex === -1) return { main: `₦${formatted}`, decimal: '' };
    return { main: `₦${formatted.slice(0, dotIndex)}`, decimal: formatted.slice(dotIndex) };
  };

  // Toggle balance card expansion
  const toggleBalanceCardExpansion = () => {
    const toValue = isBalanceCardExpanded ? 0 : 1;
    setIsBalanceCardExpanded(!isBalanceCardExpanded);
    Animated.timing(balanceCardAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
    notification(); // Haptic feedback
  };

  // Calculate animated height for locked section
  const lockedSectionHeight = balanceCardAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 50],
  });

  const lockedSectionOpacity = balanceCardAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Ref to prevent duplicate navigation
  const isNavigatingToAddFundsRef = useRef(false);

  const handleAddFunds = async () => {
    // Prevent duplicate navigation
    if (isNavigatingToAddFundsRef.current) {
      return;
    }

    if (!ensureAuthenticatedOrWelcome()) {
      setShowBalanceActionsModal(false);
      return;
    }

    // Trigger medium impact haptic feedback
    impact();
    
    // Close the balance actions modal first
    setShowBalanceActionsModal(false);
    
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
    
    // Allow access to the Add funds page even if Tier 1 isn't complete.
    // Mono/Paystack flows don't require Tier 1, while bank-transfer may.
    if (!tierCompletion.tier1) {
      isNavigatingToAddFundsRef.current = true;
      router.push('/add-funds');
      logAnalyticsEvent('add_funds_click_non_kyc');
      // Reset flag after navigation completes
      setTimeout(() => {
        isNavigatingToAddFundsRef.current = false;
      }, 1000);
      return;
    }

    // Tier 1 is complete at this point. If user already has an account, go directly.
    if (hasAccount) {
      isNavigatingToAddFundsRef.current = true;
      router.push('/add-funds');
      logAnalyticsEvent('add_funds_click');
      // Reset flag after navigation completes
      setTimeout(() => {
        isNavigatingToAddFundsRef.current = false;
      }, 1000);
      return;
    }

    // Otherwise show ClaimAccountModal to help create/claim the safehaven account.
    setShowClaimAccountModal(true);
    logAnalyticsEvent('add_funds_click_claim_modal');
  };

  const handleWithdraw = () => {
    impact();
    setShowBalanceActionsModal(false);
    // TODO: Navigate to withdraw screen or show withdraw modal
    Alert.alert('Withdraw', 'Withdraw functionality coming soon');
    logAnalyticsEvent('withdraw_click');
  };

  const handleViewTransactionHistory = () => {
    impact();
    setShowBalanceActionsModal(false);
    router.push('/transactions');
    logAnalyticsEvent('view_transaction_history', { source: 'balance_card' });
  };

  const handleCreatePayout = () => {
    // Trigger medium impact haptic feedback
    impact();
    
    if (!ensureAuthenticatedOrWelcome()) {
      return;
    }

    // Route to unified create chooser
    router.push('/create-new');
    logAnalyticsEvent('create_payout_click_start');
  };

  const handleAISuggestionPress = (suggestion: any) => {
    // Check authentication first
    if (!requireAuth(() => {}, '/create-payout/frequency-selection')) {
      return;
    }
    
    // Trigger haptic feedback
    impact();
    
    // Map frequency to match frequency-selection screen expectations
    // 'weekly' should be mapped to 'weekly_specific'
    const mappedFrequency = suggestion.frequency === 'weekly' ? 'weekly_specific' : suggestion.frequency;
    
    // Navigate to frequency-selection page with full balance and suggested frequency
    router.push({
      pathname: '/create-payout/frequency-selection',
      params: {
        totalAmount: availableBalance.toString(),
        frequency: mappedFrequency,
        duration: suggestion.duration.toString()
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
    // Route new users to Tier 1 flow
    router.push('/kyc/tier1');
  };

  const handleGoToDashboard = () => {
    setShowWelcomeModal(false);
    setHasShownWelcomeModal(true);
    // Modal is already on dashboard, just close it
  };

  // Handle transaction press from MostRecentPayoutsCard
  const handleTransactionPress = useCallback((transaction: any) => {
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
    // Map "scheduled" status to "DISBURSED" for payout transactions
    let displayStatus = transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1);
    if (transaction.type === 'payout' && transaction.status.toLowerCase() === 'scheduled') {
      displayStatus = 'DISBURSED';
    }
    
    const formattedTransaction = {
      ...transaction,
      amount: `₦${transaction.amount.toLocaleString()}`,
      status: displayStatus,
      date: new Date(transaction.created_at).toLocaleDateString(),
      time: new Date(transaction.created_at).toLocaleTimeString(),
      type: formatTransactionType(transaction.type),
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
  }, [payoutPlans]);

  // Get active payout plans for display
  const activePlansForDisplay = useMemo(() => activePlans.slice(0, 3), [activePlans]);
  
  // Find the next payout - the one with the earliest next_payout_date that hasn't expired
  const nextPayout = useMemo(() => payoutPlans
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
    })[0], [payoutPlans]); // Get the first one (earliest date)

  // Sync "Up Next" to iOS home screen widget (App Group storage)
  useEffect(() => {
    if (!session?.user?.id) return;
    if (nextPayout?.id && nextPayout?.next_payout_date) {
      updateNextPayoutWidget({
        planId: nextPayout.id,
        planName: nextPayout.name,
        nextPayoutDate: nextPayout.next_payout_date,
        payoutAmount: nextPayout.payout_amount,
        planStatus: nextPayout.status,
      });
    } else {
      updateNextPayoutWidget(null);
    }
  }, [session?.user?.id, nextPayout?.id, nextPayout?.name, nextPayout?.next_payout_date, nextPayout?.payout_amount, nextPayout?.status]);

  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

  const handleViewHistory = useCallback(() => {
    router.push('/transactions');
    logAnalyticsEvent('view_transaction_history', { source: 'balance_card' });
  }, []);

  // Calculate the next payout date across all active plans
  const nextPayoutDate = useMemo(() => {
    if (activePlans.length === 0) return null;
    
    const nextPayoutDates = activePlans
      .map(plan => plan.next_payout_date)
      .filter((date): date is string => date !== null && date !== undefined)
      .map(date => new Date(date))
      .sort((a, b) => a.getTime() - b.getTime());
    
    return nextPayoutDates.length > 0 ? nextPayoutDates[0] : null;
  }, [activePlans]);

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  // Intercom not supported on web - check after all hooks
  if (!isSupported) {
    return null; // Don't render on web
  }

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Sticky Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {isAuthenticated ? (
            <Pressable onPress={handleProfilePress} style={styles.avatarButton}>
              <InitialsAvatar 
                firstName={firstName} 
                lastName={lastName} 
                size={48}
                fontSize={typeof textSizeMultiplier === 'number' && !isNaN(textSizeMultiplier) 
                  ? getScaledFontSize(18, textSizeMultiplier) 
                  : 18}
                kycTier={typeof currentTier === 'number' && !isNaN(currentTier) ? currentTier : 0}
                hasAccount={hasAccount}
                tier1Complete={checkTierCompletion().tier1}
              />
            </Pressable>
          ) : (
            <Pressable style={styles.avatarButton}>
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Image 
                  source={require('@/assets/images/Icon-planmoni.png')}
                  style={styles.planmoniIcon}
                  resizeMode="contain"
                />
              </View>
            </Pressable>
          )}
          <View style={styles.greetingInlineContainer}>
            {isAuthenticated ? (
            <View style={styles.greetingInlineRow}>
              <Text style={styles.greetingInline} numberOfLines={1} ellipsizeMode="tail">
                  {getGreeting()}, {firstName}.
              </Text>
              <Text style={styles.subGreetingInline} numberOfLines={1} ellipsizeMode="tail">
                It's time to plan your finances
              </Text>
            </View>
            ) : (
              <Pressable 
                onPress={() => router.push('/(auth)/login')} 
                style={[styles.loginButton, { borderColor: isDark ? '#fff' : colors.primary }]}
              >
                <Text style={[styles.loginButtonText, {color: isDark ? '#fff' : colors.primary }]}>Login</Text>
              </Pressable>
            )}
          </View>
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
      </View>

      {/* Sticky Balance Tabs */}
      <View style={styles.tabsContainer}>
        <Pressable
          onPress={() => handleTabChange('home')}
        >
          <Text style={[
            styles.tabText,
            activeBalanceTab === 'home' && styles.activeTabText
          ]}>
            Home
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleTabChange('plans')}
        >
          <Text style={[
            styles.tabText,
            activeBalanceTab === 'plans' && styles.activeTabText
          ]}>
            Vaults
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleTabChange('collect')}
        >
          <Text style={[
            styles.tabText,
            activeBalanceTab === 'collect' && styles.activeTabText
          ]}>
            Collect
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleTabChange('payouts')}
        >
          <Text style={[
            styles.tabText,
            activeBalanceTab === 'payouts' && styles.activeTabText
          ]}>
            Payouts
          </Text>
        </Pressable>
      </View>

      {/* Swipeable Tab Content */}
      <View style={styles.tabContentWrapper}>
        <ScrollView
          ref={tabScrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          onLayout={() => scrollPagerToActiveTab(false)}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={screenWidth}
          snapToAlignment="start"
          scrollEnabled
          style={[styles.tabContentScrollView, { width: screenWidth }]}
          contentContainerStyle={{ width: screenWidth * 4 }}
        >
          {/* Home Tab Content */}
          <View style={[styles.tabPage, { width: screenWidth }]}>
            <ScrollView
              style={styles.tabScrollView}
              contentContainerStyle={styles.tabScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
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
            {/* Home Tab - Full Balance Card with Buttons */}
            <ImageBackground 
              source={require('@/assets/images/background.png')} 
              style={styles.balanceCard}
              resizeMode="cover"
            >
              <View style={styles.balanceCardContent}>
                <View style={styles.balanceLabelContainer}>
                  <View style={styles.balanceLabelGroup}>
                    <Text style={styles.balanceLabel}>Available balance</Text>
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
                    onPress={() => {
                      impact();
                      setShowBalanceActionsModal(true);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.eyeIconButton}
                  >
                    <MoreVertical size={20} color={'#fff'} />
                  </Pressable> */}
                </View>
                <Text style={styles.balanceAmount}>{formatBalance(availableBalance)}</Text>
                <View style={styles.lockedSection}>
                  {/* <View style={styles.lockedLabelContainer}>
                    <Clock size={16} color={colors.textTertiary} />
                    <Text style={styles.lockedLabel}>
                      {formatBalance(lockedBalance)} in active payout plans
                    </Text>
                  </View> */}
                </View>
                <View style={styles.buttonGroup}>
                  <Pressable 
                    style={styles.addFundsButtonBalance} 
                  onPress={() => {
                    handleAddFunds();
                  }}
                  >
                    <ArrowDown size={20} color={'#fff'}/>
                    <Text style={[styles.addFundsTextBalance]}>Add funds</Text>
                  </Pressable>
                  <Pressable 
                    style={styles.createButtonBalance} 
                    onPress={handleCreatePayout}
                  >
                    <CalendarCheck size={22} color={colors.primary} />
                    <Text style={styles.createButtonTextBalance}>New</Text>
                  </Pressable>
                </View>
              </View>
            </ImageBackground>
            
            
            {/* Home Tab Content */}
            <>
              {/* On Track Card */}
              {/* AI Suggestion Section - Only show for authenticated users */}
              {/* {isAuthenticated && (
                <AISuggestionCard 
                  availableBalance={availableBalance}
                  onSuggestionPress={handleAISuggestionPress}
                />
              )} */}
              <OnTrackCard 
                payoutPlans={payoutPlans}
              />
              <MostRecentPayoutsCard onTransactionPress={handleTransactionPress} />
              

              <ImageCarousel images={carouselImages} />

              <QuickPlans onRequireAuth={ensureAuthenticatedOrWelcome} />


              
              {activeSpendableBudgets.count > 0 && (
                <ActiveSpendingPlansCard 
                  count={activeSpendableBudgets.count}
                  totalAmount={activeSpendableBudgets.total}
                  daysRemaining={activeSpendableBudgets.minDays}
                  onPress={() => handleTabChange('plans')}
                />
              )}
              {/* {isAuthenticated && progress && !(
                progress.id_face_verified === true || 
                String(progress.id_face_verified) === '1' ||
                String(progress.id_face_verified) === 'true'
              ) && <KYCCard />} */}

              

              {/* Quick Plans Section */}
              <PendingActionsCard />


              

                <View style={styles.bottomPadding} />

                {/* <RatingCard /> */}
              </>
            </ScrollView>
          </View>

          {/* Plans Tab Content */}
          <PlansTabContent
            screenWidth={screenWidth}
            styles={styles}
            colors={colors}
            impact={impact}
            router={router}
            formatBalance={formatBalance}
            expensePlansBalance={expensePlansSpendableBalance}
            expensePlansFundedBalance={expensePlansFundedBalance}
            expensePlans={expensePlans}
            ongoingBudgets={ongoingBudgets}
            nextMaturingBudget={nextMaturingBudget}
            getNextMaturingBudgetCategoryIcons={getNextMaturingBudgetCategoryIcons}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
            onRequireAuth={ensureAuthenticatedOrWelcome}
          />

          <CollectTabContent
            screenWidth={screenWidth}
            styles={styles}
            colors={colors}
            router={router}
            formatBalance={formatBalance}
            collect={collectData}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
            onRequireAuth={ensureAuthenticatedOrWelcome}
          />

          {/* Payouts Tab Content */}
          <PayoutsTabContent
            screenWidth={screenWidth}
            styles={styles}
            colors={colors}
            formatBalance={formatBalance}
            lockedBalance={lockedBalance}
            nextPayout={nextPayout}
            activePlans={activePlans}
            payoutsTotalPaid={payoutsTotalPaid}
            payoutsTotalAmount={payoutsTotalAmount}
            onRequireAuth={ensureAuthenticatedOrWelcome}
            setShowAddByCodeModal={setShowAddByCodeModal}
            setShowNewPlanInfoModal={setShowNewPlanInfoModal}
            setShowHowItWorksModal={setShowHowItWorksModal}
            isUserAuthenticated={isAuthenticated}
            onShowWelcomeModal={() => setShowWelcomeModal(true)}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        </ScrollView>
      </View>

      {/* Sticky Buttons - Only show on Home tab */}
      {activeBalanceTab === 'home' && (
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
            onPress={() => {
              handleAddFunds();
            }}
          >
            <ArrowDown size={20} color={isDark ? '#fff' : colors.primary} />
            <Text style={[styles.addFundsText, { color: isDark ? '#fff' : colors.primary }]}>Add funds</Text>
          </Pressable>
          <Pressable 
            style={styles.createButton} 
            onPress={handleCreatePayout}
          >
            <CalendarCheck size={22} color={'#fff'} />
            <Text style={styles.createButtonText}>New</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Floating + Button for Plans Tab */}
      {activeBalanceTab === 'plans' && (
        <Pressable
          style={styles.floatingAddButton}
          onPress={() => {
            if (!ensureAuthenticatedOrWelcome()) return;
            impact();
            router.push({
              pathname: '/expense-planner/create/plan-details',
              params: {
                planTypes: JSON.stringify(['one_time']),
              },
            });
          }}
        >
          <Plus size={24} color="#fff" />
        </Pressable>
      )}

      {/* Floating + Button for Payouts Tab */}
      {activeBalanceTab === 'payouts' && (
        <Pressable
          style={styles.floatingAddButton}
          onPress={() => {
            if (!ensureAuthenticatedOrWelcome()) return;
            impact();
            setShowAddByCodeModal(true);
            logAnalyticsEvent('create_payout_click_modal');
          }}
        >
          <Plus size={24} color="#fff" />
        </Pressable>
      )}

      {/* Transaction Modal - Lazy loaded */}
      {selectedTransaction && isTransactionModalVisible && TransactionModalComponent && (
        <TransactionModalComponent
          isVisible={isTransactionModalVisible}
          onClose={() => setIsTransactionModalVisible(false)}
          transaction={selectedTransaction}
        />
      )}

      {/* Balance Actions Modal */}
      <BalanceActionsModal
        isVisible={showBalanceActionsModal}
        onClose={() => setShowBalanceActionsModal(false)}
        onAddFunds={handleAddFunds}
        onWithdraw={handleWithdraw}
        onViewTransactionHistory={handleViewTransactionHistory}
        colors={colors}
        isDark={isDark}
        textSizeMultiplier={textSizeMultiplier}
      />
      
      {/* NewPlanInfoModal - available for both authenticated and unauthenticated users */}
      <NewPlanInfoModal
        isVisible={showNewPlanInfoModal}
        onClose={() => setShowNewPlanInfoModal(false)}
        onAddFundsAfterClose={() => {
          // Navigate after modal is fully closed
          handleAddFunds();
        }}
      />
      
      {/* AddPayoutPlanByCodeModal */}
      <AddPayoutPlanByCodeModal
        isVisible={showAddByCodeModal}
        onClose={() => setShowAddByCodeModal(false)}
        onCreateNewPlan={() => {
          setShowAddByCodeModal(false);
          // Only show the "first payout schedule" modal when the user truly has no payout history.
          // If the user already has payout transactions, go straight to the create payout flow.
          if (hasCreatedPayoutPlanLoading) {
            router.push('/create-payout/amount');
            return;
          }

          if (hasCreatedPayoutPlan) {
            router.push('/create-payout/amount');
          } else {
            setShowNewPlanInfoModal(true);
          }
        }}
      />
      
      {/* ClaimAccountModal - Lazy loaded */}
      {showClaimAccountModal && ClaimAccountModalComponent && (
        <ClaimAccountModalComponent
          isVisible={showClaimAccountModal}
          onClose={() => {
            setShowClaimAccountModal(false);
            // Reset navigation flag when modal closes
            isNavigatingToAddFundsRef.current = false;
          }}
          accountNumber="01177 XXXXX"
          bankName="SAFEHAVEN MFB"
          accountName={`PLANMONI/${(firstName || 'YOUR').toUpperCase()} ${(lastName || 'NAME').toUpperCase()}`}
          onClaim={() => {
            // Prevent duplicate navigation
            if (isNavigatingToAddFundsRef.current) {
              return;
            }
            isNavigatingToAddFundsRef.current = true;
            setShowClaimAccountModal(false);
            router.push('/add-funds');
            logAnalyticsEvent('claim_account_click');
            // Reset flag after navigation completes
            setTimeout(() => {
              isNavigatingToAddFundsRef.current = false;
            }, 1000);
          }}
        />
      )}
      
      {isAuthenticated && (
        <>
          {/* AccountCreationSuccessModal disabled - users are navigated directly to home page after account creation */}
          {/* <AccountCreationSuccessModal
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
          /> */}

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

          <IdentityVerificationSuccessModal
            isVisible={showIdentityVerificationModal}
            onClose={() => {
              setShowIdentityVerificationModal(false);
            }}
          />
          
          <KYCVerificationModal
            isVisible={showKYCVerificationModal}
            onClose={() => {
              setShowKYCVerificationModal(false);
            }}
            onStartVerification={() => {
              setShowKYCVerificationModal(false);
              // Navigate to Tier 1 KYC flow
              router.push('/kyc/tier1');
            }}
          />

          <OnboardingQuestionnaireModal
            visible={showOnboardingQuestionnaire}
            onClose={() => setShowOnboardingQuestionnaire(false)}
            onAddFunds={() => {
              router.push('/add-funds');
            }}
            onDoLater={() => {}}
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
        </>
      )}

      {/* <LivenessTestEnhanced 
        isVisible={showLivenessTest}
        onClose={() => setShowLivenessTest(false)}
      /> */}

      {/* Welcome Modal - unauthenticated gating */}
      {showWelcomeModal && WelcomeModalComponent && (
        <WelcomeModalComponent
          isVisible={showWelcomeModal}
          onClose={() => {
            if (welcomeAutoTimerRef.current) {
              clearTimeout(welcomeAutoTimerRef.current);
              welcomeAutoTimerRef.current = null;
            }
            setShowWelcomeModal(false);
            setHasShownWelcomeModal(true);
          }}
          showButtons
        />
      )}

      {/* How it Works Modal - Lazy loaded */}
      {showHowItWorksModal && WelcomeModalComponent && (
        <WelcomeModalComponent
          isVisible={showHowItWorksModal}
          onClose={() => setShowHowItWorksModal(false)}
          showButtons={false}
        />
      )}

      {/* Welcome Modal for Unauthenticated Users */}
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
    paddingLeft: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 10,
  },
  tabScrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  tabScrollContent: {
    paddingBottom: 80,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
  gradientContainer: {
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  gradientContent: {
    paddingBottom: 16,
  },
  header: {
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 5,
    paddingTop: 0,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 10 : 5,
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  avatarButton: {
    borderRadius: 24,
    overflow: 'visible', // Changed to visible to allow badge to show
    flexShrink: 0,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planmoniIcon: {
    width: 28,
    height: 28,
  },
  loginButton: {
    paddingHorizontal: 20,
    width: '60%',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  loginButtonText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
  },
  helpButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingInlineContainer: {
    flex: 1,
    flexShrink: 1,
    marginHorizontal: 1,
    minWidth: 0,
  },
  greetingInlineRow: {
    flexDirection: 'column',
    gap: 2,
  },
  greetingInline: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 16, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  subGreetingInline: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 11, textSizeMultiplier),
    fontWeight: '400',
    color: colors.textSecondary,
    flexShrink: 1,
  },
  greetingContainer: {
    marginTop: 12,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  greeting: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 18 : 17, textSizeMultiplier),
    fontWeight: '500',
    color: isDark ? '#fff' : '#000',
    flex: 1,
  },
  subGreeting: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 13, textSizeMultiplier),
    fontWeight: '400',
    color: colors.backgroundSecondary,
    lineHeight: 18,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.backgroundSecondary,
    zIndex: 10,
  },
  tabText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 17 : 16, textSizeMultiplier),
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: isDark ? colors.text : colors.primary,
    fontWeight: '600',
  },
  textBalanceContainer: {
    marginBottom: 20,
    paddingVertical: 16,
  },
  textBalanceLabel: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 15, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  textBalanceAmount: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 36 : 28, textSizeMultiplier),
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  textBalanceLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  textBalanceLockedText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 13, textSizeMultiplier),
    color: colors.textSecondary,
  },
  availableToSpendCard: {
    backgroundColor: '#1E3A8A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,

  },
  availableToSpendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  availableToSpendInfo: {
    flex: 1,
    gap: 8,
  },
  availableToSpendLabel: {
    fontSize: getScaledFontSize(13, textSizeMultiplier),
    fontWeight: '500',
    color: colors.textTertiary,
    marginBottom: 4,
  },
  availableToSpendAmount: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 32 : 28, textSizeMultiplier),
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  availableToSpendSubtext: {
    flexDirection: 'row',
    color: colors.accentBackground,
    alignItems: 'center',
    gap: 6,
  },
  availableToSpendSubtextText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 13, textSizeMultiplier),
    color: colors.textSecondary,
  },
  availableToSpendProgress: {
    marginTop: 1,
    gap: 6,
  },
  availableToSpendProgressTrack: {
    height: 8,
    borderRadius: 8,
    backgroundColor: '#ffffff33',
    overflow: 'hidden',
  },
  availableToSpendProgressFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  availableToSpendProgressText: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: '#E2E8F0',
    fontWeight: '600',
  },
  spendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    minWidth: 90,
  },
  spendButtonText: {
    fontSize: getScaledFontSize(15, textSizeMultiplier),
    fontWeight: '600',
    color: colors.primary,
  },
  payoutsBalanceCard: {
    backgroundColor: '#1E3A8A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payoutsBalanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  payoutsBalanceInfo: {
    flex: 1,
    gap: 8,
  },
  payoutsBalanceLabel: {
    fontSize: getScaledFontSize(13, textSizeMultiplier),
    fontWeight: '500',
    color: colors.textTertiary,
    marginBottom: 4,
  },
  payoutsBalanceAmount: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 32 : 28, textSizeMultiplier),
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  payoutsBalanceSubtext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payoutsBalanceSubtextText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 13, textSizeMultiplier),
    color: colors.textSecondary,
  },
  payoutsBalanceProgress: {
    marginTop: 8,
    gap: 6,
  },
  payoutsBalanceProgressTrack: {
    height: 8,
    borderRadius: 8,
    backgroundColor: '#ffffff33',
    overflow: 'hidden',
  },
  payoutsBalanceProgressFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: colors.accent,
  },
  payoutsBalanceProgressText: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: '#E2E8F0',
    fontWeight: '600',
  },
  createPayoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    minWidth: 100,
  },
  createPayoutButtonText: {
    fontSize: getScaledFontSize(15, textSizeMultiplier),
    fontWeight: '600',
    color: colors.primary,
  },
  ongoingSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginBottom: 12,
  },
  ongoingSectionTitle: {
    fontSize: getScaledFontSize(17, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
  },
  ongoingCarouselContainer: {
    paddingRight: 1,
  },
  ongoingCardWrapper: {
    width: Platform.OS === 'ios' ? 300 : 280,
    marginRight: Platform.OS === 'ios' ? 16 : 10,
  },
  ongoingSingleCard: {
    marginHorizontal: 5,
    marginBottom: 16,
  },
  upNextSectionHeader: {
    paddingHorizontal: 5,
    marginBottom: 12,
  },
  upNextSectionTitle: {
    fontSize: getScaledFontSize(17, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
  },
  upNextCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 5,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,

  },
  upNextCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  upNextIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  upNextHeaderContent: {
    flex: 1,
    gap: 6,
  },
  upNextLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  upNextLabel: {
    fontSize: getScaledFontSize(13, textSizeMultiplier),
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    flex: 1,
  },
  upNextReadyTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  upNextReadyTagReady: {
    backgroundColor: colors.primary,
    borderColor: colors.accent,
  },
  upNextReadyTagNotReady: {
    backgroundColor: '#6F7E93' + '15',
    borderColor: '#6F7E93' + '40',
  },
  upNextReadyTagText: {
    fontSize: getScaledFontSize(11, textSizeMultiplier),
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  upNextReadyTagTextReady: {
    color: colors.accent,
  },
  upNextReadyTagTextNotReady: {
    color: '#6F7E93',
  },
  upNextPlanName: {
    fontSize: getScaledFontSize(17, textSizeMultiplier),
    fontWeight: '500',
    color: colors.text,
    marginBottom: -8,
  },
  upNextCategoryIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  upNextCategoryIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentBackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  upNextStackedIcon: {
    marginLeft: -14, // Half overlap (50% of 28px width)
  },
  upNextSelectedCategoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    flex: 1,
  },
  upNextSelectedCategoryText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 11, textSizeMultiplier),
    color: colors.textSecondary,
    fontWeight: '500',
  },
  upNextCardBody: {
    marginTop: 16,
    gap: 5,
  },
  upNextAmountRow: {
    marginBottom: 4,
  },
  upNextBudgetAmount: {
    fontSize: getScaledFontSize(25, textSizeMultiplier),
    fontWeight: '700',
    color: colors.text,
  },
  upNextDaysBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '45%',
    backgroundColor: colors.accentBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  upNextDaysText: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    fontWeight: '600',
    color: colors.primary,
  },
  upNextDate: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: colors.textSecondary,
    fontWeight: '500',
  },
  upNextProgressContainer: {
    gap: 8,
  },
  upNextProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upNextProgressLabel: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    fontWeight: '600',
    color: colors.textSecondary,
  },
  upNextProgressBarContainer: {
    width: '100%',
  },
  upNextProgressBarBackground: {
    height: 6,
    backgroundColor: colors.border || colors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  upNextProgressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  balanceCard: {
    borderRadius: 15,
    borderWidth: 1,
    // backgroundColor: colors.balanceBackground,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 10,
    marginTop: 0,
  },
  balanceCardContent: {
    paddingVertical: Platform.OS === 'ios' ? 16 : 15,
    paddingHorizontal: Platform.OS === 'ios' ? 16 : 15,
  },
  balanceHeaderPressable: {
    width: '100%',
  },
  balanceLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceLabel: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 15, textSizeMultiplier),
    fontWeight: '600',
    color: colors.textTertiary,
  },
  historyButton: {
    padding: 4,
  },
  eyeIconButton: {
    padding: 4,
  },
  addFundsLink: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 15, textSizeMultiplier),
    fontWeight: '600',
  },
  balanceAmount: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 40 : 38, textSizeMultiplier),
    fontWeight: '700',
    color: '#fff',
    marginBottom: Platform.OS === 'ios' ? -10 : -10,
  },
  lockedSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    marginBottom: 12,
  },
  lockedLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedLabel: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    color: colors.textTertiary,
  },
  lockedAmount: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '600',
    color: '#fff',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 1,
  },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    // padding: Platform.OS === 'ios' ? 14 : 14,
    borderRadius: Platform.OS === 'ios' ? 20 : 20,
    height: Platform.OS === 'ios' ? 45 : 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  createButtonBalance: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    // padding: Platform.OS === 'ios' ? 14 : 14,
    borderRadius: Platform.OS === 'ios' ? 20 : 20,
    height: Platform.OS === 'ios' ? 45 : 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 13, textSizeMultiplier),
    fontWeight: '600',
  },
  createButtonTextBalance: {
    color: colors.primary,
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 13, textSizeMultiplier),
    fontWeight: '600',
  },
  addFundsButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Platform.OS === 'ios' ? colors.backgroundBlack + '70' : colors.background + '10',
    // padding: Platform.OS === 'ios' ? 14 : 10,
    borderWidth: 2, 
    borderColor: isDark ? '#fff' : colors.primary,
    borderRadius: Platform.OS === 'ios' ? 20 : 20,
    height: Platform.OS === 'ios' ? 45 : 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addFundsButtonBalance: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: '#fff',
    // backgroundColor: '#1E3A8A',
    // padding: Platform.OS === 'ios' ? 14 : 14,
    borderRadius: Platform.OS === 'ios' ? 20 : 20,
    height: Platform.OS === 'ios' ? 45 : 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addFundsText: {
    color: colors.primary,
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 13, textSizeMultiplier),
    fontWeight: '600',
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFundsTextBalance: {
    color: '#fff',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 13, textSizeMultiplier),
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
  floatingAddButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tabContentWrapper: {
    flex: 1,
    marginHorizontal: -16, // Extend beyond parent padding
  },
  tabContentScrollView: {
    flex: 1,
    // Width will be set inline
  },
  tabPage: {
    flex: 1,
    paddingHorizontal: 16, // Add padding back to each page
    flexShrink: 0,
  },
  bottomPadding: {
    height: 1,
  },
  linkedAccountsCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  linkedAccountsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkedAccountsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkedAccountsTextContainer: {
    flex: 1,
    gap: 4,
  },
  linkedAccountsTitle: {
    fontSize: getScaledFontSize(16, textSizeMultiplier),
    fontWeight: '600',
  },
  linkedAccountsSubtitle: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
  },
  quickTopupCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  quickTopupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickTopupIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickTopupTextContainer: {
    flex: 1,
    gap: 4,
  },
  quickTopupTitle: {
    fontSize: getScaledFontSize(16, textSizeMultiplier),
    fontWeight: '600',
  },
  quickTopupSubtitle: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
  },

});