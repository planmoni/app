import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, RefreshCw } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useOnlineStatus } from '@/components/OnlineStatusProvider';
import OfflineNotice from '@/components/OfflineNotice';
import { useToast } from '@/contexts/ToastContext';
import { useHaptics } from '@/hooks/useHaptics';
import { Platform } from 'react-native';

export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { showToast } = useToast();
  const haptics = useHaptics();
  
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  const email = session?.user?.email || 'your email';

  // Check if email is already verified
  useEffect(() => {
    if (session?.user?.email_confirmed_at) {
      setEmailVerified(true);
      updateProfileEmailVerified();
    }
  }, [session?.user?.email_confirmed_at]);

  // Update profile to mark email as verified
  const updateProfileEmailVerified = async () => {
    if (!isOnline || !session?.user?.id) return;
    
    try {
      await supabase
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', session.user.id);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  // Timer for resend cooldown
  useEffect(() => {
    if (timer <= 0) return;
    
    const interval = setInterval(() => {
      setTimer(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timer]);

  const handleResendEmail = async () => {
    if (!isOnline || timer > 0) return;
    
    setIsResending(true);
    setError(null);
    setResendSuccess(false);
    
    try {
      if (Platform.OS !== 'web') {
        haptics.mediumImpact();
      }
      
      // Call the Supabase function to send OTP
      const { data, error: otpError } = await supabase.rpc('send_otp_email', {
        p_email: email.trim().toLowerCase()
      });
      
      if (otpError) {
        throw new Error(otpError.message || 'Failed to send verification code');
      }
      
      if (!data) {
        throw new Error('Failed to send verification code');
      }
      
      setResendSuccess(true);
      showToast('Verification code sent to your email', 'success');
      
      // Set cooldown timer
      setTimer(60);
      
      if (Platform.OS !== 'web') {
        haptics.success();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification email');
      showToast('Failed to send verification email', 'error');
      
      if (Platform.OS !== 'web') {
        haptics.error();
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyEmail = async () => {
    setIsLoading(true);
    
    try {
      if (Platform.OS !== 'web') {
        haptics.mediumImpact();
      }
      
      // Navigate to OTP verification screen
      router.push({
        pathname: '/verify-otp',
        params: { email }
      });
    } catch (error) {
      setError('An error occurred. Please try again.');
      showToast('An error occurred. Please try again.', 'error');
      
      if (Platform.OS !== 'web') {
        haptics.error();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    if (emailVerified) {
      // Update profile in database
      if (isOnline && session?.user?.id) {
        try {
          await supabase
            .from('profiles')
            .update({ email_verified: true })
            .eq('id', session.user.id);
        } catch (error) {
          console.error('Error updating profile:', error);
        }
      }
    }
    
    router.back();
  };

  const styles = createStyles(colors);

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
        <Text style={styles.headerTitle}>Verify Email</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Mail size={40} color={colors.primary} />
        </View>
        
        {emailVerified ? (
          <>
            <Text style={styles.title}>Email Verified!</Text>
            <Text style={styles.subtitle}>
              Your email address <Text style={styles.emailText}>{email}</Text> has been verified successfully.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Check your inbox</Text>
            <Text style={styles.subtitle}>
              We've sent a verification code to <Text style={styles.emailText}>{email}</Text>
            </Text>
          </>
        )}
        
        {!isOnline && (
          <OfflineNotice message="Email verification requires an internet connection" />
        )}
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        {resendSuccess && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>Verification code sent successfully!</Text>
          </View>
        )}
        
        {!emailVerified && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Next steps:</Text>
            <View style={styles.infoItem}>
              <Text style={styles.infoText}>1. Open the email from Planmoni</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoText}>2. Enter the verification code on the next screen</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoText}>3. Your email will be verified automatically</Text>
            </View>
          </View>
        )}
        
        <View style={styles.actions}>
          {!emailVerified && (
            <>
              <Button
                title={isResending ? "Sending..." : timer > 0 ? `Resend in ${timer}s` : "Resend Code"}
                onPress={handleResendEmail}
                disabled={isResending || timer > 0 || !isOnline}
                style={styles.resendButton}
                variant="outline"
                icon={RefreshCw}
              />
              
              <Button
                title="Enter Verification Code"
                onPress={handleVerifyEmail}
                style={styles.verifyButton}
                disabled={isLoading || !isOnline}
                isLoading={isLoading}
              />
            </>
          )}
          
          <Button
            title={emailVerified ? "Continue" : "I'll do this later"}
            onPress={handleContinue}
            style={emailVerified ? styles.continueButton : styles.laterButton}
            variant={emailVerified ? "primary" : "outline"}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.surface,
    borderRadius: 20,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  emailText: {
    fontWeight: '600',
    color: colors.text,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  successContainer: {
    backgroundColor: colors.successLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 12,
    marginBottom: 32,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  infoItem: {
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  resendButton: {
    marginBottom: 8,
  },
  verifyButton: {
    marginBottom: 8,
  },
  continueButton: {
    marginTop: 8,
  },
  laterButton: {
    marginTop: 8,
  },
});