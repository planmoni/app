import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Building2, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKYCData } from '@/hooks/useKYCData';
import { useKYCProgress } from '@/hooks/useKYCProgress';
import Button from '@/components/Button';
import { router } from 'expo-router';
import { getBankIconLogo } from '@/lib/bankIcons';
import { safeHavenService } from '@/lib/safehaven-service';
import SafeHavenOTPModal from '@/components/SafeHavenOTPModal';
import { useRequireAuth } from '@/hooks/useRequireAuth';

interface ClaimAccountModalProps {
  isVisible: boolean;
  onClose: () => void;
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
  onClaim?: () => void;
}

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
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const { formData } = useKYCData();
  const { checkTierCompletion } = useKYCProgress();
  const styles = createStyles(colors, isDark);
  
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [nin, setNin] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (!isVisible) {
      hasNavigatedRef.current = false;
      setShowOTPModal(false);
      setIdentityId(null);
      return;
    }

    if (formData) {
      setNin(formData.nin || '');
      setPhoneNumber(formData.phone_number || session?.user?.user_metadata?.phone_number || '');
    }
  }, [isVisible, formData, session]);
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
        
        if (accountNumber) {
          showToast('Account created successfully!', 'success');
        } else if (status === 'PENDING') {
          showToast('Account creation is in progress. Your account will be available shortly.', 'info');
        } else {
          showToast('Account creation initiated. Your account will be available shortly.', 'success');
        }
        
        // Close OTP modal first
        setShowOTPModal(false);
        setIsCreatingAccount(false);
        
        // Wait a bit for modal to close before navigating
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Close main modal
        onClose();
        
        // Navigate after modal is fully closed
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          setTimeout(() => {
            try {
              if (onClaim) {
                onClaim();
              } else {
                router.push('/add-funds');
              }
            } catch (error) {
              console.error('Navigation error:', error);
              hasNavigatedRef.current = false;
            }
          }, 200);
        }
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
    
    // Check if Tier 1 is complete
    const tierCompletion = checkTierCompletion();
    
    // If Tier 1 is not complete, navigate to Tier 1 KYC flow
    if (!tierCompletion.tier1) {
      onClose();
      router.push('/kyc/tier1');
      return;
    }

    if (!nin || !phoneNumber) {
      showToast('NIN and phone number are required. Please complete your KYC first.', 'error');
      return;
    }

    await initializeNINVerification();
  };

  const handleStartKYC = () => {
    haptics.mediumImpact();
    onClose();
    router.push('/kyc/tier1');
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

            {/* Check authentication and Tier 1 completion */}
            {(() => {
              // For unauthenticated users, show login button
              if (!isAuthenticated) {
                return (
                  <Button
                    title="Login to Claim your bank account"
                    onPress={() => {
                      haptics.mediumImpact();
                      onClose();
                      setTimeout(() => {
                        requireAuth(() => {}, '/(tabs)/index');
                      }, 300);
                    }}
                    hapticType="medium"
                    variant="primary"
                    disabled={false}
                  />
                );
              }
              
              const tierCompletion = checkTierCompletion();
              const isTier1Complete = tierCompletion.tier1;
              
              // If Tier 1 is not complete, show KYC buttons
              if (!isTier1Complete) {
                return (
                  <>
                    <Button
                      title="Complete Tier 1 Verification"
                      onPress={handleStartKYC}
                      hapticType="medium"
                      variant="primary"
                      disabled={false}
                    />
                    <Text style={styles.warningText}>
                      You need to complete Tier 1 verification (Liveness, BVN, and NIN) to create your account.
                    </Text>
                  </>
                );
              }
              
              // If Tier 1 is complete, show normal claim button
              return (
                <>
            <Button
              title={isCreatingAccount ? 'Creating account...' : 'Claim bank account'}
              onPress={handleClaim}
              hapticType="medium"
              variant="primary"
              disabled={isCreatingAccount || !nin || !phoneNumber}
              isLoading={isCreatingAccount && !showOTPModal}
            />
            
            {(!nin || !phoneNumber) && (
              <Text style={styles.warningText}>
                Please complete Tier 1 verification (NIN and phone number) to create your account.
              </Text>
            )}
                </>
              );
            })()}
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

