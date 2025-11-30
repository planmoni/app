import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useIntercom } from '@/hooks/useIntercom';
import { useTheme } from '@/contexts/ThemeContext';

interface IntercomButtonProps {
  title?: string;
  variant?: 'primary' | 'secondary' | 'floating';
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export const IntercomButton: React.FC<IntercomButtonProps> = ({
  title = 'Need Help?',
  variant = 'primary',
  size = 'medium',
  style
}) => {
  const { openChat, isLoading, isSupported } = useIntercom();
  const { colors } = useTheme();

  if (!isSupported) {
    return null; // Don't render on web
  }

  const handlePress = async () => {
    await openChat();
  };

  const getButtonStyle = () => {
    const baseStyle = [styles.button, styles[size]];
    
    switch (variant) {
      case 'primary':
        return [...baseStyle, { backgroundColor: colors.primary }];
      case 'secondary':
        return [...baseStyle, { 
          backgroundColor: colors.surface, 
          borderColor: colors.primary, 
          borderWidth: 1 
        }];
      case 'floating':
        return [...baseStyle, { 
          backgroundColor: colors.primary,
          borderRadius: 28,
          width: 56,
          height: 56,
          position: 'absolute',
          bottom: 20,
          right: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        }];
      default:
        return [...baseStyle, { backgroundColor: colors.primary }];
    }
  };

  const getTextStyle = () => {
    const baseStyle = [styles.text, styles[`${size}Text`]];
    
    switch (variant) {
      case 'primary':
      case 'floating':
        return [...baseStyle, { color: '#FFFFFF' }];
      case 'secondary':
        return [...baseStyle, { color: colors.primary }];
      default:
        return [...baseStyle, { color: '#FFFFFF' }];
    }
  };

  if (variant === 'floating') {
    return (
      <TouchableOpacity
        style={[getButtonStyle(), style]}
        onPress={handlePress}
        activeOpacity={0.8}
        disabled={isLoading}
      >
        <View style={styles.iconContainer}>
          <MessageCircle 
            size={24} 
            color="#FFFFFF" 
          />
        </View>
        
        {/* Status indicator */}
        <View style={[
          styles.statusIndicator,
          { backgroundColor: isLoading ? '#F59E0B' : '#10B981' }
        ]} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={isLoading}
    >
      <Text style={getTextStyle()}>
        {isLoading ? 'Opening...' : title}
      </Text>
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
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});