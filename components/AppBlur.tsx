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
        // App is coming to foreground - hide blur immediately and forcefully
        console.log('🔒 AppBlur - App coming to foreground, hiding overlay');
        setIsBlurred(false);
        
        // Force hide blur multiple times to ensure it's completely cleared
        // This prevents any rendering artifacts at the status bar level
        const clearBlur = () => {
          if (appStateRef.current === 'active') {
            setIsBlurred(false);
          }
        };
        
        // Clear immediately and with multiple delays to catch any race conditions
        clearBlur();
        setTimeout(clearBlur, 50);
        setTimeout(clearBlur, 100);
        setTimeout(clearBlur, 200);
        setTimeout(() => {
          if (appStateRef.current === 'active') {
            setIsBlurred(false);
            console.log('🔒 AppBlur - Final force clear of blur overlay');
          }
        }, 500);
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
  
  // Debug log for overlay rendering (both iOS and Android)
  useEffect(() => {
    console.log('🔒 AppBlur - Overlay state changed', {
      platform: Platform.OS,
      isBlurred,
      blurEnabled,
      currentAppState: appStateRef.current,
      willRender: isBlurred && blurEnabled
    });
  }, [isBlurred, blurEnabled]);

  return (
    <View style={styles.container}>
      {children}
      
      {/* Only render overlay when actually blurred to prevent rendering issues */}
      {/* Completely remove from DOM when not blurred to prevent status bar artifacts */}
      {isBlurred && Platform.OS === 'ios' && (
        <BlurView
          intensity={40}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.blurOverlay,
            {
              opacity: 1,
              pointerEvents: 'auto' as const,
              top: -100, // Start from very top to prevent any safe area padding
              marginTop: 0,
              paddingTop: 0,
            }
          ]}
        />
      )}
      {isBlurred && Platform.OS === 'android' && (
        <View 
          style={[
            styles.blurOverlay,
            styles.androidOverlay,
            {
              backgroundColor: androidOverlayBgColor,
              opacity: 1,
              pointerEvents: 'auto' as const,
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
    top: -100, // Start from very top to prevent any safe area padding
    left: 0,
    right: 0,
    bottom: 0,
    marginTop: 0,
    paddingTop: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    // Ensure overlay doesn't interfere with status bar on iOS
    ...(Platform.OS === 'ios' && {
      // Use negative top to ensure it covers everything including status bar area
      // This prevents any safe area padding from creating a visible box
    }),
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
