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
  keyboardGap = Platform.OS === 'android' ? -180 : -20,
}: FloatingButtonProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Android stays fixed above the system nav — skip keyboard listeners.
  const { bottomOffset } = useFabKeyboardOffset({
    gap: keyboardGap,
    tabBarHeight,
    enabled: Platform.OS === 'ios',
  });

  const styles = createStyles(colors, isDark);

  // On Android edge-to-edge, pin to the physical bottom and pad the safe area
  // so the tap target sits above system control / gesture buttons.
  const androidSafeBottom = Math.max(insets.bottom, 16);
  const containerBottom =
    Platform.OS === 'android' ? 0 : bottomOffset;
  const androidPaddingBottom =
    Platform.OS === 'android' ? androidSafeBottom + tabBarHeight : undefined;

  return (
    <View 
      style={[
        styles.container, 
        {
          bottom: containerBottom,
          ...(androidPaddingBottom != null
            ? { paddingBottom: androidPaddingBottom }
            : null),
        },
      ]}
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
            style={[
              styles.button,
              Platform.OS === 'android' && styles.androidButton,
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
