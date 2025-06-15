import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import LottieView from 'lottie-react-native';
import { useTheme } from '@/contexts/ThemeContext';

// Conditionally load the Player component only on web
let Player: any = null;
if (Platform.OS === 'web') {
  Player = require('@lottiefiles/react-lottie-player').Player;
}

interface SplashScreenProps {
  onFinish?: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  // Get the current theme
  const { colors, isDark } = useTheme();
  
  // Reference to the animation
  const animationRef = React.useRef<LottieView | null>(null);
  const playerRef = React.useRef<any>(null);

  useEffect(() => {
    // Play the animation when the component mounts
    if (Platform.OS !== 'web') {
      animationRef.current?.play();
    }

    // Set a timeout to call onFinish after animation completes
    const timer = setTimeout(() => {
      onFinish?.();
    }, 3000); // Animation duration in ms

    return () => clearTimeout(timer);
  }, [onFinish]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Player
          ref={playerRef}
          src={require('@/assets/animations/planmoniloader.json')}
          autoplay
          loop={false}
          style={styles.animation}
          onEvent={event => {
            if (event === 'complete') {
              onFinish?.();
            }
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LottieView
        ref={animationRef}
        source={require('@/assets/animations/planmoniloader.json')}
        style={styles.animation}
        autoPlay
        loop={false}
        onAnimationFinish={onFinish}
        colorFilters={isDark ? [
          {
            keypath: "Stroke 1",
            color: "#3B82F6" // Blue color for dark mode
          },
          {
            keypath: "Fill 1",
            color: "#3B82F6" // Blue color for dark mode
          }
        ] : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animation: {
    width: 200,
    height: 200,
  },
});