import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { X, Wallet, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useHaptics } from '@/hooks/useHaptics';
import SuccessAnimation from '@/components/SuccessAnimation';
import Button from '@/components/Button';

export default function TransferSuccessScreen() {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 380;
  
  const planId = params.planId as string;
  const planName = params.planName as string;
  const amountTransferred = parseFloat((params.amountTransferred as string) || '0');
  const newWalletBalance = parseFloat((params.newWalletBalance as string) || '0');

  // Trigger success haptic feedback when the screen loads
  useEffect(() => {
    const timer = setTimeout(() => {
      haptics.success();
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  const handleBackToDashboard = () => {
    haptics.lightImpact();
    router.replace('/(tabs)');
  };

  const handleClose = () => {
    haptics.lightImpact();
    router.replace('/(tabs)');
  };

  const styles = createStyles(colors, isDark, textSizeMultiplier, isSmallScreen);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Transfer Complete</Text>
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

        <Text style={styles.title}>Funds Transferred Successfully!</Text>
        <Text style={styles.subtitle}>
          Your funds have been moved to your wallet balance
        </Text>

        <View style={styles.summaryCard}>
          <View style={styles.iconContainer}>
            <Wallet size={48} color={colors.primary} />
          </View>

          {planName && (
            <Text style={styles.planName}>{planName}</Text>
          )}
          
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Amount Transferred</Text>
            <Text style={styles.amountValue}>
              ₦{amountTransferred.toLocaleString()}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.balanceSection}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>New Wallet Balance</Text>
              <Text style={styles.balanceAmount}>
                ₦{newWalletBalance.toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={styles.successBadge}>
            <CheckCircle2 size={16} color={colors.primary} />
            <Text style={styles.successText}>
              Funds are now available in your wallet
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What's Next?</Text>
          <Text style={styles.infoText}>
            You can now use these funds to create new plans, make deposits, or withdraw to your bank account.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button 
          title="Back to Dashboard"
          onPress={handleBackToDashboard}
          style={styles.dashboardButton}
          hapticType="medium"
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
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 400,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
  balanceSection: {
    width: '100%',
    marginBottom: 16,
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: colors.textSecondary,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: getScaledFontSize(isSmallScreen ? 20 : 24, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primary + '15',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  successText: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    color: colors.primary,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: isSmallScreen ? 16 : 20,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 400,
  },
  infoTitle: {
    fontSize: getScaledFontSize(isSmallScreen ? 16 : 18, textSizeMultiplier),
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: getScaledFontSize(isSmallScreen ? 13 : 14, textSizeMultiplier),
    color: colors.textSecondary,
    lineHeight: isSmallScreen ? 18 : 20,
  },
  footer: {
    padding: isSmallScreen ? 16 : 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  dashboardButton: {
    backgroundColor: colors.primary,
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
});

