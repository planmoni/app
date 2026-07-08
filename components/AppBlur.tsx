import React, { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus, StyleSheet, View, Platform, InteractionManager } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { isAppBlurEnabled } from './AppBlurSettings';

interface AppBlurProps {
  children: React.ReactNode;
}

function AppBlurIOS({ children }: AppBlurProps) {
  const { isDark } = useTheme();
  const [isBlurred, setIsBlurred] = useState(false);
  const [blurEnabled, setBlurEnabled] = useState(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const blurEnabledRef = useRef(true);

  useEffect(() => {
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

      if (currentState === 'active' && nextAppState === 'inactive') {
        if (blurEnabledRef.current) {
          InteractionManager.runAfterInteractions(() => {
            setIsBlurred(true);
          });
          setIsBlurred(true);
        }
      } else if (currentState === 'active' && nextAppState === 'background') {
        if (blurEnabledRef.current) {
          setIsBlurred(true);
        }
      } else if (currentState.match(/inactive|background/) && nextAppState === 'active') {
        setIsBlurred(false);

        const clearBlur = () => {
          if (appStateRef.current === 'active') {
            setIsBlurred(false);
          }
        };

        clearBlur();
        setTimeout(clearBlur, 50);
        setTimeout(clearBlur, 100);
        setTimeout(clearBlur, 200);
        setTimeout(() => {
          if (appStateRef.current === 'active') {
            setIsBlurred(false);
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

  useEffect(() => {
    if (__DEV__) {
      console.log('AppBlur - Overlay state changed', {
        platform: Platform.OS,
        isBlurred,
        blurEnabled,
        currentAppState: appStateRef.current,
        willRender: isBlurred && blurEnabled,
      });
    }
  }, [isBlurred, blurEnabled]);

  if (!blurEnabled) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      {children}

      {isBlurred && (
        <BlurView
          intensity={40}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.blurOverlay,
            {
              opacity: 1,
              pointerEvents: 'auto' as const,
              top: -100,
              marginTop: 0,
              paddingTop: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

export default function AppBlur({ children }: AppBlurProps) {
  // App blur is iOS-only; Android relies on app lock instead.
  if (Platform.OS !== 'ios') {
    return <>{children}</>;
  }

  return <AppBlurIOS>{children}</AppBlurIOS>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blurOverlay: {
    position: 'absolute',
    top: -100,
    left: 0,
    right: 0,
    bottom: 0,
    marginTop: 0,
    paddingTop: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
});
