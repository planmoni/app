import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Building2, Copy, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import { getBankIconLogo } from '@/lib/bankIcons';
import { Image } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';

interface AccountDisplayCardProps {
  accountNumber: string;
  bankName?: string;
  accountName?: string;
  onViewAccount?: () => void;
}

export default function AccountDisplayCard({
  accountNumber,
  bankName = 'SAFEHAVEN MFB',
  accountName,
  onViewAccount
}: AccountDisplayCardProps) {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginTop: 10,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#C3F57E',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    bankIconImage: {
      width: 24,
      height: 24,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    bankName: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    accountSection: {
      marginBottom: 16,
    },
    label: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    accountNumberContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.accentBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    accountNumberText: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: 2,
      flex: 1,
    },
    copyButton: {
      padding: 8,
      marginLeft: 12,
    },
    accountNameContainer: {
      backgroundColor: colors.accentBackground,
      borderRadius: 12,
      padding: 16,
    },
    accountNameText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    actionButton: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingVertical: 14,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });

  const handleCopyAccountNumber = async () => {
    try {
      await Clipboard.setStringAsync(accountNumber);
      setCopied(true);
      haptics.lightImpact();
      showToast('Account number copied!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying account number:', error);
      showToast('Failed to copy account number', 'error');
    }
  };

  const handleViewAccount = () => {
    haptics.mediumImpact();
    if (onViewAccount) {
      onViewAccount();
    } else {
      router.push('/add-funds');
    }
  };

  const bankIcon = getBankIconLogo(bankName);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          {(() => {
            if (bankIcon.logoSvg) {
              return React.createElement(bankIcon.logoSvg.default || bankIcon.logoSvg, {
                width: 24,
                height: 24,
                fill: "#FEF3C7"
              });
            } else if (bankIcon.logo) {
              return (
                <Image
                  source={bankIcon.logo}
                  style={styles.bankIconImage}
                  resizeMode="contain"
                />
              );
            } else {
              return <Building2 size={24} color="#FEF3C7" />;
            }
          })()}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Your Account</Text>
          <Text style={styles.bankName}>{bankName}</Text>
        </View>
      </View>

      <View style={styles.accountSection}>
        <Text style={styles.label}>Account Number</Text>
        <View style={styles.accountNumberContainer}>
          <Text style={styles.accountNumberText}>{accountNumber}</Text>
          <Pressable
            style={styles.copyButton}
            onPress={handleCopyAccountNumber}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {copied ? (
              <Check size={20} color={colors.primary} />
            ) : (
              <Copy size={20} color={colors.textSecondary} />
            )}
          </Pressable>
        </View>
      </View>

      {accountName && (
        <View style={styles.accountSection}>
          <Text style={styles.label}>Account Name</Text>
          <View style={styles.accountNameContainer}>
            <Text style={styles.accountNameText}>{accountName}</Text>
          </View>
        </View>
      )}

      <Pressable style={styles.actionButton} onPress={handleViewAccount}>
        <Text style={styles.actionButtonText}>View Account Details</Text>
      </Pressable>
    </View>
  );
}

