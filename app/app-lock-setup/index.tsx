import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import PinDisplay from '@/components/PinDisplay';
import PinKeypad from '@/components/PinKeypad';
import { useAppLock } from '@/contexts/AppLockContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useOnlineStatus } from '@/components/OnlineStatusProvider';
import OfflineNotice from '@/components/OfflineNotice';

export default function AppLockSetupScreen() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { showToast } = useToast();
  const { setAppLockPin } = useAppLock();
  const haptics = useHaptics();
  const { isOnline } = useOnlineStatus();
  
  const [pinLength] = useState<number>(6);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;

  useEffect(() => {
    setError(null);
    
    // Automatically proceed to confirmation when PIN is complete
    if (pin.length === pinLength && !isProcessing) {
      setIsProcessing(true);
      console.log('[AppLockSetup] PIN entry complete, navigating to confirm.');
      const timer = setTimeout(() => {
        router.push({
          pathname: '/app-lock-setup/confirm',
          params: { pin }
        });
        setIsProcessing(false);
      }, 300); // Small delay for better UX
      
      return () => clearTimeout(timer);
    }
  }, [pin, pinLength, isProcessing]);

  const handlePinChange = (digit: string) => {
    if (pin.length < pinLength && !isProcessing) {
      haptics.selection();
      setPin(prev => prev + digit);
      setError(null);
    }
  };

  const handlePinDelete = () => {
    if (!isProcessing) {
      haptics.lightImpact();
      setPin(prev => prev.slice(0, -1));
      setError(null);
    }
  };

  const handleBackPress = () => {
    if (isProcessing) return;
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
        <Text style={styles.headerTitle}>App Lock</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.contentContainer} disableScrollView={true}>
        <View style={styles.content}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Set up app lock</Text>
            <Text style={styles.subtitle}>Create a PIN to secure your account</Text>
          </View>

          {!isOnline && (
            <OfflineNotice message="You can set up app lock while offline, but it will only sync across devices when you're back online." />
          )}

          <View style={styles.formContainer}>
            <Text style={styles.instruction}>Enter a 6-digit PIN</Text>
            
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            <View style={styles.pinContainer}>
              <PinDisplay 
                length={pinLength}
                value={pin}
              />
              
              <PinKeypad 
                onKeyPress={isProcessing ? () => {} : handlePinChange}
                onDelete={isProcessing ? () => {} : handlePinDelete}
                disabled={isProcessing || pin.length >= pinLength}
              />
            </View>
            
            <View style={styles.securityInfo}>
              <View style={styles.securityIconContainer}>
                <Lock size={isSmallScreen ? 16 : 20} color={colors.primary} />
              </View>
              <Text style={styles.securityText}>
                This PIN will be used to unlock the app and authorize transactions
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingWrapper>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => {
  // Calculate responsive sizes
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