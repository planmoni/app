import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import NewPlanInfoModal from '@/components/NewPlanInfoModal';
import AddPayoutPlanByCodeModal from '@/components/AddPayoutPlanByCodeModal';
import AccountInformationModal from '@/components/AccountInformationModal';
import PlanCreationModal from '@/components/PlanCreationModal';
import AppLockModal from '@/components/AppLockModal';
import IdentityVerificationSuccessModal from '@/components/IdentityVerificationSuccessModal';
import OnboardingQuestionnaireModal from '@/components/OnboardingQuestionnaireModal';
import KYCVerificationModal from '@/components/KYCVerificationModal';
import MostRecentPayoutsCard from '@/components/MostRecentPayoutsCard';
import { useRoute, useNavigation } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  HelpCircleIcon,
  Eye,
  EyeOff,
  Plus,
  CalendarCheck,
  Clock,
  ChevronDown,
} from 'lucide-react-native';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
  RefreshControl,
  Image,
  Platform,
  BackHandler,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { useAppLock } from '@/contexts/AppLockContext';
import { usePin } from '@/contexts/PinContext';
import { useHaptics } from '@/hooks/useHaptics';
import { logAnalyticsEvent } from '@/lib/firebase';
import NotificationIcon from '@/components/NotificationIcon';
import NextPayoutCard from '@/components/NextPayoutCard';
import PayoutPlansSection from '@/components/PayoutPlansSection';
import RatingCard from '@/components/RatingCard';
import AISuggestionCard from '@/components/AISuggestionCard';
import OnTrackCard from '@/components/OnTrackCard';
import ImageCarousel from '@/components/ImageCarousel';
import PendingActionsCard from '@/components/PendingActionsCard';
import PlanmoniLoader from '@/components/PlanmoniLoader';
import { useIntercom } from '@/hooks/useIntercom';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Internal hooks and styles
import { useHomeScreenData } from './hooks/useHomeScreenData';
import { useHomeScreenModals } from './hooks/useHomeScreenModals';
import { createStyles } from './index.styles';

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { updateLastActiveOnInteraction } = useAppLock();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { requireAuth } = useRequireAuth();
  const { impact } = useHaptics();
  const { hasAppLockPin } = usePin();
  const params = useLocalSearchParams();
  const route = useRoute();
  const scrollY = (route.params as { scrollY?: Animated.Value })?.scrollY || new Animated.Value(0);

  // Data hook
  const data = useHomeScreenData();
  const {
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
    isBalanceCardExpanded,
    balanceCardAnimation,
    toggleBalanceCardExpansion,
    getGreeting,
    getBalanceParts,
    activePlans,
    nextPayout,
    firstName,
    lastName,
    isAuthenticated,
    userId,
    hasCreatedPayoutPlan,
    fetchPayoutPlans,
    isCompositeReady,
  } = data;

  // Modals hook
  const modals = useHomeScreenModals({
    userId,
    isAuthenticated,
    payoutPlans,
    hasAppLockPin,
    params,
    transactions,
  });
  const {
    isTransactionModalVisible,
    setIsTransactionModalVisible,
    selectedTransaction,
    showHowItWorksModal,
    setShowHowItWorksModal,
    showWelcomeModalForUnauth,
    setShowWelcomeModalForUnauth,
    showClaimAccountModal,
    setShowClaimAccountModal,
    showNewPlanInfoModal,
    setShowNewPlanInfoModal,
    showAddByCodeModal,
    setShowAddByCodeModal,
    showAccountInfoModal,
    setShowAccountInfoModal,
    showPlanCreationModal,
    setShowPlanCreationModal,
    lastDepositAmount,
    showAppLockModal,
    setShowAppLockModal,
    setHasShownAppLockModal,
    showIdentityVerificationModal,
    setShowIdentityVerificationModal,
    showKYCVerificationModal,
    setShowKYCVerificationModal,
    showOnboardingQuestionnaire,
    setShowOnboardingQuestionnaire,
    handleTransactionPress,
  } = modals;

  // Lazy load heavy modals
  const [TransactionModalComponent, setTransactionModalComponent] = useState<React.ComponentType<any> | null>(null);
  const [ClaimAccountModalComponent, setClaimAccountModalComponent] = useState<React.ComponentType<any> | null>(null);
  const [WelcomeModalComponent, setWelcomeModalComponent] = useState<React.ComponentType<any> | null>(null);

  // Pre-load WelcomeModal immediately
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

  // Prevent navigation back to welcome page when authenticated
  useEffect(() => {
    if (!userId) return;

    navigation.setOptions({ gestureEnabled: false });

    const backHandler = Platform.OS === 'android' 
      ? BackHandler.addEventListener('hardwareBackPress', () => true)
      : null;

    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      const action = e.data.action;
      if (action.type === 'GO_BACK' || action.type === 'POP') {
        e.preventDefault();
        return;
      }
      if (action.type === 'NAVIGATE' && (action.payload as any)?.name === 'index') {
        e.preventDefault();
        return;
      }
    });

    return () => {
      unsubscribe();
      if (backHandler) backHandler.remove();
      navigation.setOptions({ gestureEnabled: false });
    };
  }, [navigation, userId]);

  // Intercom
  const { openChat, isLoading, isSupported } = useIntercom();

  const handleProfilePress = useCallback(() => {
    router.push('/profile');
    logAnalyticsEvent('profile_click');
  }, []);

  const handleHelpPress = useCallback(async () => {
    try {
      await openChat();
      logAnalyticsEvent('help_click');
    } catch (error) {
      console.error('Failed to open Intercom:', error);
      Alert.alert(
        'Support Chat Unavailable',
        'Unable to open support chat at the moment. Network connectivity might be an issue.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Retry', onPress: handleHelpPress }]
      );
    }
  }, [openChat]);

  // Ref to prevent duplicate navigation
  const isNavigatingToAddFundsRef = useRef(false);

  const handleAddFunds = useCallback(async () => {
    if (isNavigatingToAddFundsRef.current) return;
    impact();
    
    if (!isAuthenticated) {
      setShowWelcomeModalForUnauth(true);
      logAnalyticsEvent('add_funds_click_unauthenticated_modal');
      return;
    }
    
    isNavigatingToAddFundsRef.current = true;
    router.push('/add-funds');
    logAnalyticsEvent('add_funds_click');
    setTimeout(() => {
      isNavigatingToAddFundsRef.current = false;
    }, 1000);
  }, [impact, isAuthenticated, setShowWelcomeModalForUnauth]);

  const handleCreatePayout = useCallback(() => {
    impact();
    if (isAuthenticated) {
      if (hasCreatedPayoutPlan) {
        router.push('/create-payout/amount');
        logAnalyticsEvent('create_payout_click_direct');
      } else {
        setShowNewPlanInfoModal(true);
        logAnalyticsEvent('create_payout_click_modal');
      }
    } else {
      setShowWelcomeModalForUnauth(true);
      logAnalyticsEvent('create_payout_click_modal');
    }
  }, [impact, isAuthenticated, hasCreatedPayoutPlan, setShowNewPlanInfoModal, setShowWelcomeModalForUnauth]);

  const handleAISuggestionPress = useCallback((suggestion: any) => {
    if (!requireAuth(() => {}, '/create-payout/frequency-selection')) return;
    impact();
    const mappedFrequency = suggestion.frequency === 'weekly' ? 'weekly_specific' : suggestion.frequency;
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
  }, [requireAuth, impact, availableBalance]);

  const buttonOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const lockedSectionHeight = balanceCardAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 50],
  });

  const lockedSectionOpacity = balanceCardAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handleShowNewPlanInfo = useCallback(() => {
    if (isAuthenticated) {
      setShowNewPlanInfoModal(true);
    } else {
      setShowWelcomeModalForUnauth(true);
    }
  }, [isAuthenticated, setShowNewPlanInfoModal, setShowWelcomeModalForUnauth]);

  const handleShowHowItWorks = useCallback(() => {
    setShowHowItWorksModal(true);
  }, [setShowHowItWorksModal]);

  const handleShowWelcomeModal = useCallback(() => {
    setShowWelcomeModalForUnauth(true);
  }, [setShowWelcomeModalForUnauth]);

  const styles = useMemo(() => createStyles(colors, isDark, textSizeMultiplier), [colors, isDark, textSizeMultiplier]);

  if (!isSupported) return null;

  if (payoutPlansLoading || transactionsLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <PlanmoniLoader blurBackground={true} size="medium" description="Loading your financial data..." />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        onScrollBeginDrag={updateLastActiveOnInteraction}
        onTouchStart={updateLastActiveOnInteraction}
        scrollEventThrottle={16}
        bounces={true}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#fff" />
        }
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={isDark ? ['#0E141F', '#0E141F'] : ['#F8FAFC', '#F8FAFC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.gradientContainer, { paddingTop: insets.top + 200, marginTop: -200 }]}
        >
          <View style={styles.gradientContent}>
            <View style={styles.header}>
              <View style={styles.headerTop}>
                {isAuthenticated ? (
                  <Pressable onPress={handleProfilePress} style={styles.avatarButton}>
                    <View style={styles.whiteAvatarContainer}>
                      <Text style={styles.whiteAvatarText}>
                        {(firstName?.[0] || '').toUpperCase()}{(lastName?.[0] || '').toUpperCase()}
                      </Text>
                    </View>
                  </Pressable>
                ) : (
                  <Pressable style={styles.avatarButton}>
                    <View style={[styles.avatarPlaceholder, { backgroundColor: '#fff' }]}>
                      <Image source={require('@/assets/images/homeicon.png')} style={styles.avatarAppIcon} resizeMode="contain" />
                    </View>
                  </Pressable>
                )}
                <View style={styles.headerActions}>
                  <NotificationIcon color={isDark ? '#fff' : '#000'} />
                  <Pressable onPress={handleHelpPress} style={styles.helpButton} disabled={isLoading}>
                    {isLoading ? <PlanmoniLoader size="small" /> : <HelpCircleIcon size={24} color={isDark ? '#fff' : '#000'} />}
                  </Pressable>
                </View>
              </View>
              <View style={styles.greetingContainer}>
                <View style={styles.greetingRow}>
                  <Text style={styles.greeting}>
                    {getGreeting()}{isAuthenticated ? `, ${firstName}.` : '.'}
                  </Text>
                  {!isAuthenticated && (
                    <Pressable onPress={() => router.push('/(auth)/login')} style={[styles.loginButton, { borderColor: isDark ? '#fff' : '#000' }]}>
                      <Text style={[styles.loginButtonText, {color: isDark ? '#fff' : '#000' }]}>Login</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.balanceCard}>
              <View style={styles.balanceCardContent}>
                <Pressable onPress={toggleBalanceCardExpansion} style={styles.balanceHeaderPressable}>
                  <View style={styles.balanceLabelContainer}>
                    <View style={styles.balanceLabelGroup}>
                      <Text style={styles.balanceLabel}>Your available balance</Text>
                      <Pressable onPress={(e) => { e.stopPropagation(); toggleBalances(); }} style={styles.eyeIconButton} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                        {showBalances ? <EyeOff size={16} color={colors.textSecondary} /> : <Eye size={16} color={colors.textSecondary} />}
                      </Pressable>
                    </View>
                    <Pressable onPress={toggleBalanceCardExpansion} style={styles.expandButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Animated.View style={{ transform: [{ rotate: balanceCardAnimation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
                        <ChevronDown size={20} color={colors.textSecondary} />
                      </Animated.View>
                    </Pressable>
                  </View>
                </Pressable>
                <Text style={styles.balanceAmount}>
                  {(() => {
                    const parts = getBalanceParts(availableBalance);
                    return <>{parts.main}{parts.decimal ? <Text style={{ color: colors.textTertiary }}>{parts.decimal}</Text> : null}</>;
                  })()}
                </Text>
                <Animated.View style={[styles.lockedSection, { height: lockedSectionHeight, opacity: lockedSectionOpacity, overflow: 'hidden' }]}>
                  <View style={styles.lockedLabelContainer}>
                    <Clock size={16} color={colors.textSecondary} />
                    <Text style={styles.lockedLabel}>
                      {(() => {
                        const parts = getBalanceParts(lockedBalance);
                        return <>{parts.main}{parts.decimal ? <Text style={{ color: colors.textTertiary }}>{parts.decimal}</Text> : null}{' locked in active payout plans'}</>;
                      })()}
                    </Text>
                  </View>
                </Animated.View>
                <View style={styles.buttonGroup}>
                  <Pressable style={styles.addFundsButton} onPress={handleAddFunds}>
                    <Plus size={18} color={isDark ? '#fff' : colors.primary}/>
                    <Text style={[styles.addFundsText, { color: isDark ? '#fff' : colors.primary }]}>Add funds</Text>
                  </Pressable>
                  <Pressable style={styles.createButton} onPress={handleCreatePayout}>
                    <CalendarCheck size={18} color={isDark ? '#fff' : '#C3F57E'} />
                    <Text style={styles.createButtonText}>New Plan</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
        
        <View style={styles.contentContainer}>
          <OnTrackCard payoutPlans={payoutPlans} />
          {isAuthenticated && <AISuggestionCard availableBalance={availableBalance} onSuggestionPress={handleAISuggestionPress} />}
          
          {isCompositeReady && (
            <>
              <ImageCarousel images={carouselImages} onImagePress={!isAuthenticated ? () => setShowWelcomeModalForUnauth(true) : undefined} />
              <PendingActionsCard {...data.pendingActionsData} />
            </>
          )}
          
          <MostRecentPayoutsCard onTransactionPress={handleTransactionPress} />
          <NextPayoutCard nextPayout={nextPayout} />
          <PayoutPlansSection 
            activePlans={activePlans} 
            onShowAddByCodeModal={() => isAuthenticated ? setShowAddByCodeModal(true) : setShowWelcomeModalForUnauth(true)}
            onShowNewPlanInfo={handleShowNewPlanInfo}
            onShowHowItWorks={handleShowHowItWorks}
            onShowWelcomeModal={handleShowWelcomeModal}
            isUserAuthenticated={isAuthenticated}
          />
          <View style={styles.bottomPadding} />
          <RatingCard />
        </View>
      </ScrollView>

      <Animated.View style={[styles.stickyButtons, { opacity: buttonOpacity, transform: [{ translateY: buttonOpacity.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }] }]}>
        <Pressable style={styles.addFundsButton} onPress={handleAddFunds}>
          <Plus size={18} color={isDark ? '#fff' : colors.primary} />
          <Text style={[styles.addFundsText, { color: isDark ? '#fff' : colors.primary }]}>Add funds</Text>
        </Pressable>
        <Pressable style={styles.createButton} onPress={handleCreatePayout}>
          <CalendarCheck size={18} color={isDark ? '#fff' : '#C3F57E'} />
          <Text style={styles.createButtonText}>New Plan</Text>
        </Pressable>
      </Animated.View>

      {selectedTransaction && isTransactionModalVisible && TransactionModalComponent && (
        <TransactionModalComponent isVisible={isTransactionModalVisible} onClose={() => setIsTransactionModalVisible(false)} transaction={selectedTransaction} />
      )}
      
      <AddPayoutPlanByCodeModal
        isVisible={showAddByCodeModal}
        onClose={() => setShowAddByCodeModal(false)}
        onSuccess={fetchPayoutPlans}
        onCreateNewPlan={() => {
          if (hasCreatedPayoutPlan) {
            router.push('/create-payout/amount');
          } else {
            setShowNewPlanInfoModal(true);
          }
        }}
      />

      <NewPlanInfoModal isVisible={showNewPlanInfoModal} onClose={() => setShowNewPlanInfoModal(false)} onAddFundsAfterClose={handleAddFunds} />
      
      {showClaimAccountModal && ClaimAccountModalComponent && (
        <ClaimAccountModalComponent
          isVisible={showClaimAccountModal}
          onClose={() => { setShowClaimAccountModal(false); isNavigatingToAddFundsRef.current = false; }}
          accountNumber="01177 XXXXX"
          bankName="SAFEHAVEN MFB"
          accountName={`PLANMONI/${(firstName || 'YOUR').toUpperCase()} ${(lastName || 'NAME').toUpperCase()}`}
          onClaim={() => {
            if (isNavigatingToAddFundsRef.current) return;
            isNavigatingToAddFundsRef.current = true;
            setShowClaimAccountModal(false);
            router.push('/add-funds');
            logAnalyticsEvent('claim_account_click');
            setTimeout(() => { isNavigatingToAddFundsRef.current = false; }, 1000);
          }}
        />
      )}
      
      {isAuthenticated && (
        <>
          <AccountInformationModal isVisible={showAccountInfoModal} onClose={() => { setShowAccountInfoModal(false); }} onDone={async () => { setShowAccountInfoModal(false); await handleRefresh(); }} />
          <IdentityVerificationSuccessModal isVisible={showIdentityVerificationModal} onClose={() => setShowIdentityVerificationModal(false)} />
          <KYCVerificationModal isVisible={showKYCVerificationModal} onClose={() => setShowKYCVerificationModal(false)} onStartVerification={() => { setShowKYCVerificationModal(false); router.push('/kyc/tier1'); }} />
          <OnboardingQuestionnaireModal visible={showOnboardingQuestionnaire} onClose={() => setShowOnboardingQuestionnaire(false)} onAddFunds={() => router.push('/add-funds')} onDoLater={() => {}} />
          <PlanCreationModal isVisible={showPlanCreationModal} onClose={async () => {
            setShowPlanCreationModal(false);
            try {
              if (userId) {
                const dismissedKey = `deposit_modal_dismissed_${userId}`;
                await AsyncStorage.setItem(dismissedKey, 'true');
              }
            } catch (error) { console.error('Error saving dismissed modal state:', error); }
          }} depositAmount={lastDepositAmount || 0} />
          <AppLockModal isVisible={showAppLockModal} onClose={() => { setShowAppLockModal(false); setHasShownAppLockModal(true); }} />
        </>
      )}

      {showHowItWorksModal && WelcomeModalComponent && <WelcomeModalComponent isVisible={showHowItWorksModal} onClose={() => setShowHowItWorksModal(false)} showButtons={false} />}
      {showWelcomeModalForUnauth && WelcomeModalComponent && <WelcomeModalComponent isVisible={showWelcomeModalForUnauth} onClose={() => setShowWelcomeModalForUnauth(false)} />}
    </View>
  );
}
