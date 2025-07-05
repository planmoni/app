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
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';
import { BlurView } from 'expo-blur';

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
        toValue: keyboardHeight,
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
    <>
      {/* Extra BlurView at the bottom for full coverage */}
      <BlurView
        intensity={30}
        tint={isDark ? 'dark' : 'light'}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 100 + insets.bottom,
          zIndex: 999,
        }}
        pointerEvents="none"
      />
      <Animated.View 
        style={[
          styles.container, 
          { bottom: animatedBottom }
        ]}
        pointerEvents="box-none"
      >
        <BlurView
          intensity={30}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
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
      </Animated.View>
    </>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: colors.primary,
  },
});