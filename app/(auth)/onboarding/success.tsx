import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Chrome as Home, LogIn } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import SuccessAnimation from '@/components/SuccessAnimation';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import OnboardingProgress from '@/components/OnboardingProgress';

export default function SuccessScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const email = params.email as string;
  const password = params.password as string;
  const referralCode = params.referralCode as string;
  
  const { signUp } = useAuth();
  const [isRegistering, setIsRegistering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUserAlreadyExists, setIsUserAlreadyExists] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  useEffect(() => {
    const registerUser = async () => {
      try {
        await signUp(email, password, firstName, lastName, referralCode);
        setIsRegistering(false);
        setRegistrationComplete(true);
        
        // Add a delay before navigation to allow the success animation to be seen
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 2000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create account';
        
        // Check if the error is specifically about user already existing
        if (errorMessage.includes('user_already_exists') || 
            errorMessage.includes('User already registered') ||
            errorMessage.includes('already registered')) {
          setError('This email is already registered. Please sign in or use a different email.');
          setIsUserAlreadyExists(true);
          
          // Add a delay before redirecting to login
          setTimeout(() => {
            router.replace('/(auth)/login');
          }, 2000);
        } else {
          setError(errorMessage);
        }
        setIsRegistering(false);
      }
    };

    registerUser();
  }, []);

  const handleCreatePayout = () => {
    router.replace('/create-payout/amount');
  };

  const handleGoToDashboard = () => {
    router.replace('/(tabs)');
  };

  const handleGoToSignIn = () => {
    router.replace('/(auth)/login');
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <OnboardingProgress currentStep={10} totalSteps={10} />
      
      <View style={styles.content}>
        <SuccessAnimation />
        
        <Text style={styles.title}>
          {isUserAlreadyExists ? 'Account Already Exists' : 'Welcome to Planmoni!'}
        </Text>
        <Text style={styles.subtitle}>
          {isUserAlreadyExists 
            ? 'It looks like you already have an account with us. Please sign in to continue.'
            : 'Your account has been created successfully. You\'re all set to start planning your finances.'
          }
        </Text>
        
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        <View style={styles.buttonContainer}>
          {isUserAlreadyExists ? (
            <Button
              title="Go to Sign In"
              onPress={handleGoToSignIn}
              style={styles.signInButton}
              icon={LogIn}
              disabled={isRegistering}
            />
          ) : (
            <>
              <Button
                title="Start a Payout Plan"
                onPress={handleCreatePayout}
                style={styles.createButton}
                icon={ArrowRight}
                disabled={isRegistering || !registrationComplete}
              />
              
              <Button
                title="Go to Dashboard"
                onPress={handleGoToDashboard}
                variant="outline"
                style={styles.dashboardButton}
                icon={Home}
                disabled={isRegistering || !registrationComplete}
              />
            </>
          )}
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
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
  buttonContainer: {
    width: '100%',
    gap: 16,
  },
  createButton: {
    backgroundColor: colors.primary,
  },
  dashboardButton: {
    borderColor: colors.border,
  },
  signInButton: {
    backgroundColor: colors.primary,
  },
});