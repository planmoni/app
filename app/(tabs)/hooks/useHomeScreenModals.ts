import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';

interface UseHomeScreenModalsProps {
  userId?: string;
  isAuthenticated: boolean;
  payoutPlans: any[];
  hasAppLockPin: boolean;
  params: any;
  transactions: any[];
}

export function useHomeScreenModals({
  userId,
  isAuthenticated,
  payoutPlans,
  hasAppLockPin,
  params,
  transactions,
}: UseHomeScreenModalsProps) {
  const [isTransactionModalVisible, setIsTransactionModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [showWelcomeModalForUnauth, setShowWelcomeModalForUnauth] = useState(false);
  const [showClaimAccountModal, setShowClaimAccountModal] = useState(false);
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
  const [showIdentityVerificationModal, setShowIdentityVerificationModal] = useState(false);
  const [showKYCVerificationModal, setShowKYCVerificationModal] = useState(false);
  const [showOnboardingQuestionnaire, setShowOnboardingQuestionnaire] = useState(false);

  // Check for identity verification success flag
  useEffect(() => {
    if (!userId) return;

    const checkIdentityVerificationSuccess = async () => {
      try {
        const shouldShow = await AsyncStorage.getItem('show_identity_verification_success');
        if (shouldShow === 'true') {
          setTimeout(() => {
            setShowIdentityVerificationModal(true);
            AsyncStorage.removeItem('show_identity_verification_success');
          }, 500);
        }
      } catch (error) {
        console.error('Error checking identity verification success flag:', error);
      }
    };
    
    checkIdentityVerificationSuccess();
  }, [userId]);

  // Show onboarding questionnaire modal
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const checkOnboardingQuestionnaire = async () => {
        if (!userId) return;
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
    }, [userId])
  );

  // Show AccountInformationModal only when coming from Tier1CompletionModal
  useEffect(() => {
    if (!userId) return;
    
    const shouldShowAccountInfo = params.showAccountInfo === 'true';
    
    if (shouldShowAccountInfo && !hasShownAccountInfoModal && !accountInfoModalShownRef.current) {
      accountInfoModalShownRef.current = true;
      setTimeout(() => {
        setShowAccountInfoModal(true);
      }, 500);
      
      router.setParams({ showAccountInfo: undefined });
    }
  }, [params.showAccountInfo, userId, hasShownAccountInfoModal]);

  // Load shown deposit IDs and dismissed modal flag
  useEffect(() => {
    if (!userId) return;

    const loadDepositModalState = async () => {
      try {
        const key = `shown_deposit_ids_${userId}`;
        const dismissedKey = `deposit_modal_dismissed_${userId}`;
        
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
  }, [userId]);

  // Detect new deposits and show PlanCreationModal
  useEffect(() => {
    if (!userId || transactions.length === 0 || hasDismissedDepositModal) return;

    const depositTransactions = transactions.filter(
      t => t.type === 'deposit' && t.status === 'completed'
    );

    if (depositTransactions.length > 0) {
      const latestDeposit = depositTransactions[0];
      const depositAmount = latestDeposit.amount;
      const depositId = latestDeposit.id;

      if (!shownDepositIds.has(depositId) && depositAmount >= 5000) {
        const timer = setTimeout(async () => {
          try {
            const dismissedKey = `deposit_modal_dismissed_${userId}`;
            const dismissed = await AsyncStorage.getItem(dismissedKey);
            
            if (dismissed === 'true') {
              setHasDismissedDepositModal(true);
              return;
            }
            
            setShowPlanCreationModal(true);
            setLastDepositAmount(depositAmount);
            setLastShownDepositId(depositId);
            
            const newShownIds = new Set(shownDepositIds);
            newShownIds.add(depositId);
            setShownDepositIds(newShownIds);
            
            const key = `shown_deposit_ids_${userId}`;
            await AsyncStorage.setItem(key, JSON.stringify(Array.from(newShownIds)));
          } catch (error) {
            console.error('Error checking/saving deposit modal state:', error);
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [transactions, userId, shownDepositIds, hasDismissedDepositModal]);

  // Show AppLockModal if no PIN is set up AND user just created their first plan
  useEffect(() => {
    if (!userId || hasAppLockPin || hasShownAppLockModal) return;

    if (payoutPlans.length === 1) {
      const timer = setTimeout(() => {
        setShowAppLockModal(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [payoutPlans.length, hasAppLockPin, userId, hasShownAppLockModal]);

  const handleTransactionPress = useCallback((transaction: any) => {
    setSelectedTransaction(transaction);
    setIsTransactionModalVisible(true);
  }, []);

  return {
    isTransactionModalVisible,
    setIsTransactionModalVisible,
    selectedTransaction,
    setSelectedTransaction,
    showWelcomeModal,
    setShowWelcomeModal,
    showHowItWorksModal,
    setShowHowItWorksModal,
    showWelcomeModalForUnauth,
    setShowWelcomeModalForUnauth,
    showClaimAccountModal,
    setShowClaimAccountModal,
    showNewPlanInfoModal,
    setShowNewPlanInfoModal,
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
    lastShownDepositId,
  };
}
