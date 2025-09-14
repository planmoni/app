import React, { useCallback } from 'react';
import { 
  View, 
  StyleSheet,
  Platform,
  Dimensions
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { useFabKeyboardOffset } from '@/hooks/useFabKeyboardOffset';
import Button from '@/components/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AndroidFloatingButtonProps = {
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
   * Additional gap above keyboard (default: 12 for Android)
   */
  keyboardGap?: number;
};

export default function AndroidFloatingButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  variant = 'primary',
  hapticType = 'medium',
  tabBarHeight = 0,
  keyboardGap = Platform.OS === 'android' ? -180 : -20, 
}: AndroidFloatingButtonProps) {
  const { colors, isDark } = useTheme();
  const { bottomOffset, isKeyboardVisible } = useFabKeyboardOffset({
    gap: keyboardGap,
    tabBarHeight,
    useDynamicCalculation: true,
  });
  const insets = useSafeAreaInsets();

  const styles = createStyles(colors, isKeyboardVisible);

  // Use different positioning strategy for Android
  const getButtonPosition = () => {
    if (Platform.OS === 'android') {
      return {
        bottom: bottomOffset,
        // Add some additional styling for Android
        marginHorizontal: 16,
        borderRadius: 12,
      };
    }
    return { bottom: bottomOffset };
  };

  // Dynamic calculation for Android
  const calculateAndroidKeyboardHeight = useCallback((keyboardEventHeight: number) => {
    const windowHeight = Dimensions.get('window').height;
    const screenHeight = Dimensions.get('screen').height;
    const statusBarHeight = screenHeight - windowHeight;
    
    return Math.max(
      keyboardEventHeight - statusBarHeight - insets.bottom,
      0
    );
  }, [insets.bottom]);

  return (
    <View 
      style={[
        styles.container, 
        getButtonPosition()
      ]}
      pointerEvents="box-none"
    >
      {/* Enhanced blur for Android */}
      <BlurView
        intensity={Platform.OS === 'android' ? 40 : 80}
        tint={isDark ? 'dark' : 'light'}
        style={styles.blurBackground}
        pointerEvents="none"
      />
      
      {/* Content overlay with Android-specific styling */}
      <View style={[
        styles.contentOverlay,
        Platform.OS === 'android' && styles.androidContentOverlay
      ]}>
        <View style={styles.buttonContainer}>
          <Button
            title={title}
            onPress={onPress}
            disabled={disabled}
            isLoading={loading}
            style={[
              styles.button,
              Platform.OS === 'android' && styles.androidButton
            ]}
            icon={icon}
            variant={variant}
            hapticType={hapticType}
          />
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isKeyboardVisible: boolean) => StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
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
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  androidContentOverlay: {
    // Android-specific styling
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    paddingTop: 4,
    paddingBottom: 4,
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    width: '100%',
    height: 55,
    backgroundColor: colors.primary,
  },
  androidButton: {
    // Android-specific button styling
    height: 52,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
}); 