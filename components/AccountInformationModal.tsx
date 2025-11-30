import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { CheckCircle, Copy, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useWindowDimensions } from 'react-native';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import * as Clipboard from 'expo-clipboard';

interface AccountInformationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function AccountInformationModal({
  isVisible,
  onClose,
  onDone,
}: AccountInformationModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const { session } = useAuth();
  const isSmallScreen = width < 380 || height < 700;
  const [accountInfo, setAccountInfo] = useState<{
    account_number: string;
    account_name: string;
    bank_name: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isVisible && session?.user?.id) {
      fetchAccountInfo();
    }
  }, [isVisible, session?.user?.id]);

  const fetchAccountInfo = async () => {
    if (!session?.user?.id) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('safehaven_accounts')
        .select('account_number, account_name, status')
        .eq('user_id', session.user.id)
        .eq('is_deleted', false)
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching account info:', error);
      } else if (data) {
        setAccountInfo({
          account_number: data.account_number,
          account_name: data.account_name || 'N/A',
          bank_name: 'SAFEHAVEN MFB',
        });
      }
    } catch (err) {
      console.error('Error fetching account info:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyAccountNumber = async () => {
    if (!accountInfo?.account_number) return;

    haptics.selection();
    try {
      await Clipboard.setStringAsync(accountInfo.account_number);
      showToast('Account number copied to clipboard', 'success');
    } catch (error) {
      console.error('Clipboard error:', error);
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleDone = () => {
    haptics.mediumImpact();
    // Close immediately - parent will handle state
    onDone();
  };

  const handleClose = () => {
    haptics.lightImpact();
    // Close immediately - parent will handle state
    onClose();
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isVisible) {
      // Reset loading state when modal closes
      setIsLoading(true);
    }
  }, [isVisible]);

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalContainer: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 24,
      padding: isSmallScreen ? 24 : 32,
      backgroundColor: colors.surface,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: isSmallScreen ? 24 : 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    message: {
      fontSize: isSmallScreen ? 14 : 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: isSmallScreen ? 20 : 24,
      marginBottom: 32,
    },
    accountDetailsContainer: {
      width: '100%',
      marginBottom: 32,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.accentBackground || colors.backgroundTertiary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    accountDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    accountDetailRowLast: {
      marginBottom: 0,
    },
    accountDetailLabel: {
      fontSize: isSmallScreen ? 13 : 14,
      fontWeight: '500',
      color: colors.textSecondary,
      flex: 1,
      marginRight: 1,
    },
    accountDetailValue: {
      fontSize: isSmallScreen ? 13 : 14,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'right',
    },
    accountNumberContainer: {
      flexDirection: 'row',
      gap: 8,
      flex: 1,
      justifyContent: 'flex-end',
    },
    accountNumber: {
      fontWeight: '600',
      color: colors.text,
      textAlign: 'left',
      letterSpacing: 1,
    },
    copyButton: {
      width: 20,
      height: 20,
      borderRadius: 18,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    doneButton: {
      width: '100%',
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 20,
      alignItems: 'center',
    },
    doneButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    loadingText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
    },
  });

  // Don't render anything if not visible to prevent blocking
  if (!isVisible) {
    return null;
  }

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <X size={20} color={colors.text} />
          </Pressable>

          <View style={styles.iconContainer}>
            <CheckCircle size={48} color={colors.primary} />
          </View>

          <Text style={styles.title}>Congratulations! 🎉</Text>
          
          <Text style={styles.message}>
            Your bank account has been created successfully. Here are your account details:
          </Text>

          {isLoading ? (
            <Text style={styles.loadingText}>Loading account details...</Text>
          ) : accountInfo ? (
            <View style={styles.accountDetailsContainer}>
              <View style={styles.accountDetailRow}>
                <Text style={styles.accountDetailLabel}>Account Number</Text>
                <View style={styles.accountNumberContainer}>
                  <Text style={styles.accountNumber}>{accountInfo.account_number}</Text>
                  <Pressable style={styles.copyButton} onPress={handleCopyAccountNumber}>
                    <Copy size={18} color={colors.primary} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.accountDetailRow}>
                <Text style={styles.accountDetailLabel}>Account Name</Text>
                <Text style={styles.accountDetailValue}>{accountInfo.account_name}</Text>
              </View>

              <View style={[styles.accountDetailRow, styles.accountDetailRowLast]}>
                <Text style={styles.accountDetailLabel}>Bank Name</Text>
                <Text style={styles.accountDetailValue}>{accountInfo.bank_name}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.loadingText}>Account information not available</Text>
          )}

          <Pressable style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

