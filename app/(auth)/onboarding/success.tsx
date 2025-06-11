import { View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import SuccessAnimation from '@/components/SuccessAnimation';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export default function SuccessScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const email = params.email as string;
  const password = params.password as string;
  
  const { signUp } = useAuth();

  // In a real app, you would register the user here
  useEffect(() => {
    const registerUser = async () => {
      try {
        await signUp(email, password, firstName, lastName);
        // Note: In a real app, you would handle the result and show errors if any
      } catch (error) {
        console.error('Registration error:', error);
      }
    };
    
    // For demo purposes, we're not actually registering the user
    // registerUser();
  }, []);

  const handleCreatePayout = () => {
    router.replace('/create-payout/amount');
  };

  const handleGoToDashboard = () => {
    router.replace('/(tabs)');
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <SuccessAnimation />
        
        <Text style={styles.title}>Account Created Successfully!</Text>
        <Text style={styles.subtitle}>
          Welcome to Planmoni, {firstName}! Your account has been set up and is ready to use.
        </Text>
        
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What's Next?</Text>
          <Text style={styles.cardText}>
            Start planning your finances by creating your first payout plan or explore your dashboard to see all features.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title="Create a Payout Plan"
          onPress={handleCreatePayout}
          style={styles.createButton}
        />
        <Button
          title="Go to Dashboard"
          onPress={handleGoToDashboard}
          variant="outline"
          style={styles.dashboardButton}
        />
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
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
  card: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    marginBottom: 32,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    gap: 16,
  },
  createButton: {
    backgroundColor: colors.primary,
  },
  dashboardButton: {
    borderColor: colors.border,
  },
});