import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Lock, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import PinDisplay from '@/components/PinDisplay';
import PinKeypad from '@/components/PinKeypad';
import FloatingButton from '@/components/FloatingButton';
import { usePin } from '@/contexts/PinContext';
import { useHaptics } from '@/hooks/useHaptics';

export default function PinSetupScreen() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { showToast } = useToast();
  const { setupPin } = usePin();
  const haptics = useHaptics();
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;

  useEffect(() => {
    setIsButtonEnabled(pin.length === 4);
  }, [pin]);

  const handlePinChange = (digit: string) => {
    if (pin.length < 4) {
      haptics.selection();
      setPin(prev => prev + digit);
      setError(null);
    }
  };

  const handlePinDelete = () => {
    haptics.lightImpact();
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleContinue = () => {
    if (pin.length === 4) {
      haptics.mediumImpact();
      router.push({
        pathname: '/pin-setup/confirm',
        params: { pin }
      });
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

  const styles = createStyles(colors, isDark, isSmallScreen);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={isProcessing ? () => {} : handleBackPress} style={styles.backButton} disabled={isProcessing}>
          <ArrowLeft size={isSmallScreen ? 20 : 24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Set up PIN</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer} disableScrollView={true}>
        <View style={styles.content}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Create your transaction PIN</Text>
            <Text style={styles.subtitle}>This PIN will be used to authorize transactions</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.instruction}>Enter a 4-digit PIN</Text>
            
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <View style={styles.pinContainer}>
              <PinDisplay 
                length={4}
                value={pin}
              />
              
              <PinKeypad 
                onKeyPress={handlePinChange}
                onDelete={handlePinDelete}
                disabled={false}
              />
            </View>
            
            <View style={styles.securityInfo}>
              <View style={styles.securityIconContainer}>
                <Lock size={isSmallScreen ? 16 : 20} color={colors.primary} />
              </View>
              <Text style={styles.securityText}>
                This PIN will be required for all transaction authorizations and sensitive operations
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={!isButtonEnabled}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => {
  const headerPadding = isSmallScreen ? 12 : 16;
  const contentPadding = isSmallScreen ? 16 : 24;
  const titleSize = isSmallScreen ? 24 : 28;
  const subtitleSize = isSmallScreen ? 14 : 16;
  const instructionSize = isSmallScreen ? 16 : 18;
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
    instruction: {
      fontSize: instructionSize,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 24,
      textAlign: 'center',
      alignSelf: 'center',
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