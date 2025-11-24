import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { AppState, AppStateStatus, StyleSheet, View, Text, Platform, InteractionManager } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { Lock } from 'lucide-react-native';
import { isAppBlurEnabled } from './AppBlurSettings';

interface AppBlurProps {
  children: React.ReactNode;
}

export default function AppBlur({ children }: AppBlurProps) {
  const { colors, isDark } = useTheme();
  const [isBlurred, setIsBlurred] = useState(false);
  const [blurEnabled, setBlurEnabled] = useState(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const blurEnabledRef = useRef(true);

  useEffect(() => {
    // Load blur settings
    const loadSettings = async () => {
      const enabled = await isAppBlurEnabled();
      setBlurEnabled(enabled);
      blurEnabledRef.current = enabled;
    };
    loadSettings();
  }, []);

  useEffect(() => {
    blurEnabledRef.current = blurEnabled;
  }, [blurEnabled]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const currentState = appStateRef.current;
      console.log('🔒 AppBlur - App state changed:', currentState, '->', nextAppState, {
        platform: Platform.OS,
        blurEnabled: blurEnabledRef.current
      });
      
      if (currentState === 'active' && nextAppState === 'inactive') {
        // App is becoming inactive (notification drawer, app switcher, etc.)
        // Show overlay immediately - this is critical for Android app switcher screenshots
        if (blurEnabledRef.current) {
          console.log('🔒 AppBlur - App becoming inactive, showing overlay IMMEDIATELY');
          // Use InteractionManager to ensure overlay renders before app suspends
          InteractionManager.runAfterInteractions(() => {
            setIsBlurred(true);
            console.log('🔒 AppBlur - Overlay state set to true');
          });
          // Also set immediately for faster response
          setIsBlurred(true);
        }
      } else if (currentState === 'active' && nextAppState === 'background') {
        // App is going to background - show blur if not already shown
        if (blurEnabledRef.current) {
          console.log('🔒 AppBlur - App going to background, showing overlay');
          setIsBlurred(true);
        }
      } else if (currentState.match(/inactive|background/) && nextAppState === 'active') {
        // App is coming to foreground - hide blur
        console.log('🔒 AppBlur - App coming to foreground, hiding overlay');
        setIsBlurred(false);
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  // Don't show blur on web platform or if disabled
  if (Platform.OS === 'web' || !blurEnabled) {
    return <>{children}</>;
  }

  // Android overlay - always render, control visibility
  const androidOverlayBgColor = isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.98)';
  
  // Debug log for Android overlay rendering
  useEffect(() => {
    if (Platform.OS === 'android') {
      console.log('🔒 AppBlur - Android overlay state changed', {
        isBlurred,
        blurEnabled,
        backgroundColor: androidOverlayBgColor,
        currentAppState: appStateRef.current
      });
    }
  }, [isBlurred, blurEnabled, androidOverlayBgColor]);

  return (
    <View style={styles.container}>
      {children}
      
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={40}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.blurOverlay,
            {
              opacity: isBlurred ? 1 : 0,
              pointerEvents: isBlurred ? 'auto' as const : 'none' as const,
            }
          ]}
        />
      ) : (
        // Android: Use solid overlay - always render for instant visibility
        <View 
          style={[
            styles.blurOverlay,
            styles.androidOverlay,
            {
              backgroundColor: androidOverlayBgColor,
              opacity: isBlurred ? 1 : 0,
              pointerEvents: isBlurred ? 'auto' as const : 'none' as const,
            }
          ]}
          collapsable={false}
          removeClippedSubviews={false}
        />
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
  androidOverlay: {
    // Android-specific styles to ensure overlay is visible
    ...Platform.select({
      android: {
        // Ensure overlay is above everything on Android
        position: 'absolute',
      },
    }),
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
