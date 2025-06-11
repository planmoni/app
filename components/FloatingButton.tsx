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

type FloatingButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ComponentType<any>;
  variant?: 'primary' | 'secondary' | 'outline';
};

export default function FloatingButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  variant = 'primary'
}: FloatingButtonProps) {
  const { colors } = useTheme();
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
      <View style={styles.buttonContainer}>
        <Button
          title={title}
          onPress={onPress}
          disabled={disabled}
          isLoading={loading}
          style={styles.button}
          icon={icon}
          variant={variant}
        />
      </View>
    </Animated.View>
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
    paddingTop: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 1000,
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    width: '100%',
    backgroundColor: colors.primary,
  },
});
