import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

// For React Native platforms, we'll use a different approach
import LottieView from 'lottie-react-native';

interface DotLottieLoaderProps {
  size?: number;
  src?: string;
  loop?: boolean;
  autoplay?: boolean;
  backgroundColor?: string;
}

export default function DotLottieLoader({
  size = 200,
  src = "https://lottie.host/30777839-d597-4a19-9434-eb1fb7a2f9fe/pcKrCtWnr9.json",
  loop = true,
  autoplay = true,
  backgroundColor = 'transparent'
}: DotLottieLoaderProps) {
  // Use different implementations for web vs native
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { width: size, height: size, backgroundColor }]}>
        <DotLottieReact
          src={src}
          loop={loop}
          autoplay={autoplay}
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    );
  }

  // For native platforms, we need to use a different approach
  // This is a placeholder - in a real implementation, you would need to
  // convert the dotLottie to a regular Lottie JSON or use a compatible library
  return (
    <View style={[styles.container, { width: size, height: size, backgroundColor }]}>
      <View style={styles.fallbackLoader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fallbackLoader: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#3B82F6',
    borderTopColor: 'transparent',
    transform: [{ rotate: '45deg' }],
  },
});