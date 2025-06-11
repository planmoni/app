import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, RefreshCw } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import { useAuth } from '@/contexts/AuthContext';

export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = session?.user?.email || 'your email';

  const handleResendEmail = async () => {
    setIsResending(true);
    setError(null);
    
    try {
      // In a real app, you would call your auth service to resend the verification email
      // For demo purposes, we'll just simulate a successful resend
      await new Promise(resolve => setTimeout(resolve, 1500));
      setResendSuccess(true);
    } catch (err) {
      setError('Failed to resend verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleContinue = () => {
    router.back();
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Verify Email</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Mail size={40} color={colors.primary} />
        </View>
        
        <Text style={styles.title}>Check your inbox</Text>
        <Text style={styles.subtitle}>
          We've sent a verification link to <Text style={styles.emailText}>{email}</Text>
        </Text>
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        {resendSuccess && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>Verification email resent successfully!</Text>
          </View>
        )}
        
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Next steps:</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoText}>1. Open the email from Planmoni</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoText}>2. Click on the verification link</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoText}>3. Return to the app after verification</Text>
          </View>
        </View>
        
        <View style={styles.actions}>
          <Button
            title={isResending ? "Sending..." : "Resend Email"}
            onPress={handleResendEmail}
            disabled={isResending}
            style={styles.resendButton}
            variant="outline"
            icon={RefreshCw}
          />
          
          <Button
            title="I've Verified My Email"
            onPress={handleContinue}
            style={styles.continueButton}
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
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  emailText: {
    fontWeight: '600',
    color: colors.text,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    width: '100%',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  successContainer: {
    backgroundColor: colors.successLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    width: '100%',
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    textAlign: 'center',
  },
  infoCard: {
    width: '100%',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  infoItem: {
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actions: {
    width: '100%',
    gap: 16,
  },
  resendButton: {
    borderColor: colors.border,
  },
  continueButton: {
    backgroundColor: colors.primary,
  },
});