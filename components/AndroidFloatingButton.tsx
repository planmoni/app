import React from 'react';
import { 
  View, 
  StyleSheet,
  Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '@/components/Button';

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
};

/**
 * Android FAB that stays above the system navigation / gesture bar
 * (edge-to-edge, targetSdk 35+). Prefer FloatingButton for shared use.
 */
export default function AndroidFloatingButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  variant = 'primary',
  hapticType = 'medium',
  tabBarHeight = 0,
}: AndroidFloatingButtonProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const safeBottom = Math.max(insets.bottom, 16) + tabBarHeight;

  return (
    <View
      style={[styles.container, { paddingBottom: safeBottom }]}
      pointerEvents="box-none"
      collapsable={false}
    >
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={styles.blurBackground}
          pointerEvents="none"
        />
      ) : (
        <View
          style={[
            styles.blurBackground,
            {
              backgroundColor: isDark ? 'rgba(0,0,0,0.96)' : 'rgba(255,255,255,0.98)',
            },
          ]}
          pointerEvents="none"
        />
      )}

      <View style={styles.contentOverlay} pointerEvents="box-none" collapsable={false}>
        <View style={styles.buttonContainer} pointerEvents="auto" collapsable={false}>
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
    bottom: 0,
    zIndex: 1000,
    elevation: 24,
  },
  blurBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  contentOverlay: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    width: '100%',
    height: 52,
    borderRadius: 20,
    backgroundColor: colors.primary,
    elevation: 6,
  },
});
