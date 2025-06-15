import { Pressable, Text, StyleSheet, ActivityIndicator, PressableProps, View } from 'react-native';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';

type ButtonProps = PressableProps & {
  title?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentType<any>;
  hapticType?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' | 'none';
};

export default function Button({
  title,
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  disabled = false,
  style,
  icon: Icon,
  hapticType = 'light',
  ...props
}: ButtonProps) {
  const haptics = useHaptics();

  const getVariantStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryButton;
      case 'secondary':
        return styles.secondaryButton;
      case 'outline':
        return styles.outlineButton;
      default:
        return styles.primaryButton;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryText;
      case 'secondary':
        return styles.secondaryText;
      case 'outline':
        return styles.outlineText;
      default:
        return styles.primaryText;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallButton;
      case 'medium':
        return styles.mediumButton;
      case 'large':
        return styles.largeButton;
      default:
        return styles.mediumButton;
    }
  };

  const getTextSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallText;
      case 'medium':
        return styles.mediumText;
      case 'large':
        return styles.largeText;
      default:
        return styles.mediumText;
    }
  };

  const triggerHaptic = () => {
    if (disabled || isLoading) return;
    
    switch (hapticType) {
      case 'light':
        haptics.impact(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        haptics.impact(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        haptics.impact(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        haptics.notification(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        haptics.notification(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        haptics.notification(Haptics.NotificationFeedbackType.Error);
        break;
      case 'selection':
        haptics.selection();
        break;
      case 'none':
      default:
        // No haptic feedback
        break;
    }
  };

  const handlePress = (e: any) => {
    triggerHaptic();
    props.onPress?.(e);
  };

  return (
    <Pressable
      style={[
        styles.button,
        getVariantStyle(),
        getSizeStyle(),
        disabled && styles.disabledButton,
        style,
      ]}
      disabled={disabled || isLoading}
      {...props}
      onPress={handlePress}
    >
      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator 
            size="small" 
            color={variant === 'outline' ? '#1E3A8A' : '#FFFFFF'} 
          />
        ) : (
          <>
            {Icon && (
              <Icon 
                color={variant === 'outline' ? '#1E3A8A' : '#FFFFFF'} 
                size={24} 
                style={styles.icon} 
              />
            )}
            {/* Only render Text component if there's a title or an icon */}
            {(title || Icon) && (
              <Text
                style={[
                  styles.text,
                  getTextStyle(),
                  getTextSizeStyle(),
                  disabled && styles.disabledText,
                ]}
              >
                {title || ''}
              </Text>
            )}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  // Variants
  primaryButton: {
    backgroundColor: '#1E3A8A',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#CBD5E1',
  },
  secondaryText: {
    color: '#1E293B',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1E3A8A',
  },
  outlineText: {
    color: '#1E3A8A',
  },
  // Sizes
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  mediumButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  largeButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  smallText: {
    fontSize: 12,
  },
  mediumText: {
    fontSize: 14,
  },
  largeText: {
    fontSize: 16,
  },
  // States
  disabledButton: {
    backgroundColor: '#E2E8F0',
    borderColor: '#E2E8F0',
  },
  disabledText: {
    color: '#94A3B8',
  },
});