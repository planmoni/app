import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Wallet, CalendarDays, X, Vault } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';

export default function CreateNewScreen() {
  const { colors } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const styles = createStyles(colors, textSizeMultiplier);

  const goBack = () => {
    haptics.lightImpact();
    router.back();
  };

  const goHome = () => {
    haptics.lightImpact();
    router.replace('/(tabs)');
  };

  const startSpendingPlan = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/create/plan-details',
      params: {
        planTypes: JSON.stringify(['one_time']),
      },
    });
  };

  const startPayoutSchedule = () => {
    haptics.mediumImpact();
    router.push('/create-payout/amount');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New</Text>
        <Pressable onPress={goHome} style={styles.closeButton} hitSlop={8}>
          <X size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>What would you like to start?</Text>
        {/* <Text style={styles.subtitle}>Choose an option to start quickly.</Text> */}

       

        <Pressable style={styles.card} onPress={startPayoutSchedule}>
          <View style={styles.iconContainer}>
            <CalendarDays size={24} color={colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Payout</Text>
            <Text style={styles.cardSubtitle}>Setup daily, weekly, monthly or custom payout schedules.</Text>
          </View>
        </Pressable>
        <Pressable style={styles.card} onPress={startSpendingPlan}>
          <View style={styles.iconContainer}>
            <Vault size={24} color={colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Vault</Text>
            <Text style={styles.cardSubtitle}>Set up a vault to save for a specific goal.</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
    },
    content: {
      padding: 20,
      gap: 16,
    },
    title: {
      fontSize: getScaledFontSize(22, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 12,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 50,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.accentBackground,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardText: {
      flex: 1,
    },
    cardTitle: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
    },
    cardSubtitle: {
      fontSize: getScaledFontSize(13, textSizeMultiplier),
      color: colors.textSecondary,
      marginTop: 4,
    },
  });
