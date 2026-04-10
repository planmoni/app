import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';

type QuickActionsProps = {
  onCreateNewVault: () => void;
  onCollectPayments: () => void;
  onCreatePayoutPlan: () => void;
};

export default function QuickActions({
  onCreateNewVault,
  onCollectPayments,
  onCreatePayoutPlan,
}: QuickActionsProps) {
  const { colors } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const styles = createStyles(colors, textSizeMultiplier);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <Pressable style={styles.actionButton} onPress={onCreateNewVault}>
          <Text style={styles.actionText}>Create New Vault</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={onCollectPayments}>
          <Text style={styles.actionText}>Collect Payments</Text>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={onCreatePayoutPlan}>
          <Text style={styles.actionText}>Create Payout Plan</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: any, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      marginBottom: 20,
    },
    title: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 12, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    actionButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 72,
      paddingHorizontal: 10,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    actionText: {
      fontSize: getScaledFontSize(Platform.OS === 'ios' ? 12 : 11, textSizeMultiplier),
      fontWeight: '500',
      color: colors.text,
      textAlign: 'center',
    },
  });
