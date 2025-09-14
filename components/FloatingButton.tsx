import React from 'react';
import { 
  View, 
  StyleSheet,
  Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { useFabKeyboardOffset } from '@/hooks/useFabKeyboardOffset';
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
  const { bottomOffset } = useFabKeyboardOffset({
    gap: keyboardGap,
    tabBarHeight,
  });

  const styles = createStyles(colors);

  return (
    <View 
      style={[
        styles.container, 
        { bottom: bottomOffset }
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
    </View>
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