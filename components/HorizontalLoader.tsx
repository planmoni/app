import { View, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import LottieView from 'lottie-react-native';

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

type HorizontalLoaderProps = {
  height?: number;
  backgroundColor?: string;
  loaderColor?: string;
  useLottie?: boolean;
};

export default function HorizontalLoader({
  height = 3,
  backgroundColor,
  loaderColor,
  useLottie = false,
}: HorizontalLoaderProps) {
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const bgColor = backgroundColor || colors.border;
  const loadColor = loaderColor || colors.primary;

  useEffect(() => {
    if (!useLottie) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: 100,
            duration: 1200,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: -100,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }

    return () => {
      if (!useLottie) {
        translateX.stopAnimation();
        opacity.stopAnimation();
      }
    };
  }, []);

  if (useLottie) {
    return (
      <View style={[styles.lottieContainer, { height: height * 10 }]}>
        {Platform.OS === 'web' && Player ? (
          <Player
            autoplay
            loop
            src={require('@/assets/animations/planmoniloader.json')}
            style={styles.lottie}
          />
        ) : (
          <LottieView
            source={require('@/assets/animations/planmoniloader.json')}
            autoPlay
            loop
            style={styles.lottie}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { height, backgroundColor: bgColor }]}>
      <Animated.View
        style={[
          styles.loader,
          {
            backgroundColor: loadColor,
            transform: [{ translateX }],
            opacity,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  loader: {
    height: '100%',
    width: '50%',
    position: 'absolute',
  },
  lottieContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: 100,
    height: 30,
  },
});