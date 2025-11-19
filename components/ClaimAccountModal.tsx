import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Dimensions, Image } from 'react-native';
import { Building2, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKYCData } from '@/hooks/useKYCData';
import Button from '@/components/Button';
import { router } from 'expo-router';
import { getBankIconLogo } from '@/lib/bankIcons';
import { safeHavenService } from '@/lib/safehaven-service';
import SafeHavenOTPModal from '@/components/SafeHavenOTPModal';
import { supabase } from '@/lib/supabase';

interface ClaimAccountModalProps {
  isVisible: boolean;
  onClose: () => void;
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
  onClaim?: () => void;
}

const { width } = Dimensions.get('window');

export default function ClaimAccountModal({
  isVisible,
  onClose,
  accountNumber = '01177 XXXXX',
  bankName = 'SAFEHAVEN MFB',
  accountName = 'PLANMONI/YOUR NAME',
  onClaim
}: ClaimAccountModalProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const { session } = useAuth();
  const { formData } = useKYCData();
  const styles = createStyles(colors, isDark);
  
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [nin, setNin] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);
  const [existingAccount, setExistingAccount] = useState<{ account_number: string; account_name?: string; status?: string } | null>(null);

  // Get NIN and phone number from KYC data when modal opens
  useEffect(() => {
    if (isVisible && formData) {
      setNin(formData.nin || '');
      setPhoneNumber(formData.phone_number || session?.user?.user_metadata?.phone_number || '');
    }
  }, [isVisible, formData, session]);

  // Check for existing account when modal opens
  useEffect(() => {
    if (isVisible && session?.user?.id) {
      checkExistingAccount();
    }
  }, [isVisible, session?.user?.id]);

  const checkExistingAccount = async () => {
    if (!session?.user?.id) return;
    
    setIsCheckingAccount(true);
    try {
      // Check if account exists in database
      const { data, error } = await supabase
        .from('safehaven_accounts')
        .select('id, account_number, account_name, status, is_deleted')
        .eq('user_id', session.user.id)
        .eq('is_deleted', false)
        .not('account_number', 'ilike', 'PENDING_%')
        .maybeSingle();

      if (error) {
        console.error('[ClaimAccountModal] Error checking existing account:', error);
        setExistingAccount(null);
        return;
      }

      // Store account data if it exists and is valid
      if (data && data.account_number && !data.account_number.startsWith('PENDING_')) {
        console.log('[ClaimAccountModal] Existing account found:', data.account_number.substring(0, 5) + '****');
        setExistingAccount({
          account_number: data.account_number,
          account_name: data.account_name,
          status: data.status
        });
        
        showToast('Your account is already available!', 'success');
        
        // Close modal and navigate
        setTimeout(() => {
          onClose();
          if (onClaim) {
            onClaim();
          } else {
            router.push('/add-funds');
          }
        }, 500);
      } else {
        setExistingAccount(null);
      }
    } catch (error) {
      console.error('[ClaimAccountModal] Error checking account:', error);
      setExistingAccount(null);
    } finally {
      setIsCheckingAccount(false);
    }
  };

  const handleClose = () => {
    if (isCreatingAccount) return; // Prevent closing while creating account
    haptics.lightImpact();
    setShowOTPModal(false);
    setIdentityId(null);
    onClose();
  };

  const initializeNINVerification = async () => {
    if (!nin || !phoneNumber || !session?.user?.id) {
      showToast('NIN and phone number are required to create account', 'error');
      return;
    }

    try {
      setIsCreatingAccount(true);
      // Call verifyNINAndCreateAccount without OTP to initialize and get identityId
      const result = await safeHavenService.verifyNINAndCreateAccount(
        session.user.id,
        nin.trim(),
        phoneNumber.trim(),
        session.user.email || '',
        undefined  // otp - not provided for initialization
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to initialize NIN verification');
      }

      const identityId = result.data?.identityId;
      
      if (!identityId) {
        throw new Error('Identity ID not found in response');
      }

      setIdentityId(identityId);
      setShowOTPModal(true);
      showToast('OTP sent to phone number linked to your NIN', 'success');
    } catch (error) {
      console.error('Error initializing NIN verification:', error);
      showToast(error instanceof Error ? error.message : 'Failed to initialize account creation', 'error');
      setIsCreatingAccount(false);
    }
  };

  const handleOTPVerify = async (otp: string) => {
    if (!nin || !phoneNumber || !session?.user?.id || !identityId) {
      showToast('Missing required information for account creation', 'error');
      return;
    }

    try {
      setIsCreatingAccount(true);
      const result = await safeHavenService.verifyNINAndCreateAccount(
        session.user.id,
        nin.trim(),
        phoneNumber.trim(),
        session.user.email || '',
        otp,
        identityId
      );

      if (!result.success) {
        throw new Error(result.error || 'Account creation failed');
      }

      // Check if verification was successful
      // Account number might not be immediately available if account is created asynchronously
      if (result.data?.verified || result.data?.status === 'PENDING') {
        const accountNumber = result.data?.account_number;
        const status = result.data?.status || 'PENDING';
        const newIdentityId = result.data?.identityId || identityId;
        
        if (accountNumber) {
          showToast('Account created successfully!', 'success');
        } else if (status === 'PENDING') {
          showToast('Account creation is in progress. Your account will be available shortly.', 'info');
          
          // Don't start polling immediately - let the realtime subscription handle updates
          // Polling will be triggered by the realtime subscription if needed
        } else {
          showToast('Account creation initiated. Your account will be available shortly.', 'success');
        }
        
        // Close OTP modal first
        setShowOTPModal(false);
        
        // Wait a bit for modal to close before navigating
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setIsCreatingAccount(false);
        onClose();
        
        // Navigate to add-funds page after modal is fully closed
        setTimeout(() => {
          try {
            if (onClaim) {
              onClaim();
            } else {
              router.push('/add-funds');
            }
          } catch (error) {
            console.error('Navigation error:', error);
          }
        }, 500);
      } else {
        throw new Error('Account verification failed. Please try again.');
      }
    } catch (error) {
      console.error('Error creating account:', error);
      showToast(error instanceof Error ? error.message : 'Failed to create account', 'error');
      setIsCreatingAccount(false);
      // Don't close OTP modal on error - let user retry
    }
  };

  const handleOTPResend = async () => {
    await initializeNINVerification();
  };

  const handleClaim = async () => {
    haptics.mediumImpact();
    
    // First check if account already exists
    if (existingAccount?.account_number && !existingAccount.account_number.startsWith('PENDING_')) {
      showToast('Your account is already available!', 'success');
      onClose();
      if (onClaim) {
        onClaim();
      } else {
        router.push('/add-funds');
      }
      return;
    }

    // Check if we have required data
    if (!nin || !phoneNumber) {
      showToast('NIN and phone number are required. Please complete your KYC first.', 'error');
      return;
    }

    // Start the account creation process only if no account exists
    await initializeNINVerification();
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          {/* Close Button */}
          <Pressable 
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.content}>
            {/* Bank Icon */}
            <View style={styles.iconContainer}>
              {(() => {
                const bankIcon = getBankIconLogo(bankName || 'SAFEHAVEN MFB');
                
                if (bankIcon.logoSvg) {
                  // Handle SVG components
                  return React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
                    width: 32,
                    height: 32,
                    fill: "#FEF3C7"
                  });
                } else if (bankIcon.logo) {
                  // Handle PNG/image assets
                  return (
                    <Image
                      source={bankIcon.logo}
                      style={styles.bankIconImage}
                      resizeMode="contain"
                    />
                  );
                } else {
                  // Fallback to Building2 icon
                  return <Building2 size={32} color="#FEF3C7" />;
                }
              })()}
            </View>

            {/* Title */}
            <Text style={styles.title}>Claim your account number</Text>

            {/* Description */}
            <Text style={styles.description}>
              Get a bank account that you can transfer money to and have your money appear in your available balance, it's very fast and easy.
            </Text>

            {/* Account Details Fields */}
            <View style={styles.accountDetailsContainer}>
              <View style={styles.accountField}>
                <Text style={styles.accountFieldText}>{accountNumber}</Text>
              </View>
              <View style={styles.accountField}>
                <Text style={styles.accountFieldText}>{bankName}</Text>
              </View>
              <View style={styles.accountField}>
                <Text style={styles.accountFieldText}>{accountName}</Text>
              </View>
            </View>

            {/* Claim Button */}
            <Button
              title={
                isCheckingAccount 
                  ? 'Checking account...' 
                  : isCreatingAccount 
                    ? 'Creating account...' 
                    : existingAccount?.account_number && !existingAccount.account_number.startsWith('PENDING_')
                      ? 'View Account'
                      : 'Claim bank account'
              }
              onPress={handleClaim}
              hapticType="medium"
              variant="primary"
              disabled={
                isCreatingAccount || 
                isCheckingAccount || 
                (!existingAccount?.account_number && (!nin || !phoneNumber))
              }
              isLoading={(isCreatingAccount && !showOTPModal) || isCheckingAccount}
            />
            
            {!existingAccount?.account_number && (!nin || !phoneNumber) && (
              <Text style={styles.warningText}>
                Please complete Tier 1 verification (NIN and phone number) to create your account.
              </Text>
            )}
          </View>
        </Pressable>
      </Pressable>

      {/* OTP Modal for account creation */}
      <SafeHavenOTPModal
        isVisible={showOTPModal}
        onClose={() => {
          setShowOTPModal(false);
          setIsCreatingAccount(false);
        }}
        onVerify={handleOTPVerify}
        phoneNumber={phoneNumber}
        onResend={handleOTPResend}
      />
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: isDark ? colors.card : '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 20,
    maxHeight: '90%',
    width: '100%',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  content: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#C3F57E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  bankIconImage: {
    width: 32,
    height: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: isDark ? colors.text : '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    fontWeight: '400',
    color: isDark ? colors.textSecondary : '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
    lineHeight: 24,
  },
  accountDetailsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  accountField: {
    backgroundColor: isDark ? colors.cardBackground : '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    minHeight: 56,
    justifyContent: 'center',
  },
  accountFieldText: {
    fontSize: 16,
    fontWeight: '600',
    color: isDark ? colors.text : '#1F2937',
  },
  claimButton: {
    width: '100%',
    backgroundColor: '#1E3A8A',
    borderRadius: 12,
    paddingVertical: 16,
  },
  warningText: {
    fontSize: 12,
    color: isDark ? colors.textSecondary : '#F59E0B',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
});

