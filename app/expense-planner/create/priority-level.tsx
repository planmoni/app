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

type Priority = 'high' | 'medium' | 'low';

export default function PriorityLevelScreen() {
  const { colors } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { saveLastStep } = useExpensePlans();
  const planId = params.planId as string | undefined;
  const planName = params.planName as string;
  const targetAmount = params.targetAmount as string;
  const budgetStructure = params.budgetStructure as 'fixed' | 'estimated';
  const subCategories = params.subCategories as string | undefined;
  const planTypesParam = params.planTypes as string | undefined;

  const [priority, setPriority] = useState<Priority | null>(
    (params.priority as Priority) || null
  );
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    if (!priority) {
      setError('Please select a priority level');
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/create/dates',
      params: {
        planName,
        targetAmount,
        budgetStructure,
        priority,
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
        <Text style={styles.headerTitle}>Priority Level</Text>
        <Pressable
          onPress={async () => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            if (planId) {
              await saveLastStep(planId, '/expense-planner/create/priority-level');
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
        <Text style={styles.sectionTitle}>Set priority</Text>
        <Text style={styles.sectionDescription}>
          Tell us how critical this spending is so we can guard the budget accordingly.
        </Text>
          <View style={styles.checkboxContainer}>
            {(['high', 'medium', 'low'] as Priority[]).map((pri) => (
              <Pressable
                key={pri}
                style={[
                  styles.checkbox,
                  priority === pri && styles.checkboxSelected,
                ]}
                onPress={() => {
                  haptics.selection();
                  setPriority(pri);
                  setError(null);
                }}
              >
                <View
                  style={[
                    styles.checkboxInner,
                    priority === pri && styles.checkboxInnerSelected,
                  ]}
                >
                  {priority === pri && (
                    <View style={styles.checkboxCheckmark} />
                  )}
                </View>
                <View style={styles.checkboxContent}>
                  <Text style={styles.checkboxLabel}>
                    {pri.charAt(0).toUpperCase() + pri.slice(1)}
                  </Text>
                  <Text style={styles.checkboxDescription}>
                    {pri === 'high' && 'Critical spend — protect this budget first'}
                    {pri === 'medium' && 'Important — keep on track after critical items'}
                    {pri === 'low' && 'Nice-to-have — flexible if cash is tight'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={!priority}
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
