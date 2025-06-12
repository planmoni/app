import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastProps = {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
};

export default function Toast({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onDismiss
}: ToastProps) {
  const { colors, isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getToastColors = () => {
    switch (type) {
      case 'success':
        return {
          background: isDark ? colors.successLight : '#F0FDF4',
          border: colors.success,
          text: isDark ? '#DCFCE7' : '#166534'
        };
      case 'error':
        return {
          background: isDark ? colors.errorLight : '#FEF2F2',
          border: colors.error,
          text: isDark ? '#FEE2E2' : '#991B1B'
        };
      case 'warning':
        return {
          background: isDark ? colors.warningLight : '#FFFBEB',
          border: colors.warning,
          text: isDark ? '#FEF3C7' : '#92400E'
        };
      case 'info':
      default:
        return {
          background: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
          border: colors.primary,
          text: isDark ? '#DBEAFE' : '#1E40AF'
        };
    }
  };

  const toastColors = getToastColors();

  useEffect(() => {
    if (visible) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Show toast
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        })
      ]).start();

      // Auto hide after duration
      timeoutRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible, message]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 300,
        useNativeDriver: true
      })
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
          backgroundColor: toastColors.background,
          borderColor: toastColors.border,
        }
      ]}
    >
      <Text 
        style={[
          styles.message,
          { color: toastColors.text }
        ]}
        numberOfLines={2}
      >
        {message}
      </Text>
      <Pressable onPress={hideToast} style={styles.closeButton}>
        <X size={16} color={toastColors.text} />
      </Pressable>
    </Animated.View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    maxWidth: width - 32,
    minHeight: 50,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 9999,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  closeButton: {
    padding: 4,
  }
});