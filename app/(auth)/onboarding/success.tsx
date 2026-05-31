import { View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Home as Home } from 'lucide-react-native';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import SuccessAnimation from '@/components/SuccessAnimation';
import { useEffect } from 'react';
import OnboardingProgress from '@/components/OnboardingProgress';
import { useToast } from '@/contexts/ToastContext';

export default function SuccessScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const email = params.email as string;
  const registrationComplete = params.registrationComplete === 'true';
  
  const haptics = useHaptics();
  const { showToast } = useToast();

  // Show welcome toast when component mounts
  useEffect(() => {
    if (registrationComplete) {
      const timer = setTimeout(() => {
        showToast(`Welcome to Planmoni, ${firstName}!`, 'success');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [registrationComplete, firstName]);

  const handleCreatePayout = () => {
    haptics.mediumImpact();
    router.replace({
      pathname: '/enable-notifications',
      params: { next: '/create-payout/amount' },
    });
  };

  const handleGoToDashboard = () => {
    haptics.lightImpact();
    router.replace({
      pathname: '/enable-notifications',
      params: { next: '/(tabs)' },
    });
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <OnboardingProgress currentStep={10} totalSteps={10} />
      
      <View style={styles.content}>
        {/* <SuccessAnimation /> */}
        
        <Text style={styles.title}>Welcome to Planmoni, {firstName}!</Text>
        <Text style={styles.subtitle}>
          Your account has been created successfully. You're all set to start planning your finances.
        </Text>
        
        <View style={styles.buttonContainer}>
          <Button
            title="Start a Payout Plan"
            onPress={handleCreatePayout}
            style={styles.createButton}
            icon={ArrowRight}
            hapticType="medium"
          />
          
          <Button
            title="Go to Dashboard"
            onPress={handleGoToDashboard}
            variant="outline"
            style={styles.dashboardButton}
            icon={Home}
            hapticType="light"
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  createButton: {
    backgroundColor: colors.primary,
  },
  dashboardButton: {
    borderColor: colors.border,
  },
});
