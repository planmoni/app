import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import PinDisplay from '@/components/PinDisplay';
import PinKeypad from '@/components/PinKeypad';
import { usePin } from '@/contexts/PinContext';
import { useHaptics } from '@/hooks/useHaptics';
import FloatingButton from '@/components/FloatingButton';

export default function ConfirmPinScreen() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { showToast } = useToast();
  const { setupPin } = usePin();
  const haptics = useHaptics();
  
  const params = useLocalSearchParams();
  const originalPin = params.pin as string;
  
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;

  useEffect(() => {
    setIsButtonEnabled(confirmPin.length === 4);
  }, [confirmPin]);

  const handlePinChange = (digit: string) => {
    if (confirmPin.length < 4) {
      haptics.selection();
      setConfirmPin(prev => prev + digit);
      setError(null);
    }
  };

  const handlePinDelete = () => {
    haptics.lightImpact();
    setConfirmPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleContinue = async () => {
    if (confirmPin.length !== 4) {
      setError('Please enter your 4-digit PIN');
      haptics.error();
      return;
    }

    if (confirmPin !== originalPin) {
      setError('PINs do not match. Please try again.');
      haptics.error();
      setConfirmPin('');
      return;
    }

    setIsLoading(true);
    try {
      const success = await setupPin(originalPin);
      if (success) {
        haptics.success();
        router.push('/pin-setup/success');
      } else {
        setError('Failed to save PIN. Please try again.');
        haptics.error();
        setConfirmPin('');
      }
    } catch (error) {
      console.error('Error saving PIN:', error);
      setError('Failed to save PIN. Please try again.');
      haptics.error();
      setConfirmPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackPress = () => {
    haptics.lightImpact();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const styles = createStyles(colors, isDark, isSmallScreen, width);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={isLoading ? () => {} : handleBackPress} style={styles.backButton} disabled={isLoading}>
          <ArrowLeft size={isSmallScreen ? 20 : 24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Set up PIN</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer} disableScrollView={true}>
        <View style={styles.content}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Confirm your PIN</Text>
            <Text style={styles.subtitle}>Enter your PIN again to confirm</Text>
          </View>

          <View style={styles.formContainer}>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <View style={styles.pinContainer}>
              <PinDisplay 
                length={4}
                value={confirmPin}
              />
              
              <PinKeypad 
                onKeyPress={handlePinChange}
                onDelete={handlePinDelete}
                disabled={isLoading}
              />
            </View>
            
            <View style={styles.securityInfo}>
              <View style={styles.securityIconContainer}>
                <ShieldCheck size={isSmallScreen ? 16 : 20} color={colors.primary} />
              </View>
              <Text style={styles.securityText}>
                Make sure you remember this PIN. You'll need it to authorize transactions and sensitive operations.
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Confirm PIN"
        onPress={handleContinue}
        disabled={!isButtonEnabled}
        loading={isLoading}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean, screenWidth: number) => {
  const headerPadding = isSmallScreen ? 12 : 16;
  const contentPadding = isSmallScreen ? 16 : 24;
  const titleSize = isSmallScreen ? 24 : 28;
  const subtitleSize = isSmallScreen ? 14 : 16;
  const iconSize = isSmallScreen ? 36 : 40;
  const backButtonSize = isSmallScreen ? 36 : 40;
  const verticalSpacing = isSmallScreen ? 24 : 40;
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: headerPadding,
      paddingVertical: headerPadding,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: backButtonSize,
      height: backButtonSize,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: backButtonSize / 2,
      marginRight: 12,
    },
    headerTitle: {
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '600',
      color: colors.text,
    },
    contentContainer: {
      flexGrow: 1,
      paddingHorizontal: contentPadding,
    },
    content: {
      flex: 1,
      justifyContent: 'flex-start',
      paddingTop: verticalSpacing,
      alignItems: 'center',
    },
    titleContainer: {
      alignItems: 'center',
      marginBottom: verticalSpacing,
    },
    title: {
      fontSize: titleSize,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: subtitleSize,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    formContainer: {
      width: '100%',
      alignItems: 'center',
    },
    errorContainer: {
      backgroundColor: colors.errorLight,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      width: '100%',
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
      textAlign: 'center',
    },
    pinContainer: {
      alignItems: 'center',
      marginVertical: isSmallScreen ? 16 : 24,
      width: '100%',
      maxWidth: Math.min(screenWidth - contentPadding * 2, 320),
    },
    securityInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: isDark ? colors.backgroundSecondary : colors.backgroundTertiary,
      padding: 16,
      borderRadius: 12,
      marginTop: 16,
      width: '100%',
    },
    securityIconContainer: {
      marginTop: 2,
      width: iconSize,
      height: iconSize,
      borderRadius: iconSize / 2,
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    securityText: {
      flex: 1,
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.textSecondary,
      lineHeight: isSmallScreen ? 18 : 20,
    },
  });
};