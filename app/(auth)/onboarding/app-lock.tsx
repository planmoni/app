import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, Fingerprint, Lock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import OnboardingProgress from '@/components/OnboardingProgress';

export default function AppLockScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const email = params.email as string;
  const password = params.password as string;
  const bvn = params.bvn as string;
  
  const styles = createStyles(colors);

  const handleContinue = () => {
    router.push({
      pathname: '/onboarding/create-pin',
      params: { 
        firstName,
        lastName,
        email,
        password,
        bvn
      }
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
      </View>

      <OnboardingProgress currentStep={6} totalSteps={9} />

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Secure your account</Text>
          <Text style={styles.subtitle}>Let's set up security for your account</Text>

          <View style={styles.formContainer}>
            <View style={styles.securityCard}>
              <View style={styles.securityHeader}>
                <View style={styles.securityIconContainer}>
                  <Lock size={24} color={colors.primary} />
                </View>
                <Text style={styles.securityTitle}>PIN Protection</Text>
              </View>
              <Text style={styles.securityDescription}>
                Create a PIN to secure your account and authorize transactions. This adds an extra layer of security.
              </Text>
            </View>
            
            <View style={styles.securityCard}>
              <View style={styles.securityHeader}>
                <View style={styles.securityIconContainer}>
                  <Fingerprint size={24} color={colors.primary} />
                </View>
                <Text style={styles.securityTitle}>Biometric Authentication</Text>
              </View>
              <Text style={styles.securityDescription}>
                You can also use your fingerprint or face ID to unlock the app and authorize transactions.
              </Text>
              <Pressable style={styles.enableBiometricsButton}>
                <Text style={styles.enableBiometricsText}>Enable Biometrics</Text>
              </Pressable>
            </View>
            
            <View style={styles.securityInfo}>
              <View style={styles.securityInfoIconContainer}>
                <Lock size={20} color={colors.primary} />
              </View>
              <Text style={styles.securityInfoText}>
                Your security is our priority. All data is encrypted and stored securely.
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
        icon={ArrowRight}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 60,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    gap: 24,
  },
  securityCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  securityIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  securityDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  enableBiometricsButton: {
    backgroundColor: colors.backgroundTertiary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  enableBiometricsText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.backgroundTertiary,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  securityInfoIconContainer: {
    marginTop: 2,
  },
  securityInfoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});