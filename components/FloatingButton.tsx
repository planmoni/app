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
    // Function to handle keyboard show event
    const keyboardWillShow = (event: any) => {
      const keyboardHeight = event.endCoordinates.height;
      
      // Use the keyboard event's duration and easing when available
      const duration = event.duration || 250;
      const easing = event.easing ? Easing.bezier(0.17, 0.59, 0.4, 0.77) : Easing.out(Easing.ease);
      
      // Animate the button to position above keyboard
      Animated.timing(animatedBottom, {
        toValue: keyboardHeight,
        duration,
        easing,
        useNativeDriver: false,
      }).start();
    };
    
    // Function to handle keyboard hide event
    const keyboardWillHide = (event: any) => {
      // Use the keyboard event's duration and easing when available
      const duration = event.duration || 250;
      const easing = event.easing ? Easing.bezier(0.17, 0.59, 0.4, 0.77) : Easing.out(Easing.ease);
      
      // Animate the button back to its original position
      Animated.timing(animatedBottom, {
        toValue: insets.bottom,
        duration,
        easing,
        useNativeDriver: false,
      }).start();
    };
    
    // Set up keyboard event listeners based on platform
    const showListener = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideListener = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    
    const keyboardWillShowListener = Keyboard.addListener(showListener, keyboardWillShow);
    const keyboardWillHideListener = Keyboard.addListener(hideListener, keyboardWillHide);
    
    // Clean up event listeners
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
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 24,
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