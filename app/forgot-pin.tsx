import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert , Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, Shield, Info } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useToast } from '@/contexts/ToastContext';
import FloatingButton from '@/components/FloatingButton';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import { supabase } from '@/lib/supabase';

export default function ForgotPinScreen() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const haptics = useHaptics();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const userEmail = session?.user?.email || '';
  const styles = createStyles(colors, isDark);

  const handleSendOTP = async () => {
    if (!userEmail) {
      Alert.alert('Error', 'No email found for your account. Please contact support.');
      return;
    }

    setIsLoading(true);
    
    try {
      if (Platform.OS !== 'web') {
        haptics.mediumImpact();
      }

      // Send OTP via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('send-otp-email', {
        body: {
          email: userEmail,
          purpose: 'pin_recovery'
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to send verification code');
      }

      showToast('Verification code sent to your email', 'success');
      
      if (Platform.OS !== 'web') {
        haptics.success();
      }

      // Navigate to OTP verification screen
      router.push({
        pathname: '/forgot-pin-otp',
        params: {
          email: userEmail
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send verification code';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      
      if (Platform.OS !== 'web') {
        haptics.error();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackPress = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBackPress} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Forgot PIN</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Shield size={48} color={colors.primary} />
        </View>

        <Text style={styles.title}>Reset Your PIN</Text>
        <Text style={styles.description}>
          We'll send a verification code to your registered email address to help you reset your PIN securely.
        </Text>

        <View style={styles.emailCard}>
          <View style={styles.emailIcon}>
            <Mail size={20} color={colors.primary} />
          </View>
          <View style={styles.emailInfo}>
            <Text style={styles.emailLabel}>Email Address</Text>
            <Text style={styles.emailValue}>{userEmail}</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Info size={16} color={colors.warning} />
          <Text style={styles.infoText}>
            For your security, PIN recovery requires email verification. The verification code will expire in 10 minutes.
          </Text>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title={isLoading ? "Sending..." : "Send Verification Code"}
        onPress={handleSendOTP}
        disabled={isLoading || !userEmail}
        loading={isLoading}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  emailInfo: {
    flex: 1,
  },
  emailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warning + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.warning + '30',
  },
  infoText: {
    fontSize: 14,
    color: colors.warning,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
}); 