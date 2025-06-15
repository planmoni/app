import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import LottieView from 'lottie-react-native';
import { Player } from '@lottiefiles/react-lottie-player';

interface SplashScreenProps {
  onFinish?: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  // Reference to the animation
  const animationRef = React.useRef<LottieView | null>(null);
  const playerRef = React.useRef<any>(null);

  useEffect(() => {
    // Play the animation when the component mounts
    if (Platform.OS !== 'web') {
      animationRef.current?.play();
    } else if (playerRef.current) {
      // For web, the Player component handles autoplay
    }

    // Set a timeout to call onFinish after animation completes
    const timer = setTimeout(() => {
      onFinish?.();
    }, 3000); // Animation duration in ms

    return () => clearTimeout(timer);
  }, [onFinish]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
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
    <View style={styles.container}>
      <LottieView
        ref={animationRef}
        source={require('@/assets/animations/planmoniloader.json')}
        style={styles.animation}
        autoPlay
        loop={false}
        onAnimationFinish={onFinish}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // White background
  },
  animation: {
    width: 200,
    height: 200,
  },
});