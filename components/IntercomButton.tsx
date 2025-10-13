import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useIntercom } from '@/hooks/useIntercom';
import { useTheme } from '@/contexts/ThemeContext';
import { MessageCircle } from 'lucide-react-native';

interface IntercomButtonProps {
  title?: string;
  variant?: 'primary' | 'secondary' | 'icon';
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
}

export const IntercomButton: React.FC<IntercomButtonProps> = ({
  title = 'Need Help?',
  variant = 'primary',
  size = 'medium',
  onPress
}) => {
  const { present, isSupported } = useIntercom();
  const { colors } = useTheme();

  const handlePress = async () => {
    if (onPress) {
      onPress();
    } else {
      await present();
    }
  };

  if (!isSupported) {
    return null; // Don't render on web
  }

  const buttonStyles = [
    styles.button,
    styles[size],
    variant === 'primary' && { backgroundColor: colors.primary },
    variant === 'secondary' && { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1 },
    variant === 'icon' && { backgroundColor: colors.primary, width: 56, height: 56, borderRadius: 28 }
  ];

  const textStyles = [
    styles.text,
    styles[`${size}Text`],
    variant === 'primary' && { color: '#FFFFFF' },
    variant === 'secondary' && { color: colors.primary },
    variant === 'icon' && { display: 'none' }
  ];

  return (
    <TouchableOpacity style={buttonStyles} onPress={handlePress} activeOpacity={0.8}>
      {variant === 'icon' ? (
        <MessageCircle size={24} color="#FFFFFF" />
      ) : (
        <Text style={textStyles as any}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  small: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
  },
  medium: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
  },
  large: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    minHeight: 52,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
});
