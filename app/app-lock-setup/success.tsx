import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import SuccessAnimation from '@/components/SuccessAnimation';

export default function AppLockSuccessScreen() {
  const { colors } = useTheme();
  
  const handleGoToDashboard = () => {
    router.replace('/(tabs)');
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <SuccessAnimation />
        
        <Text style={styles.title}>App Lock Enabled!</Text>
        <Text style={styles.subtitle}>
          Your app is now secured with a PIN. You'll need to enter this PIN each time you open the app.
        </Text>
        
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Security Tips</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoText}>• Never share your PIN with anyone</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoText}>• Use a PIN that's easy for you to remember but hard for others to guess</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoText}>• Change your PIN regularly for enhanced security</Text>
          </View>
        </View>
        
        <Button
          title="Back to Dashboard"
          onPress={handleGoToDashboard}
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
    fontSize: 18,
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
  dashboardButton: {
    width: '100%',
    backgroundColor: colors.primary,
  },
});