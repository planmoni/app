import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Wifi, WifiOff, X } from 'lucide-react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

const { width } = Dimensions.get('window');

export default function OfflineBanner() {
  const { colors, isDark } = useTheme();
  const [isOffline, setIsOffline] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const translateY = React.useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    // Skip for web platform if needed
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }

    // Function to handle connection changes
    const handleConnectivityChange = (state: NetInfoState) => {
      setIsOffline(!state.isConnected);
    };

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);

    // Initial check
    NetInfo.fetch().then(state => {
      setIsOffline(!state.isConnected);
    });

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, []);

  // Animate banner in/out based on offline status
  useEffect(() => {
    if (isOffline && !isDismissed) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else {
      Animated.spring(translateY, {
        toValue: -100,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    }
  }, [isOffline, isDismissed]);

  // Reset dismissed state when connection status changes
  useEffect(() => {
    if (!isOffline) {
      setIsDismissed(false);
    }
  }, [isOffline]);

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      backgroundColor: isDark ? colors.errorLight : '#FEE2E2',
      paddingVertical: 12,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    icon: {
      marginRight: 12,
    },
    message: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#FEE2E2' : '#991B1B',
      flex: 1,
    },
    dismissButton: {
      padding: 4,
    },
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }] },
      ]}
    >
      <View style={styles.content}>
        <WifiOff size={20} color={isDark ? '#FEE2E2' : '#991B1B'} style={styles.icon} />
        <Text style={styles.message}>
          You're offline. Some features may be unavailable.
        </Text>
      </View>
      <Pressable style={styles.dismissButton} onPress={handleDismiss}>
        <X size={20} color={isDark ? '#FEE2E2' : '#991B1B'} />
      </Pressable>
    </Animated.View>
  );
}