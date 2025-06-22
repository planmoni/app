import { View, Text, StyleSheet, Pressable, Switch, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, TriangleAlert as AlertTriangle, Clock, Info, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';
import { Platform } from 'react-native';

export default function RulesScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const [emergencyWithdrawal, setEmergencyWithdrawal] = useState(false);
  const { width, height } = useWindowDimensions();
  const haptics = useHaptics();

  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;

  // Set initial state based on params if available
  useEffect(() => {
    if (params.emergencyWithdrawal === 'true') {
      setEmergencyWithdrawal(true);
    }
  }, [params.emergencyWithdrawal]);

  const handleContinue = () => {
    if (Platform.OS !== 'web') {
      haptics.mediumImpact();
    }
    
    router.push({
      pathname: '/create-payout/review',
      params: {
        ...params,
        emergencyWithdrawal: emergencyWithdrawal.toString()
      }
    });
  };

  const handleToggleEmergencyWithdrawal = () => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    setEmergencyWithdrawal(!emergencyWithdrawal);
  };

  const styles = createStyles(colors, isDark, isSmallScreen);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            router.back();
          }} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Payout plan</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '80%' }]} />
        </View>
        <Text style={styles.stepText}>Step 4 of 5</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Set Manual Withdrawal Rules</Text>
          <Text style={styles.description}>
            Configure security settings for your vault
          </Text>

          <View style={styles.settingsContainer}>
            <View style={styles.setting}>
              <View style={styles.settingInfo}>
                <View style={styles.settingIcon}>
                  <AlertTriangle size={isSmallScreen ? 20 : 24} color="#F97316" />
                </View>
                <View style={styles.settingDetails}>
                  <Text style={styles.settingTitle}>Emergency Withdrawal</Text>
                  <Text style={styles.settingDescription}>
                    Allow emergency access to funds
                  </Text>
                </View>
              </View>
              <Switch
                value={emergencyWithdrawal}
                onValueChange={handleToggleEmergencyWithdrawal}
                trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
                thumbColor={emergencyWithdrawal ? '#1E3A8A' : colors.backgroundTertiary}
              />
            </View>

            {emergencyWithdrawal && (
              <View style={styles.emergencyOptionsContainer}>
                <Text style={styles.emergencyOptionsTitle}>Emergency Withdrawal Options</Text>
                <Text style={styles.emergencyOptionsDescription}>
                  When enabled, you'll have access to the following emergency withdrawal options:
                </Text>
                
                <View style={styles.optionItem}>
                  <View style={[styles.optionDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.optionText}>
                    <Text style={styles.optionHighlight}>Instant withdrawal:</Text> 12% processing fee
                  </Text>
                </View>
                
                <View style={styles.optionItem}>
                  <View style={[styles.optionDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.optionText}>
                    <Text style={styles.optionHighlight}>24-hour withdrawal:</Text> 6% processing fee
                  </Text>
                </View>
                
                <View style={styles.optionItem}>
                  <View style={[styles.optionDot, { backgroundColor: '#22C55E' }]} />
                  <Text style={styles.optionText}>
                    <Text style={styles.optionHighlight}>72-hour withdrawal:</Text> No processing fee
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.warning}>
              <View style={styles.warningIcon}>
                <AlertTriangle size={isSmallScreen ? 16 : 20} color="#EF4444" />
              </View>
              <Text style={styles.warningText}>
                Only turn emergency withdrawals option ON if you feel there might be situations where you might need to pull out your funds before payout expiry, when turned off, you will not be able to pull out your funds at any point until payout date is complete.
              </Text>
            </View>
          </View>
          
          {emergencyWithdrawal && (
            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Info size={20} color={colors.primary} />
              </View>
              <Text style={styles.infoText}>
                You can request an emergency withdrawal at any time from the payout details screen. The available options and fees will be shown at the time of withdrawal.
              </Text>
            </View>
          )}

          <View style={styles.securityInfo}>
            <View style={styles.securityIconContainer}>
              <Shield size={isSmallScreen ? 16 : 20} color={colors.primary} />
            </View>
            <Text style={styles.securityInfoText}>
              Your funds are securely locked in your vault until your scheduled payout dates. This helps maintain financial discipline and ensures your money lasts longer.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  progressContainer: {
    padding: 20,
    paddingBottom: 0,
    backgroundColor: colors.surface,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E3A8A',
    borderRadius: 2,
  },
  stepText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding for the floating button
  },
  content: {
    padding: 20,
    paddingTop: 0,
  },
  title: {
    fontSize: isSmallScreen ? 22 : 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  settingsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  setting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isSmallScreen ? 8 : 12,
    flex: 1,
  },
  settingIcon: {
    width: isSmallScreen ? 36 : 40,
    height: isSmallScreen ? 36 : 40,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingDetails: {
    gap: 4,
    flex: 1,
  },
  settingTitle: {
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '500',
    color: colors.text,
  },
  settingDescription: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
  },
  emergencyOptionsContainer: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#F97316',
  },
  emergencyOptionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emergencyOptionsDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  optionText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  optionHighlight: {
    fontWeight: '600',
    color: colors.text,
  },
  cooldownSetting: {
    flexDirection: 'row',
    gap: isSmallScreen ? 8 : 12,
    backgroundColor: colors.card,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#1E3A8A',
  },
  cooldownDetails: {
    gap: 4,
    flex: 1,
  },
  cooldownTitle: {
    fontSize: isSmallScreen ? 15 : 16,
    fontWeight: '500',
    color: colors.text,
  },
  cooldownValue: {
    fontSize: isSmallScreen ? 13 : 14,
    fontWeight: '500',
    color: '#1E3A8A',
  },
  cooldownDescription: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: isSmallScreen ? 8 : 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 12,
  },
  warningIcon: {
    marginTop: 2,
  },
  warningText: {
    flex: 1,
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.text,
    lineHeight: isSmallScreen ? 18 : 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    padding: 16,
    borderRadius: 12,
  },
  securityIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityInfoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});