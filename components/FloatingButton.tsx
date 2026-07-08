import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Keyboard,
  Animated,
  Easing,
  KeyboardEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '@/components/Button';

type FloatingButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ComponentType<any>;
  variant?: 'primary' | 'secondary' | 'outline';
  hapticType?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' | 'none';
  /**
   * Height of bottom tab bar if present
   */
  tabBarHeight?: number;
  /**
   * Extra gap above the keyboard when it is open
   */
  keyboardGap?: number;
};

export default function FloatingButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  variant = 'primary',
  hapticType = 'medium',
  tabBarHeight = 0,
  keyboardGap = 8,
}: FloatingButtonProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Resting position: above Android system nav / iOS home indicator
  const restingBottom =
    (Platform.OS === 'android' ? Math.max(insets.bottom, 16) : insets.bottom) +
    tabBarHeight;

  const animatedBottom = useRef(new Animated.Value(restingBottom)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    // Keep resting position in sync when insets change
    if (!keyboardVisible) {
      animatedBottom.setValue(restingBottom);
    }
  }, [restingBottom, keyboardVisible, animatedBottom]);

  useEffect(() => {
    const animateTo = (toValue: number, duration: number) => {
      Animated.timing(animatedBottom, {
        toValue,
        duration,
        easing:
          Platform.OS === 'ios'
            ? Easing.bezier(0.17, 0.59, 0.4, 0.77)
            : Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    };

    const onShow = (e: KeyboardEvent) => {
      const keyboardHeight = e.endCoordinates?.height ?? 0;
      if (keyboardHeight <= 0) return;

      setKeyboardVisible(true);

      // With edge-to-edge + adjustResize, the reported keyboard height already
      // includes the system nav area. Sit just above the keyboard.
      const nextBottom =
        Platform.OS === 'android'
          ? Math.max(keyboardHeight, restingBottom) + keyboardGap
          : keyboardHeight + keyboardGap + insets.bottom;

      animateTo(nextBottom, Platform.OS === 'ios' ? 250 : 180);
    };

    const onHide = () => {
      setKeyboardVisible(false);
      animateTo(restingBottom, Platform.OS === 'ios' ? 250 : 180);
    };

    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onShow
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      onHide
    );

    // Android also fires frame changes while IME animates.
    const frameSub =
      Platform.OS === 'android'
        ? Keyboard.addListener('keyboardDidChangeFrame', (e) => {
            const keyboardHeight = e.endCoordinates?.height ?? 0;
            if (keyboardHeight > 80) {
              setKeyboardVisible(true);
              animatedBottom.setValue(
                Math.max(keyboardHeight, restingBottom) + keyboardGap
              );
            } else {
              setKeyboardVisible(false);
              animatedBottom.setValue(restingBottom);
            }
          })
        : null;

    return () => {
      showSub.remove();
      hideSub.remove();
      frameSub?.remove();
    };
  }, [animatedBottom, keyboardGap, restingBottom, insets.bottom]);

  const styles = createStyles(colors);

  return (
    <Animated.View
      style={[styles.container, { bottom: animatedBottom }]}
      pointerEvents="box-none"
      collapsable={false}
    >
      {Platform.OS === 'ios' ? (
        <>
          <BlurView
            intensity={60}
            tint={isDark ? 'dark' : 'light'}
            style={styles.blurUnderlay}
            pointerEvents="none"
          />
          <BlurView
            intensity={80}
            tint={isDark ? 'dark' : 'light'}
            style={styles.blurBackground}
            pointerEvents="none"
          />
        </>
      ) : (
        <View
          style={[
            styles.androidUnderlay,
            {
              backgroundColor: isDark ? 'rgba(0,0,0,0.96)' : 'rgba(255,255,255,0.98)',
            },
          ]}
          pointerEvents="none"
        />
      )}

      <View
        style={[
          styles.contentOverlay,
          Platform.OS === 'android' && styles.androidContentOverlay,
        ]}
        pointerEvents="box-none"
        collapsable={false}
      >
        <View style={styles.buttonContainer} pointerEvents="auto" collapsable={false}>
          <Button
            title={title}
            onPress={onPress}
            disabled={disabled}
            isLoading={loading}
            style={[styles.button, Platform.OS === 'android' && styles.androidButton]}
            icon={icon}
            variant={variant}
            hapticType={hapticType}
            textColor={'#fff'}
            textStyle={styles.buttonText}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 1000,
      elevation: 24,
    },
    blurUnderlay: {
      position: 'absolute',
      top: -1,
      left: 0,
      right: 0,
      bottom: 0,
      height: 200,
    },
    blurBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    androidUnderlay: {
      ...StyleSheet.absoluteFillObject,
    },
    contentOverlay: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 5,
      paddingHorizontal: 16,
      paddingBottom: 5,
    },
    androidContentOverlay: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: 'transparent',
      paddingTop: 8,
      paddingBottom: 8,
      paddingHorizontal: 16,
    },
    buttonContainer: {
      width: '100%',
    },
    button: {
      width: '100%',
      height: 60,
      borderRadius: 20,
      backgroundColor: colors.primary,
    },
    androidButton: {
      height: 52,
      borderRadius: 20,
      elevation: 6,
    },
    buttonText: {
      fontSize: 17,
      fontWeight: '600',
    },
  });
