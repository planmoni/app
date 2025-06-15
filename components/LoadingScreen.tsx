import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import DotLottieLoader from './DotLottieLoader';

interface LoadingScreenProps {
  message?: string;
  size?: number;
}

export default function LoadingScreen({ 
  message = 'Loading...', 
  size = 200 
}: LoadingScreenProps) {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      <DotLottieLoader size={size} />
      {message && (
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
});