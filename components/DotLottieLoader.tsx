import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import LottieView from 'lottie-react-native';

// Conditionally load the Player component only on web
let Player: any = null;
if (Platform.OS === 'web') {
  try {
    const DotLottieReact = require('@lottiefiles/dotlottie-react');
    Player = DotLottieReact.DotLottieReact;
  } catch (error) {
    console.error('Failed to load @lottiefiles/dotlottie-react:', error);
  }
}

interface DotLottieLoaderProps {
  width?: number;
  height?: number;
  source?: string;
  style?: any;
}

export default function DotLottieLoader({ 
  width = 200, 
  height = 200, 
  source = "https://lottie.host/30777839-d597-4a19-9434-eb1fb7a2f9fe/pcKrCtWnr9.json",
  style 
}: DotLottieLoaderProps) {
  
  // For web platform
  if (Platform.OS === 'web' && Player) {
    return (
      <View style={[styles.container, { width, height }, style]}>
        <Player
          src={source}
          autoplay
          loop
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    );
  }
  
  // For native platforms
  return (
    <View style={[styles.container, { width, height }, style]}>
      <LottieView
        source={{ uri: source }}
        autoPlay
        loop
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});