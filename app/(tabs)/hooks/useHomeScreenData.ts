import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Animated, Image, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useBalance } from '@/contexts/BalanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import { useHaptics } from '@/hooks/useHaptics';
import { useRecentAccountCreation } from '@/hooks/useRecentAccountCreation';
import { useHasCreatedPayoutPlan } from '@/hooks/useHasCreatedPayoutPlan';
import { updateNextPayoutWidget } from '@/lib/widgetStorage';
import { logAnalyticsEvent } from '@/lib/firebase';
import { usePin } from '@/contexts/PinContext';

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

export function useHomeScreenData() {
  const { showBalances, toggleBalances, availableBalance, lockedBalance, refreshWallet } = useBalance();
  const { session } = useAuth();
  const { payoutPlans, isLoading: payoutPlansLoading, fetchPayoutPlans } = useRealtimePayoutPlans();
  const { transactions, isLoading: transactionsLoading, fetchTransactions } = useRealtimeTransactions();
  const { progress, currentTier, getTierInfo, loadProgress, isLoading: kycProgressLoading } = useKYCProgress();
  const { isRecentAccount, isLoading: recentAccountLoading } = useRecentAccountCreation();
  const { hasCreatedPayoutPlan, isLoading: hasCreatedPayoutPlanLoading } = useHasCreatedPayoutPlan();
  const { hasAppLockPin, isLoading: pinLoading } = usePin();
  const { impact, notification } = useHaptics();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [carouselImages, setCarouselImages] = useState<any[]>([]);
  const [imagesReady, setImagesReady] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [isBalanceCardExpanded, setIsBalanceCardExpanded] = useState(false);
  const balanceCardAnimation = useRef(new Animated.Value(0)).current;
  
  // Pending actions data
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

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

  // Fetch profile data for pending actions
  const fetchProfileData = useCallback(async () => {
    if (!session?.user?.id) {
      setProfileLoading(false);
      return;
    }
    
    try {
      setProfileLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('email_verified, app_lock_enabled, two_factor_enabled, account_verified')
        .eq('id', session.user.id)
        .single();

      if (!error) setProfileData(data);
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setProfileLoading(false);
    }
  }, [session?.user?.id]);

  // Fetch carousel images
  const fetchCarouselImages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (error) return;

      if (data && data.length > 0) {
        const preloadedImages = await Promise.all(
          data.map(async (banner: Banner) => {
            try {
              await new Promise<void>((resolve, reject) => {
                Image.getSize(banner.image_url, () => resolve(), (err) => reject(err));
              });
              return banner;
            } catch (error) {
              return banner;
            }
          })
        );
        setCarouselImages(preloadedImages);
        setImagesReady(true);
      } else {
        setImagesReady(true);
      }
    } catch (error) {
      console.error('Error fetching carousel images:', error);
      setImagesReady(true);
    }
  }, []);

  useEffect(() => {
    fetchCarouselImages();
    if (session?.user?.id) {
      fetchProfileData();
      loadProgress();
    }
  }, [fetchCarouselImages, fetchProfileData, loadProgress, session?.user?.id]);

  // Update current date every minute for greeting
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const getGreeting = useCallback(() => {
    const hour = currentDate.getHours();
    if (hour >= 0 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, [currentDate]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshWallet(),
        fetchPayoutPlans(),
        fetchTransactions(),
        loadProgress(),
        fetchCarouselImages(),
        fetchProfileData(),
      ]);
      impact();
    } catch (error) {
      console.error('Error refreshing page data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshWallet, fetchPayoutPlans, fetchTransactions, loadProgress, impact, fetchCarouselImages, fetchProfileData]);

  const toggleBalanceCardExpansion = useCallback(() => {
    const toValue = isBalanceCardExpanded ? 0 : 1;
    setIsBalanceCardExpanded(!isBalanceCardExpanded);
    Animated.timing(balanceCardAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
    notification();
  }, [isBalanceCardExpanded, balanceCardAnimation, notification]);

  const getBalanceParts = useCallback((amount: number) => {
    if (!showBalances) return { main: '******', decimal: '' };
    const formatted = amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dotIndex = formatted.lastIndexOf('.');
    if (dotIndex === -1) return { main: `₦${formatted}`, decimal: '' };
    return { main: `₦${formatted.slice(0, dotIndex)}`, decimal: formatted.slice(dotIndex) };
  }, [showBalances]);

  const activePlans = useMemo(() => {
    return payoutPlans.filter(plan => plan.status === 'active');
  }, [payoutPlans]);

  const nextPayout = useMemo(() => payoutPlans
    .filter(plan => {
      if (plan.status !== 'active' || !plan.next_payout_date) return false;
      if (plan.completed_payouts >= plan.duration) return false;
      const nextPayoutDate = new Date(plan.next_payout_date);
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      return nextPayoutDate > oneMinuteAgo;
    })
    .sort((a, b) => {
      const dateA = new Date(a.next_payout_date!);
      const dateB = new Date(b.next_payout_date!);
      return dateA.getTime() - dateB.getTime();
    })[0], [payoutPlans]);

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
  }, [session?.user?.id, nextPayout]);

  const firstName = session?.user?.user_metadata?.first_name || 'User';
  const lastName = session?.user?.user_metadata?.last_name || '';

  // Determine if composite UI (Carousel + Pending Actions) is ready
  // Initial load: wait for everything. Subsequent refreshes: stay visible.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  
  const isCompositeReady = useMemo(() => {
    const isReady = imagesReady && (!session?.user || (!profileLoading && !pinLoading && !kycProgressLoading));
    if (isReady && !hasLoadedOnce) {
      setHasLoadedOnce(true);
    }
    return hasLoadedOnce || isReady;
  }, [imagesReady, session?.user, profileLoading, pinLoading, kycProgressLoading, hasLoadedOnce]);

  return {
    showBalances,
    toggleBalances,
    availableBalance,
    lockedBalance,
    payoutPlans,
    payoutPlansLoading,
    transactions,
    transactionsLoading,
    isRefreshing,
    handleRefresh,
    carouselImages,
    imagesReady,
    isCompositeReady,
    hasAccount,
    isBalanceCardExpanded,
    balanceCardAnimation,
    toggleBalanceCardExpansion,
    getGreeting,
    getBalanceParts,
    activePlans,
    nextPayout,
    firstName,
    lastName,
    isAuthenticated: !!session?.user,
    userId: session?.user?.id,
    hasCreatedPayoutPlan,
    isRecentAccount,
    fetchPayoutPlans,
    // Data for PendingActions
    pendingActionsData: {
      profileData,
      isLoading: profileLoading || pinLoading || kycProgressLoading,
      pinLoading,
      hasAppLockPin,
      progress,
      currentTier,
    }
  };
}
