import { View, Text, StyleSheet, Pressable, Switch, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, TriangleAlert as AlertTriangle, Clock } from 'lucide-react-native';
import Button from '@/components/Button';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';

export default function RulesScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const [emergencyWithdrawal, setEmergencyWithdrawal] = useState(false);
  const { width } = useWindowDimensions();

  const handleContinue = () => {
    router.push({
      pathname: '/create-payout/review',
      params: {
        ...params,
        emergencyWithdrawal: emergencyWithdrawal.toString()
      }
    });
  };

  // Responsive styles based on screen width
  const isSmallScreen = width < 380;

  const styles = createStyles(colors, isSmallScreen);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
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
                onValueChange={setEmergencyWithdrawal}
                trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
                thumbColor={emergencyWithdrawal ? '#1E3A8A' : colors.backgroundTertiary}
              />
            </View>

            <View style={styles.cooldownSetting}>
              <View style={styles.settingIcon}>
                <Clock size={isSmallScreen ? 20 : 24} color="#1E3A8A" />
              </View>
              <View style={styles.cooldownDetails}>
                <Text style={styles.cooldownTitle}>Emergency Cooldown</Text>
                <Text style={styles.cooldownValue}>72 hours</Text>
                <Text style={styles.cooldownDescription}>
                  Waiting period for emergency withdrawals
                </Text>
              </View>
            </View>

            <View style={styles.warning}>
              <View style={styles.warningIcon}>
                <AlertTriangle size={isSmallScreen ? 16 : 20} color="#EF4444" />
              </View>
              <Text style={styles.warningText}>
                To enforce discipline, emergency withdrawals will hold funds for 72 hours and also attract high fees
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isSmallScreen: boolean) => StyleSheet.create({
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
});