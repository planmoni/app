import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { WifiOff } from 'lucide-react-native';
import { useOnlineStatus } from './OnlineStatusProvider';

type OfflineNoticeProps = {
  message?: string;
};

export default function OfflineNotice({ message = 'This feature requires an internet connection' }: OfflineNoticeProps) {
  const { colors, isDark } = useTheme();
  const { isOnline } = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      padding: 16,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
    },
    icon: {
      marginRight: 12,
    },
    message: {
      flex: 1,
      fontSize: 14,
      color: isDark ? '#FEE2E2' : '#991B1B',
      lineHeight: 20,
    },
  });

  return (
    <View style={styles.container}>
      <WifiOff size={20} color={isDark ? '#FEE2E2' : '#991B1B'} style={styles.icon} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}