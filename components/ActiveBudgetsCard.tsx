import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import { ArrowRight, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ActiveBudgetsCardProps {
  count: number;
  totalAmount: number;
  daysRemaining: number | null;
  onPress?: () => void;
}

const ACTIVE_BUDGETS_CARD_HASH_KEY = 'active_budgets_card_hash';
const ACTIVE_BUDGETS_CARD_DISMISSED_KEY = 'active_budgets_card_dismissed';

export default function ActiveBudgetsCard({ count, totalAmount, daysRemaining, onPress }: ActiveBudgetsCardProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const [shouldShow, setShouldShow] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const styles = useMemo(() => createStyles(colors, isDark, textSizeMultiplier), [colors, isDark, textSizeMultiplier]);

  const calculationHash = useMemo(() => {
    return `${count}-${totalAmount}-${daysRemaining ?? 'null'}`;
  }, [count, totalAmount, daysRemaining]);

  useEffect(() => {
    const load = async () => {
      if (count <= 0) {
        setShouldShow(false);
        return;
      }
      try {
        const lastHash = await AsyncStorage.getItem(ACTIVE_BUDGETS_CARD_HASH_KEY);
        const dismissedHash = await AsyncStorage.getItem(ACTIVE_BUDGETS_CARD_DISMISSED_KEY);

        if (lastHash !== calculationHash) {
          // new state, show card
          setShouldShow(true);
          setIsDismissed(false);
          await AsyncStorage.setItem(ACTIVE_BUDGETS_CARD_HASH_KEY, calculationHash);
        } else {
          // same state, only show if not dismissed
          const wasDismissed = dismissedHash === calculationHash;
          setIsDismissed(wasDismissed);
          setShouldShow(!wasDismissed);
        }
      } catch (err) {
        console.error('Error loading active budgets card state:', err);
        setShouldShow(count > 0);
      }
    };
    load();
  }, [count, calculationHash]);

  const handlePress = () => {
    if (onPress) {
      haptics.mediumImpact();
      onPress();
    }
  };

  const handleClose = async () => {
    haptics.lightImpact();
    setShouldShow(false);
    setIsDismissed(true);
    try {
      await AsyncStorage.setItem(ACTIVE_BUDGETS_CARD_DISMISSED_KEY, calculationHash);
    } catch (err) {
      console.error('Error saving active budgets card dismissed state:', err);
    }
  };

  const daysText = daysRemaining === null
    ? ''
    : daysRemaining === 0
      ? 'today'
      : daysRemaining === 1
        ? 'the next 1 day'
        : `the next ${daysRemaining} days`;

  const message = `You have ${count} spendable budget${count === 1 ? '' : 's'} of ₦${totalAmount.toLocaleString()}${daysText ? ` for ${daysText}` : ''}`;

  if (!shouldShow || count <= 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Pressable 
        style={styles.card}
        onPress={handlePress}
        disabled={!onPress}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Active budgets</Text>
          {onPress && (
            <ArrowRight size={18} color={colors.textSecondary} />
          )}
          <Pressable style={styles.closeButton} onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Text style={styles.message}>{message}</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) => StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: isDark ? colors.border : colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: getScaledFontSize(15, textSizeMultiplier),
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    marginLeft: 'auto',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  message: {
    fontSize: getScaledFontSize(14, textSizeMultiplier),
    lineHeight: Platform.OS === 'ios' ? 20 : 18,
    color: colors.textSecondary,
  },
});

