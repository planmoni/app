import React from 'react';
import { 
  View, 
  StyleSheet, 
  Animated, 
  Keyboard, 
  Platform,
  Dimensions
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
  const keyboardHeight = React.useRef(new Animated.Value(0)).current;
  const buttonOpacity = React.useRef(new Animated.Value(1)).current;
  const { height: screenHeight } = Dimensions.get('window');
  
  // Calculate the bottom padding to account for the safe area
  const bottomPadding = Platform.OS === 'ios' ? insets.bottom : 0;
  
  React.useEffect(() => {
    // Function to handle keyboard show event
    const keyboardWillShow = (event: any) => {
      // Get keyboard height
      const keyboardHeightValue = event.endCoordinates.height;
      
      // Animate the button position - use full keyboard height for Android
      Animated.parallel([
        Animated.timing(keyboardHeight, {
          toValue: keyboardHeightValue,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        })
      ]).start();
    };
    
    // Function to handle keyboard hide event
    const keyboardWillHide = () => {
      // Animate the button back to its original position
      Animated.parallel([
        Animated.timing(keyboardHeight, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        })
      ]).start();
    };
    
    // Set up keyboard event listeners
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      keyboardWillShow
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      keyboardWillHide
    );
    
    // Clean up event listeners
    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);
  
  // Create animated styles for the button container
  const animatedContainerStyle = {
    paddingBottom: Animated.add(keyboardHeight, new Animated.Value(bottomPadding)),
    opacity: buttonOpacity,
  };
  
  const styles = createStyles(colors);
  
  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
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
    bottom: 0,
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