import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export type CustomActionToastProps = {
  text1: string;
  actionLabel?: string;
  onAction?: () => void;
  onHide?: () => void;
  type?: 'success' | 'error' | 'info' | 'warning';
};

export default function CustomActionToast({
  text1,
  actionLabel = 'View',
  onAction,
  onHide,
  type = 'info',
}: CustomActionToastProps) {
  const { colors, isDark } = useTheme();

  const getToastColors = () => {
    switch (type) {
      case 'success':
        return {
          background: isDark ? colors.successLight : '#F0FDF4',
          border: colors.success,
          text: isDark ? '#DCFCE7' : '#166534',
        };
      case 'error':
        return {
          background: isDark ? colors.errorLight : '#FEF2F2',
          border: colors.error,
          text: isDark ? '#FEE2E2' : '#991B1B',
        };
      case 'warning':
        return {
          background: isDark ? colors.warningLight : '#FFFBEB',
          border: colors.warning,
          text: isDark ? '#FEF3C7' : '#92400E',
        };
      case 'info':
      default:
        return {
          background: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
          border: colors.primary,
          text: isDark ? '#DBEAFE' : '#1E40AF',
        };
    }
  };

  const toastColors = getToastColors();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: toastColors.background,
          borderColor: toastColors.border,
        },
      ]}
    >
      <Text style={[styles.message, { color: toastColors.text }]}>{text1}</Text>
      {onAction && (
        <Pressable style={styles.actionButton} onPress={onAction}>
          <Text style={[styles.actionLabel, { color: toastColors.text }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    marginHorizontal: 16,
    marginTop: 60,
    minHeight: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
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
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  actionLabel: {
    fontWeight: 'bold',
    fontSize: 14,
  },
});
