import React, { useEffect } from 'react';
import { View, Text, StyleSheet , Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppLock } from '@/contexts/AppLockContext';
import { useHaptics } from '@/hooks/useHaptics';
import FloatingButton from '@/components/FloatingButton';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';

export default function ForgotPinSuccessScreen() {
  const { colors, isDark } = useTheme();
  const { setPinResetMode } = useAppLock();
  const haptics = useHaptics();
  
  const styles = createStyles(colors, isDark);

  useEffect(() => {
    // Trigger success haptic when screen loads
    if (Platform.OS !== 'web') {
      haptics.success();
    }
  }, [haptics]);

  const handleContinue = () => {
    if (Platform.OS !== 'web') {
      haptics.mediumImpact();
    }
    
    // Disable pin reset mode since PIN reset is complete
    setPinResetMode(false);
    
    // Navigate back to settings or wherever the user came from
    router.replace('/settings/security-center');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingWrapper contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <View style={styles.successIconBackground}>
            <CheckCircle size={64} color="#FFFFFF" />
          </View>
        </View>

        <Text style={styles.title}>PIN Reset Complete</Text>
        <Text style={styles.description}>
          Your PIN has been successfully updated. You can now use your new PIN to access secure features.
        </Text>

        

        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Security Reminders</Text>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={styles.tipText}>Keep your PIN private and secure</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={styles.tipText}>Don't share your PIN with anyone</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>•</Text>
            <Text style={styles.tipText}>Consider enabling biometric authentication for added convenience</Text>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue to Security Center"
        onPress={handleContinue}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  successIconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  tipsContainer: {
    padding: 20,
    backgroundColor: colors.primary + '10',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipBullet: {
    fontSize: 16,
    color: colors.primary,
    marginRight: 12,
    marginTop: 2,
  },
  tipText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
}); 