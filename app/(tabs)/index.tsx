import React, { useState, useEffect } from 'react';
import TransactionModal from '@/components/TransactionModal';
import AccountCreationSuccessModal from '@/components/AccountCreationSuccessModal';
import InitialsAvatar from '@/components/InitialsAvatar';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import PendingActionsCard from '@/components/PendingActionsCard';
import ImageCarousel from '@/components/ImageCarousel';
import MostRecentPayoutsCard from '@/components/MostRecentPayoutsCard';
import { useRoute } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowDownRight,
  ArrowRightIcon,
  BanknoteArrowDown,
  BanknoteArrowUp,
  HelpCircleIcon,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  CircleHelp as HelpCircle,
  Lock,
  Plus,
  RefreshCw,
  Star,
  CalendarCheck,
  ArrowLeft,
  History
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
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBalance } from '@/contexts/BalanceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions';
import { usePaystackTransactions } from '@/hooks/usePaystackTransactions';
import { useHaptics } from '@/hooks/useHaptics';
import { useRecentAccountCreation } from '@/hooks/useRecentAccountCreation';
import { logAnalyticsEvent } from '@/lib/firebase';
import NotificationIcon from '@/components/NotificationIcon';
import { supabase } from '@/lib/supabase';
import intercomService from '@/lib/IntercomService';
import NextPayoutCard from '@/components/NextPayoutCard';
import PayoutPlansSection from '@/components/PayoutPlansSection';
import RatingCard from '@/components/RatingCard';
import AISuggestionCard from '@/components/AISuggestionCard';

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
  const { payoutPlans, isLoading: payoutPlansLoading } = useRealtimePayoutPlans();
  const { isRecentAccount, isLoading: recentAccountLoading } = useRecentAccountCreation();
  
  // Debug: Track payoutPlans changes
  useEffect(() => {
    console.log('📊 Dashboard: payoutPlans updated', {
      count: payoutPlans.length,
      plans: payoutPlans.map(p => ({ id: p.id, name: p.name, status: p.status }))
    });
  }, [payoutPlans]);
  const { transactions, isLoading: transactionsLoading } = useRealtimeTransactions();
  const { fetchPaystackTransactions, isLoading: paystackLoading } = usePaystackTransactions();
  const { impact, notification } = useHaptics();
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isTransactionModalVisible, setIsTransactionModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHelpLoading, setIsHelpLoading] = useState(false);
  const [carouselImages, setCarouselImages] = useState<any[]>([]);
  const [imagesReady, setImagesReady] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [hasShownWelcomeModal, setHasShownWelcomeModal] = useState(false);
  const route = useRoute();
  const params = useLocalSearchParams();
  const scrollY = (route.params as { scrollY?: Animated.Value })?.scrollY || new Animated.Value(0);

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

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Refresh wallet balance
      await refreshWallet();
      // Fetch latest Paystack transactions
      await fetchPaystackTransactions();
      // Add haptic feedback for successful refresh
      impact();
    } catch (error) {
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const handleHelpPress = async () => {
    try {
      setIsHelpLoading(true);
      console.log('🎯 Help button pressed');
      
      // Follow the official Intercom guide
      const { default: Intercom } = await import('@intercom/intercom-react-native');
      
      if (!session?.user?.id) {
        console.log('👤 No user session, logging in as unidentified user...');
        await Intercom.loginUnidentifiedUser();
        console.log('✅ Unidentified user logged in');
      } else {
        console.log('👤 User session found, updating user data...');
        
        // Get user name from metadata
        const firstName = session.user.user_metadata?.first_name || '';
        const lastName = session.user.user_metadata?.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        
        console.log('👤 User data for Intercom:', {
          userId: session.user.id,
          email: session.user.email,
          firstName,
          lastName,
          fullName
        });

        try {
          // First, try to update the existing user with new attributes
          await Intercom.updateUser({
            userId: session.user.id,
            email: session.user.email,
            name: fullName || session.user.email?.split('@')[0] || 'User',
            phone: session.user.phone || undefined,
            customAttributes: {
              first_name: firstName,
              last_name: lastName,
              user_type: 'customer',
              app_version: '1.0.0'
            }
          });
          console.log('✅ User updated successfully');
        } catch (updateError) {
          console.log('⚠️ Update failed, trying to login with user attributes...');
          
          // If update fails, try to login with user attributes
          await Intercom.loginUserWithUserAttributes({
            userId: session.user.id,
            email: session.user.email,
            name: fullName || session.user.email?.split('@')[0] || 'User',
            phone: session.user.phone || undefined,
            customAttributes: {
              first_name: firstName,
              last_name: lastName,
              user_type: 'customer',
              app_version: '1.0.0'
            }
          });
          console.log('✅ User logged in to Intercom');
        }
        
        // Get JWT from Supabase Edge Function for secure authentication
        console.log('🔐 Getting JWT from server...');
        const jwtResponse = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/intercom-jwt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
          }
        });
        
        if (!jwtResponse.ok) {
          throw new Error('Failed to get JWT from server');
        }
        
        const { jwt } = await jwtResponse.json();
        
        // Set the JWT before making any user registration calls
        console.log('🔐 Setting JWT for Intercom...');
        await Intercom.setUserJwt(jwt);
        console.log('✅ JWT set successfully');
        
        // Now login with user attributes
        await Intercom.loginUserWithUserAttributes({
          userId: session.user.id,
          email: session.user.email,
          name: fullName || session.user.email?.split('@')[0] || 'User',
          phone: session.user.phone || undefined,
          customAttributes: {
            first_name: firstName,
            last_name: lastName,
            user_type: 'customer',
            app_version: '1.0.0'
          }
        });
        console.log('✅ User logged in to Intercom with JWT');
      }
      
      // Wait for authentication to complete
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Now present Intercom
      console.log('🎯 Presenting Intercom...');
      await Intercom.present();
      
      logAnalyticsEvent('help_click');
      
    } catch (error) {
      
      // Show user-friendly error
      Alert.alert(
        'Intercom Error',
        'Unable to open support chat. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsHelpLoading(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

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

  const handleAddFunds = () => {
    // Trigger medium impact haptic feedback
    impact();
    router.push('/add-funds');
    logAnalyticsEvent('add_funds_click');
  };

  const handleCreatePayout = () => {
    // Trigger medium impact haptic feedback
    impact();
    router.push('/create-payout/amount');
    logAnalyticsEvent('create_payout_click');
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

  const handleStartVerification = () => {
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
      
      // Check if the next payout date is in the future (not expired)
      const nextPayoutDate = new Date(plan.next_payout_date);
      return nextPayoutDate > new Date();
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

  const styles = createStyles(colors, isDark);

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
                fontSize={18}
              />
            </Pressable>
            <View style={styles.headerActions}>
              <NotificationIcon />
              <Pressable 
                onPress={handleHelpPress} 
                style={styles.helpButton}
                disabled={isHelpLoading}
              >
                {isHelpLoading ? (
                  <PlanmoniLoader size="small" />
                ) : (
                  <HelpCircleIcon size={24} color={colors.text} />
                )}
              </Pressable>
            </View>
          </View>
          <View style={styles.greetingContainer}>
            <Text style={styles.greeting}>{getGreeting()}, {firstName}.</Text>
            <Text style={styles.subGreeting}>It's time to plan some payouts</Text>
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
                <Text style={styles.balanceLabel}>Available Balance</Text>
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
                <Lock size={16} color={colors.textSecondary} />
                <Text style={styles.lockedLabel}>Locked for payouts</Text>
              </View>
              <Text style={styles.lockedAmount}>{formatBalance(lockedBalance)}</Text>
            </View>
            <View style={styles.buttonGroup}>
              <Pressable 
                style={styles.addFundsButton} 
                onPress={handleAddFunds}
              >
                
                <BanknoteArrowDown size={24} color={colors.textSecondary}/>
                <Text style={styles.addFundsText}>Deposit</Text>
              </Pressable>
              <Pressable 
                style={styles.createButton} 
                onPress={handleCreatePayout}
              >
                <CalendarCheck size={22} color='#fff' />
                <Text style={styles.createButtonText}>Create Plan</Text>
              </Pressable>
              
            </View>
          </View>
        </ImageBackground>
        {/* AI Suggestion Section */}
        <AISuggestionCard 
          availableBalance={availableBalance}
          onSuggestionPress={handleAISuggestionPress}
        />
        <ImageCarousel images={carouselImages} />
        <PendingActionsCard />
        <MostRecentPayoutsCard onTransactionPress={handleTransactionPress} />


        {/* Most Recent Payouts Section */}

        {/* Next Payout Section */}
        <NextPayoutCard nextPayout={nextPayout} />

        {/* Payout Plans Section */}
        <PayoutPlansSection activePlans={activePlans} />

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
          <BanknoteArrowDown size={24} color={colors.textSecondary} />
          <Text style={styles.addFundsText}>Deposit</Text>
        </Pressable>
        <Pressable 
          style={styles.createButton} 
          onPress={handleCreatePayout}
        >
          <CalendarCheck size={22} color='#fff' />
          <Text style={styles.createButtonText}>Create Plan</Text>
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
      
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 150,
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
    fontSize: Platform.OS === 'ios' ? 20 : 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: Platform.OS === 'ios' ? 10 : 5,
  },
  subGreeting: {
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 18,
  },

  balanceCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 10,
  },
  balanceCardContent: {
    paddingVertical: Platform.OS === 'ios' ? 16 : 10,
    paddingHorizontal: Platform.OS === 'ios' ? 16 : 10,
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
    fontSize: Platform.OS === 'ios' ? 16 : 14,
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
    fontSize: Platform.OS === 'ios' ? 30 : 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: Platform.OS === 'ios' ? 10 : 0,
  },
  lockedSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: Platform.OS === 'ios' ? 10 : 0,
  },
  lockedLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedLabel: {
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    color: colors.textSecondary,
  },
  lockedAmount: {
    fontSize: Platform.OS === 'ios' ? 16 : 14,
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
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    fontWeight: '600',
  },
  addFundsButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.backgroundBlack,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    padding: Platform.OS === 'ios' ? 14 : 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addFundsText: {
    color: colors.textSecondary,
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    fontWeight: '600',
  },
  summaryCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 16,
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
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
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
    fontSize: 16,
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
    fontSize: 16,
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
    fontSize: 12,
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
    fontSize: 14,
    fontWeight: '400',
    color: colors.text,
  },
  payoutAmount: {
    fontSize: 24,
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
    fontSize: 14,
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
    borderRadius: 8,
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