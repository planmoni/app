import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Dimensions, Image } from 'react-native';
import { Building2, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import Button from '@/components/Button';
import { router } from 'expo-router';
import { getBankIconLogo } from '@/lib/bankIcons';

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
  const styles = createStyles(colors, isDark);

  const handleClose = () => {
    haptics.lightImpact();
    onClose();
  };

  const handleClaim = () => {
    haptics.mediumImpact();
    if (onClaim) {
      onClaim();
    } else {
      router.push('/add-funds');
    }
    onClose();
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
              title="Claim bank account"
              onPress={handleClaim}
              hapticType="medium"
              variant="primary"
            />
          </View>
        </Pressable>
      </Pressable>
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
});

