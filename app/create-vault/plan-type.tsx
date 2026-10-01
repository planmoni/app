import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, X, Repeat, Target, Calendar, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { Platform } from 'react-native';
import { PLAN_TYPE_INFO, PlanType } from '@/lib/planTypeMapping';

export default function PlanTypeScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const planId = params.planId as string | undefined;

  const [selectedPlanType, setSelectedPlanType] = useState<PlanType | null>(null);

  const planTypes: PlanType[] = ['recurring', 'one_time', 'long_term'];

  const handlePlanTypeSelect = (planType: PlanType) => {
    haptics.selection();
    setSelectedPlanType(planType);
  };

  const handleContinue = () => {
    if (!selectedPlanType) {
      haptics.notification();
      return;
    }

    haptics.mediumImpact();
    
    // Navigate to plan-details page with selected plan type
    router.push({
      pathname: '/create-vault/plan-details',
      params: {
        planTypes: JSON.stringify([selectedPlanType]),
        ...(planId && { planId }),
      },
    });
  };

  const getPlanTypeIcon = (planType: PlanType) => {
    switch (planType) {
      case 'recurring':
        return Repeat;
      case 'one_time':
        return Target;
      case 'long_term':
        return Calendar;
    }
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
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
        <Text style={styles.headerTitle}>Budget type</Text>
        <Pressable
          onPress={() => {
            haptics.lightImpact();
            router.dismissTo('/(tabs)');
          }}
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {planTypes.map((planType) => {
            const info = PLAN_TYPE_INFO[planType];
            const Icon = getPlanTypeIcon(planType);
            const isSelected = selectedPlanType === planType;

            return (
              <Pressable
                key={planType}
                onPress={() => handlePlanTypeSelect(planType)}
                style={[
                  styles.planTypeCard,
                  isSelected && styles.planTypeCardSelected,
                ]}
              >
                <View style={styles.planTypeContent}>
                  <View style={[
                    styles.planTypeIconContainer,
                    isSelected && styles.planTypeIconContainerSelected,
                  ]}>
                    <Icon size={28} color={isSelected ? colors.primary : colors.text} />
                  </View>
                  <View style={styles.planTypeInfo}>
                    <Text style={[
                      styles.planTypeLabel,
                      isSelected && styles.planTypeLabelSelected,
                    ]}>
                      {info.label}
                    </Text>
                    <Text style={styles.planTypeDescription}>{info.description}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkIcon}>
                      <Check size={20} color={colors.primary} />
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={!selectedPlanType}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
    scrollContent: {
      paddingBottom: 100,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 20,
    },
    title: {
      fontSize: getScaledFontSize(24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    planTypeCard: {
      marginBottom: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    planTypeCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '08',
    },
    planTypeContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
    },
    planTypeIconContainer: {
      width: 64,
      height: 64,
      borderRadius: 16,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    planTypeIconContainerSelected: {
      backgroundColor: colors.primary + '15',
      borderColor: colors.primary + '40',
    },
    planTypeInfo: {
      flex: 1,
    },
    planTypeLabel: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    planTypeLabelSelected: {
      color: colors.primary,
    },
    planTypeDescription: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      lineHeight: 20,
    },
    checkIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 12,
    },
  });
