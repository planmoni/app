import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/Button';
import SuccessAnimation from '@/components/SuccessAnimation';
import { useHaptics } from '@/hooks/useHaptics';

export default function AppLockSuccessScreen() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { showToast } = useToast();
  const haptics = useHaptics();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  const handleGoToDashboard = () => {
    haptics.success();
    showToast('App lock enabled successfully!', 'success');
    router.replace('/(tabs)');
  };

  const styles = createStyles(colors, isDark, isSmallScreen, width);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <SuccessAnimation />
        
        <Text style={styles.title}>App Lock Enabled!</Text>
        <Text style={styles.subtitle}>
          Your app is now secured with a PIN. You'll need to enter this PIN each time you open the app or after 5 minutes of inactivity.
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
          <View style={styles.infoItem}>
            <Text style={styles.infoText}>• Your app will automatically lock after 5 minutes of inactivity</Text>
          </View>
        </View>
        
        <Button
          title="Back to Dashboard"
          onPress={handleGoToDashboard}
          style={styles.dashboardButton}
          hapticType="success"
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean, screenWidth: number) => {
  // Calculate responsive sizes
  const contentPadding = isSmallScreen ? 16 : 24;
  const titleSize = isSmallScreen ? 24 : 28;
  const subtitleSize = isSmallScreen ? 14 : 16;
  const infoTitleSize = isSmallScreen ? 16 : 18;
  const infoTextSize = isSmallScreen ? 13 : 14;
  const buttonWidth = Math.min(screenWidth - contentPadding * 2, 400);
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: contentPadding,
    },
    title: {
      fontSize: titleSize,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: subtitleSize,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: subtitleSize * 1.5,
    },
    infoCard: {
      width: '100%',
      maxWidth: buttonWidth,
      backgroundColor: isDark ? colors.backgroundSecondary : colors.backgroundTertiary,
      borderRadius: 16,
      padding: 20,
      marginBottom: 32,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoTitle: {
      fontSize: infoTitleSize,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    infoItem: {
      marginBottom: 12,
    },
    infoText: {
      fontSize: infoTextSize,
      color: colors.textSecondary,
      lineHeight: infoTextSize * 1.5,
    },
    dashboardButton: {
      width: '100%',
      maxWidth: buttonWidth,
      backgroundColor: colors.primary,
    },
  });
};