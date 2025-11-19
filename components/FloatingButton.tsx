import React from 'react';
import { 
  View, 
  StyleSheet,
  Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { useFabKeyboardOffset } from '@/hooks/useFabKeyboardOffset';
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
   * Additional gap above keyboard (default: platform-specific)
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
  keyboardGap = Platform.OS === 'android' ? -180 : -20, // Platform-specific default
}: FloatingButtonProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Only use keyboard offset on iOS - Android maintains constant position
  const { bottomOffset } = useFabKeyboardOffset({
    gap: keyboardGap,
    tabBarHeight,
  });

  const styles = createStyles(colors, isDark);

  // Calculate the final bottom position
  const getBottomPosition = () => {
    if (Platform.OS === 'android') {
      // Android: constant position at bottom with safe area
      return insets.bottom + tabBarHeight;
    } else {
      // iOS: floating behavior with keyboard awareness
      return bottomOffset;
    }
  };

  return (
    <View 
      style={[
        styles.container, 
        { bottom: getBottomPosition() }
      ]}
      pointerEvents="box-none"
    >
      {/* Blurred underlay that extends below the button */}
      <BlurView
        intensity={Platform.OS === 'android' ? 40 : 60}
        tint={isDark ? 'dark' : 'light'}
        style={styles.blurUnderlay}
        pointerEvents="none"
      />
      
      {/* Main blur background for the button area */}
      <BlurView
        intensity={Platform.OS === 'android' ? 60 : 80}
        tint={isDark ? 'dark' : 'light'}
        style={styles.blurBackground}
        pointerEvents="none"
      />
      
      {/* Content overlay */}
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
            textColor={'#fff'}
            textStyle={styles.buttonText}
          />
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
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
  androidContentOverlay: {
    // Android-specific styling for constant position
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
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  androidButton: {
    // Android-specific button styling for constant position
    height: 52,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});