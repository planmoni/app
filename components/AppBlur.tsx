import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, View, Text, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { Lock } from 'lucide-react-native';
import { isAppBlurEnabled } from './AppBlurSettings';

interface AppBlurProps {
  children: React.ReactNode;
}

export default function AppBlur({ children }: AppBlurProps) {
  const { colors, isDark } = useTheme();
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [isBlurred, setIsBlurred] = useState(false);
  const [blurEnabled, setBlurEnabled] = useState(true);

  useEffect(() => {
    // Load blur settings
    const loadSettings = async () => {
      const enabled = await isAppBlurEnabled();
      setBlurEnabled(enabled);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('🔒 AppBlur - App state changed:', appState, '->', nextAppState);
      
      if (appState === 'active' && nextAppState.match(/inactive|background/)) {
        // App is going to background - show blur if enabled
        if (blurEnabled) {
          console.log('🔒 AppBlur - App going to background, showing blur');
          setIsBlurred(true);
        }
      } else if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App is coming to foreground - hide blur
        console.log('🔒 AppBlur - App coming to foreground, hiding blur');
        setIsBlurred(false);
      }
      
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [appState, blurEnabled]);

  // Don't show blur on web platform or if disabled
  if (Platform.OS === 'web' || !blurEnabled) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      {children}
      
      {isBlurred && (
        <BlurView
          intensity={20}
          tint={isDark ? 'dark' : 'light'}
          style={styles.blurOverlay}
        >
          <View style={styles.blurContent}>
            <View style={[styles.lockIconContainer, { backgroundColor: colors.background }]}>
              <Lock size={32} color={colors.primary} />
            </View>
            <Text style={[styles.blurText, { color: colors.text }]}>
              Planmoni is Encrypted
            </Text>
            <Text style={[styles.blurSubtext, { color: colors.textSecondary }]}>
              Tap to resume
            </Text>
          </View>
        </BlurView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  blurContent: {
    alignItems: 'center',
    padding: 32,
  },
  lockIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  blurText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  blurSubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
});
