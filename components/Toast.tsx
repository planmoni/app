import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Pressable, Platform } from 'react-native';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { BlurView } from 'expo-blur';

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
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getToastConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle,
          iconColor: '#10B981',
          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
          borderColor: '#10B981',
          textColor: isDark ? '#D1FAE5' : '#065F46',
          accentColor: '#10B981'
        };
      case 'error':
        return {
          icon: AlertCircle,
          iconColor: '#EF4444',
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
          borderColor: '#EF4444',
          textColor: isDark ? '#FEE2E2' : '#991B1B',
          accentColor: '#EF4444'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconColor: '#F59E0B',
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
          borderColor: '#F59E0B',
          textColor: isDark ? '#FEF3C7' : '#92400E',
          accentColor: '#F59E0B'
        };
      case 'info':
      default:
        return {
          icon: Info,
          iconColor: colors.primary,
          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
          borderColor: colors.primary,
          textColor: isDark ? '#DBEAFE' : '#1E40AF',
          accentColor: colors.primary
        };
    }
  };

  const toastConfig = getToastConfig();
  const IconComponent = toastConfig.icon;

  useEffect(() => {
    if (visible) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Show toast with beautiful animation
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        })
      ]).start();

      // Auto hide after duration
      // Return type may vary between environments; cast to ReturnType<typeof setTimeout>
      timeoutRef.current = (setTimeout(() => {
        hideToast();
      }, duration) as unknown) as ReturnType<typeof setTimeout>;
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible, message]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[
          styles.container,
          {
            opacity,
            transform: [
              { translateY },
              { scale }
            ],
          }
        ]}
      >
        <BlurView
          intensity={isDark ? 20 : 30}
          tint={isDark ? 'dark' : 'light'}
          style={[
            styles.blurContainer,
            {
              backgroundColor: toastConfig.backgroundColor,
              borderColor: toastConfig.borderColor,
            }
          ]}
        >
          <View style={styles.content}>
            <View style={[styles.iconContainer, { backgroundColor: toastConfig.accentColor }]}>
              <IconComponent size={20} color="#FFFFFF" />
            </View>
            
            <View style={styles.textContainer}>
              <Text 
                style={[
                  styles.message,
                  { color: toastConfig.textColor }
                ]}
                numberOfLines={3}
              >
                {message}
              </Text>
            </View>
            
            <Pressable 
              onPress={hideToast} 
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color={toastConfig.textColor} />
            </Pressable>
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height,
    width: width,
    pointerEvents: 'box-none',
    zIndex: 9999,
  },
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 16,
    right: 16,
    maxWidth: width - 32,
    zIndex: 10000,
  },
  blurContainer: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    minHeight: 60,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
});