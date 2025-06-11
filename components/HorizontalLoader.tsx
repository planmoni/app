import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

type HorizontalLoaderProps = {
  height?: number;
  backgroundColor?: string;
  loaderColor?: string;
};

export default function HorizontalLoader({
  height = 3,
  backgroundColor,
  loaderColor,
}: HorizontalLoaderProps) {
  const { colors } = useTheme();
  const translateX = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const bgColor = backgroundColor || colors.border;
  const loadColor = loaderColor || colors.primary;

  useEffect(() => {
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

    return () => {
      translateX.stopAnimation();
      opacity.stopAnimation();
    };
  }, []);

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
});