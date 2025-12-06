import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Lock, Save } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';

export default function FundingChoiceScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  
  const totalBudget = params.totalBudget as string;
  const budgetStructure = params.budgetStructure as string;
  const buckets = params.buckets ? JSON.parse(params.buckets as string) : [];
  const planName = params.planName as string;
  const startDate = params.startDate as string;
  const endDate = params.endDate as string;

  const handleFundBudget = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/create/fund-budget',
      params: {
        totalBudget,
        budgetStructure,
        buckets: JSON.stringify(buckets),
        planName: planName || '',
        startDate,
        endDate,
      },
    });
  };

  const handleSaveForLater = async () => {
    haptics.mediumImpact();
    // Navigate to name expense screen with funding skipped
    router.push({
      pathname: '/expense-planner/create/name-expense',
      params: {
        totalBudget,
        budgetStructure,
        buckets: JSON.stringify(buckets),
        planName: planName || '',
        startDate,
        endDate,
        skipFunding: 'true',
      },
    });
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Funding Options</Text>
        <Pressable 
          onPress={() => {
            haptics.selection();
            router.replace('/(tabs)');
          }} 
          style={styles.closeButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>How would you like to proceed?</Text>
        <Text style={styles.description}>
          You can lock funds now to ensure they're available when needed, or save the plan for later.
        </Text>

        <View style={styles.optionsContainer}>
          <Pressable 
            style={styles.optionCard}
            onPress={handleFundBudget}
          >
            <View style={styles.optionIconContainer}>
              <Lock size={32} color={colors.primary} />
            </View>
            <Text style={styles.optionTitle}>Fund Budget</Text>
            <Text style={styles.optionDescription}>
              Lock funds from your balance that will be accessible during your budget period
            </Text>
          </Pressable>

          <Pressable 
            style={styles.optionCard}
            onPress={handleSaveForLater}
          >
            <View style={styles.optionIconContainer}>
              <Save size={32} color={colors.textSecondary} />
            </View>
            <Text style={styles.optionTitle}>Save for Later</Text>
            <Text style={styles.optionDescription}>
              Create the plan without locking funds. You can fund it later when ready.
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
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
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    headerTitle: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 100,
    },
    title: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    description: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 32,
      lineHeight: 20,
    },
    optionsContainer: {
      gap: 20,
    },
    optionCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    optionIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    optionTitle: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    optionDescription: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      lineHeight: 20,
      textAlign: 'center',
    },
  });

