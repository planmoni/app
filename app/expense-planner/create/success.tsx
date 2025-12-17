import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import SuccessAnimation from '@/components/SuccessAnimation';
import Button from '@/components/Button';

export default function ExpensePlanSuccessScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  
  const planName = params.planName as string;
  const totalBudget = params.totalBudget as string;
  const planId = params.planId as string;
  const fundingMethod = params.fundingMethod as 'auto' | 'manual' | undefined;

  // Trigger success haptic feedback when the screen loads
  useEffect(() => {
    const timer = setTimeout(() => {
      haptics.success();
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  const formatDateForDisplay = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const handleFundPlan = () => {
    haptics.mediumImpact();
    router.push({
      pathname: '/expense-planner/create/fund-plan',
      params: {
        planId,
        planName,
        totalBudget,
      },
    });
  };

  const handleViewPlan = () => {
    haptics.mediumImpact();
    router.replace(`/expense-planner/${planId}`);
  };

  const handleBackToDashboard = () => {
    haptics.lightImpact();
    router.replace('/(tabs)');
  };

  const { width: screenWidth } = Dimensions.get('window');
  const isSmallScreen = screenWidth < 375;
  const isMediumScreen = screenWidth >= 375 && screenWidth < 768;

  const styles = createStyles(colors, isDark, textSizeMultiplier, isSmallScreen, isMediumScreen);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Plan Created</Text>
        <Pressable 
          onPress={() => {
            haptics.lightImpact();
            router.replace('/(tabs)');
          }} 
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SuccessAnimation />

        <Text style={styles.title}>Budget Plan Created!</Text>
        <Text style={styles.subtitle}>Your budget plan has been set up successfully</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.planName}>{planName || 'Untitled Plan'}</Text>
          <Text style={styles.amount}>₦{parseFloat(totalBudget || '0').toLocaleString()}</Text>
          <Text style={styles.description}>Total Budget</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {fundingMethod === 'auto' ? (
          <Button 
            title="View Plan"
            onPress={handleViewPlan}
            style={styles.viewPlanButton}
            hapticType="medium"
          />
        ) : (
        <Button 
          title="Fund Plan"
          onPress={handleFundPlan}
          style={styles.viewPlanButton}
          hapticType="medium"
        />
        )}
        <Button 
          title="Back to Dashboard"
          onPress={handleBackToDashboard}
          variant="outline"
          style={styles.dashboardButton}
          hapticType="light"
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (
  colors: any,
  isDark: boolean,
  textSizeMultiplier: number,
  isSmallScreen: boolean,
  isMediumScreen: boolean
) => StyleSheet.create({
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
  headerSpacer: {
    width: 40,
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: isSmallScreen ? 16 : 24,
    alignItems: 'center',
    paddingBottom: 32,
  },
  title: {
    fontSize: getScaledFontSize(isSmallScreen ? 20 : isMediumScreen ? 24 : 28, textSizeMultiplier),
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  subtitle: {
    fontSize: getScaledFontSize(isSmallScreen ? 14 : 16, textSizeMultiplier),
    color: colors.textSecondary,
    marginBottom: isSmallScreen ? 24 : 32,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: isSmallScreen ? 20 : 22,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: isSmallScreen ? 20 : 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 400,
  },
  planName: {
    fontSize: getScaledFontSize(isSmallScreen ? 18 : 20, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  amount: {
    fontSize: getScaledFontSize(isSmallScreen ? 28 : isMediumScreen ? 32 : 36, textSizeMultiplier),
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: getScaledFontSize(isSmallScreen ? 14 : 16, textSizeMultiplier),
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    padding: isSmallScreen ? 16 : 24,
    gap: isSmallScreen ? 8 : 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  viewPlanButton: {
    backgroundColor: colors.primary,
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  dashboardButton: {
    borderColor: colors.border,
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
});

