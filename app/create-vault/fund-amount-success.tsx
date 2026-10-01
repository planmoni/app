import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { X, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import SuccessAnimation from '@/components/SuccessAnimation';
import Button from '@/components/Button';

export default function FundAmountSuccessScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 380;
  
  const planId = params.planId as string;
  const planName = params.planName as string;
  const amountAdded = parseFloat((params.amountAdded as string) || '0');
  const newBalance = parseFloat((params.newBalance as string) || '0');
  const totalBudget = parseFloat((params.totalBudget as string) || '0');

  // Trigger success haptic feedback when the screen loads
  useEffect(() => {
    const timer = setTimeout(() => {
      haptics.success();
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  const handleViewPlan = () => {
    haptics.mediumImpact();
    router.replace(`/expense-planner/${planId}`);
  };

  const handleBackToDashboard = () => {
    haptics.lightImpact();
    router.replace('/(tabs)');
  };

  const handleClose = () => {
    haptics.lightImpact();
    router.replace(`/expense-planner/${planId}`);
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier, isSmallScreen);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Funds Added</Text>
        <Pressable 
          onPress={handleClose} 
          style={styles.closeButton}
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

        <Text style={styles.title}>Funds Added Successfully!</Text>
        <Text style={styles.subtitle}>
          Your funds have been added to your vault
        </Text>

        <View style={styles.summaryCard}>
          {planName && (
            <Text style={styles.planName}>{planName}</Text>
          )}
          
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Amount Added</Text>
            <Text style={styles.amountValue}>
              ₦{amountAdded.toLocaleString()}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>New Vault Balance</Text>
              <Text style={styles.balanceAmount}>
                ₦{newBalance.toLocaleString()}
              </Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Total Target</Text>
              <Text style={styles.balanceAmount}>
                ₦{totalBudget.toLocaleString()}
              </Text>
            </View>
          </View>

          {newBalance > totalBudget && (
            <View style={styles.overFundedBadge}>
              <CheckCircle2 size={16} color={colors.primary} />
              <Text style={styles.overFundedText}>
                Over-funded by ₦{(newBalance - totalBudget).toLocaleString()}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button 
          title="View Vault"
          onPress={handleViewPlan}
          style={styles.viewPlanButton}
          hapticType="medium"
        />
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
  isSmallScreen: boolean
) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: isSmallScreen ? 12 : 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: getScaledFontSize(isSmallScreen ? 16 : 18, textSizeMultiplier),
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
    padding: isSmallScreen ? 16 : 24,
    alignItems: 'center',
    paddingBottom: 32,
  },
  title: {
    fontSize: getScaledFontSize(isSmallScreen ? 22 : 26, textSizeMultiplier),
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
    marginBottom: 20,
    textAlign: 'center',
  },
  amountSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: getScaledFontSize(isSmallScreen ? 32 : 36, textSizeMultiplier),
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: colors.textSecondary,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: getScaledFontSize(isSmallScreen ? 18 : 20, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  overFundedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  overFundedText: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: colors.primary,
    fontWeight: '600',
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

