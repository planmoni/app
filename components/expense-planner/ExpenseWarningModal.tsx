import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { AlertTriangle, X } from 'lucide-react-native';
import Button from '@/components/Button';

interface ExpenseWarningModalProps {
  isVisible: boolean;
  onClose: () => void;
  onProceed: () => void;
  expenseAmount: number;
  bucketName: string;
  overageAmount: number;
}

export default function ExpenseWarningModal({
  isVisible,
  onClose,
  onProceed,
  expenseAmount,
  bucketName,
  overageAmount,
}: ExpenseWarningModalProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={20} color={colors.textSecondary} />
          </Pressable>
          <View style={styles.iconContainer}>
            <AlertTriangle size={48} color="#EF4444" />
          </View>
          <Text style={styles.title}>Budget Limit Exceeded</Text>
          <Text style={styles.description}>
            This purchase of ₦{expenseAmount.toLocaleString()} will put your{' '}
            <Text style={styles.bucketName}>{bucketName}</Text> budget{' '}
            <Text style={styles.overageText}>₦{overageAmount.toLocaleString()}</Text> over its limit.
          </Text>
          <Text style={styles.question}>Do you wish to proceed?</Text>
          <View style={styles.buttonContainer}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={onClose}
              style={styles.cancelButton}
            />
            <Button
              title="Proceed Anyway"
              variant="primary"
              onPress={onProceed}
              style={styles.proceedButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modal: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 400,
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 1,
    },
    iconContainer: {
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    description: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 8,
    },
    bucketName: {
      fontWeight: '600',
      color: colors.text,
    },
    overageText: {
      fontWeight: '600',
      color: '#EF4444',
    },
    question: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.text,
      textAlign: 'center',
      fontWeight: '500',
      marginBottom: 24,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    cancelButton: {
      flex: 1,
    },
    proceedButton: {
      flex: 1,
    },
  });

