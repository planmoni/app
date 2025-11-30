import { View, Text, StyleSheet, useWindowDimensions, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/Button';
import SuccessAnimation from '@/components/SuccessAnimation';
import { useHaptics } from '@/hooks/useHaptics';

export default function PinSuccessScreen() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const haptics = useHaptics();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  const handleGoToDashboard = async () => {
    haptics.success();
    showToast('Transaction PIN set up successfully!', 'success');
    router.replace('/(tabs)');
  };

  const styles = createStyles(colors, isDark, isSmallScreen, width, insets);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SuccessAnimation />
        
        <Text style={styles.title}>PIN Set Up Complete!</Text>
        <Text style={styles.subtitle}>
          Your transaction PIN has been created successfully. You'll use this PIN to authorize transactions and sensitive operations.
        </Text>
        
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Security Features</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoText}>• Your PIN is stored securely on your device</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoText}>• Required for all transaction authorizations</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoText}>• Can be used with biometric authentication</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoText}>• Change or disable anytime in Settings</Text>
          </View>
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <Button
          title="Done"
          onPress={handleGoToDashboard}
          style={styles.dashboardButton}
          hapticType="success"
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean, screenWidth: number, insets: any) => {
  const contentPadding = isSmallScreen ? 16 : 24;
  const titleSize = isSmallScreen ? 24 : 28;
  const subtitleSize = isSmallScreen ? 14 : 16;
  const infoTitleSize = isSmallScreen ? 16 : 18;
  const infoTextSize = isSmallScreen ? 13 : 14;
  const buttonWidth = Math.min(screenWidth - contentPadding * 2, 400);
  const footerPadding = Math.max(insets.bottom, 16);
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: contentPadding,
      paddingBottom: contentPadding + 20,
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
      padding: isSmallScreen ? 16 : 20,
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
    footer: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: contentPadding,
      paddingTop: 16,
      paddingBottom: footerPadding,
    },
    dashboardButton: {
      width: '100%',
      maxWidth: buttonWidth,
      backgroundColor: colors.primary,
    },
  });
};