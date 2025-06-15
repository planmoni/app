import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import LottieView from 'lottie-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { BlurView } from 'expo-blur';

// Conditionally load the Player component only on web
let Player: any = null;
if (Platform.OS === 'web') {
  try {
    const LottieWeb = require('@lottiefiles/react-lottie-player');
    Player = LottieWeb.Player;
  } catch (error) {
    console.error('Failed to import @lottiefiles/react-lottie-player:', error);
  }
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

  const renderContent = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.animationContainer}>
          {Player && (
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
          )}
        </View>
      );
    }

    return (
      <View style={styles.animationContainer}>
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
  };

  // For native platforms, use BlurView
  if (Platform.OS !== 'web') {
    return (
      <BlurView 
        intensity={70} 
        tint={isDark ? 'dark' : 'light'} 
        style={styles.container}
      >
        {renderContent()}
      </BlurView>
    );
  }

  // For web, use a semi-transparent background
  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: isDark 
            ? 'rgba(15, 23, 42, 0.9)' 
            : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)'
        }
      ]}
    >
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animationContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  animation: {
    width: 200,
    height: 200,
  },
});