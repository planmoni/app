import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { useExpensePlans } from '@/hooks/useExpensePlans';

export default function BudgetStructureScreen() {
  const { colors } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { saveLastStep } = useExpensePlans();
  const planId = params.planId as string | undefined;
  const planName = params.planName as string;
  const targetAmount = params.targetAmount as string;
  const subCategories = params.subCategories as string | undefined;
  const planTypesParam = params.planTypes as string | undefined;

  const [budgetStructure, setBudgetStructure] = useState<'fixed' | 'estimated' | null>(
    (params.budgetStructure as 'fixed' | 'estimated') || null
  );
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    if (!budgetStructure) {
      setError('Please select a budget structure');
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/create/priority-level',
      params: {
        planName,
        targetAmount,
        budgetStructure,
        planId,
        ...(subCategories && { subCategories }),
        ...(planTypesParam && { planTypes: planTypesParam }),
      },
    });
  };

  const styles = createStyles(colors, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Budget Structure</Text>
        <Pressable
          onPress={async () => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            if (planId) {
              await saveLastStep(planId, '/expense-planner/create/budget-structure');
            }
            router.push('/(tabs)');
          }}
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose budget structure</Text>
          <Text style={styles.sectionDescription}>
            Decide how tight or flexible this spending budget should be.
          </Text>
          <View style={styles.checkboxContainer}>
            <Pressable
              style={[
                styles.checkbox,
                budgetStructure === 'fixed' && styles.checkboxSelected,
              ]}
              onPress={() => {
                haptics.selection();
                setBudgetStructure('fixed');
                setError(null);
              }}
            >
              <View
                style={[
                  styles.checkboxInner,
                  budgetStructure === 'fixed' && styles.checkboxInnerSelected,
                ]}
              >
                {budgetStructure === 'fixed' && (
                  <View style={styles.checkboxCheckmark} />
                )}
              </View>
              <View style={styles.checkboxContent}>
                <Text style={styles.checkboxLabel}>Fixed</Text>
                <Text style={styles.checkboxDescription}>
                  A set spend cap that doesn't change
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.checkbox,
                budgetStructure === 'estimated' && styles.checkboxSelected,
              ]}
              onPress={() => {
                haptics.selection();
                setBudgetStructure('estimated');
                setError(null);
              }}
            >
              <View
                style={[
                  styles.checkboxInner,
                  budgetStructure === 'estimated' && styles.checkboxInnerSelected,
                ]}
              >
                {budgetStructure === 'estimated' && (
                  <View style={styles.checkboxCheckmark} />
                )}
              </View>
              <View style={styles.checkboxContent}>
                <Text style={styles.checkboxLabel}>Estimated</Text>
                <Text style={styles.checkboxDescription}>
                  A flexible spend cap you may adjust
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={!budgetStructure}
        hapticType="medium"
      />
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
    cancelButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 20,
      paddingBottom: 100,
    },
    errorContainer: {
      backgroundColor: colors.errorLight || '#FEE2E2',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.error || '#DC2626',
    },
    errorText: {
      color: colors.error || '#DC2626',
      fontSize: getScaledFontSize(14, textSizeMultiplier),
    },
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: getScaledFontSize(20, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    sectionDescription: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 24,
    },
    checkboxContainer: {
      gap: 12,
    },
    checkbox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
    },
    checkboxSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    checkboxInner: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    checkboxInnerSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    checkboxCheckmark: {
      width: 8,
      height: 8,
      borderRadius: 2,
      backgroundColor: '#fff',
    },
    checkboxContent: {
      flex: 1,
    },
    checkboxLabel: {
      fontSize: getScaledFontSize(16, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    checkboxDescription: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
    },
  });
