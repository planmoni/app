import React, { useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Animated, 
  Keyboard, 
  Platform,
  Easing
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';

type FloatingButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ComponentType<any>;
  variant?: 'primary' | 'secondary' | 'outline';
  hapticType?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' | 'none';
};

export default function FloatingButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  variant = 'primary',
  hapticType = 'medium'
}: FloatingButtonProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const animatedBottom = useRef(new Animated.Value(insets.bottom)).current;
  
  useEffect(() => {
    const keyboardWillShow = (event: any) => {
      const keyboardHeight = event.endCoordinates?.height || 0;
      const duration = event.duration || (Platform.OS === 'ios' ? 250 : 100);
      const easing = Platform.OS === 'ios'
        ? Easing.bezier(0.17, 0.59, 0.4, 0.77)
        : Easing.out(Easing.ease);

      Animated.timing(animatedBottom, {
        toValue: keyboardHeight + insets.bottom,
        duration,
        easing,
        useNativeDriver: false,
      }).start();
    };

    const keyboardWillHide = (event: any) => {
      const duration = event.duration || (Platform.OS === 'ios' ? 250 : 100);
      const easing = Platform.OS === 'ios'
        ? Easing.bezier(0.17, 0.59, 0.4, 0.77)
        : Easing.out(Easing.ease);

      Animated.timing(animatedBottom, {
        toValue: insets.bottom,
        duration,
        easing,
        useNativeDriver: false,
      }).start();
    };

    const showListener = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideListener = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardWillShowListener = Keyboard.addListener(showListener, keyboardWillShow);
    const keyboardWillHideListener = Keyboard.addListener(hideListener, keyboardWillHide);

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [insets.bottom]);

  const styles = createStyles(colors);

  return (
    <Animated.View 
      style={[
        styles.container, 
        { bottom: animatedBottom }
      ]}
      pointerEvents="box-none"
    >
      {/* Blurred underlay that extends below the button */}
      <BlurView
        intensity={60}
        tint={isDark ? 'dark' : 'light'}
        style={styles.blurUnderlay}
        pointerEvents="none"
      />
      
      {/* Main blur background for the button area */}
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={styles.blurBackground}
        pointerEvents="none"
      />
      
      {/* Content overlay */}
      <View style={styles.contentOverlay}>
        <View style={styles.buttonContainer}>
          <Button
            title={title}
            onPress={onPress}
            disabled={disabled}
            isLoading={loading}
            style={styles.button}
            icon={icon}
            variant={variant}
            hapticType={hapticType}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  blurUnderlay: {
    position: 'absolute',
    top: -1, // Extends 100px above the button
    left: 0,
    right: 0,
    bottom: 0,
    height: 200, // Total height including the button area
  },
  blurBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  contentOverlay: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 5,
    paddingHorizontal: 16,
    paddingBottom: 5,
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    width: '100%',
    height: 55,
    backgroundColor: colors.primary,
  },
});