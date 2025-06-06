import Animated, { 
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  useAnimatedStyle,
  withRepeat,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import { useEffect } from 'react';

type ConfettiPieceProps = {
  delay: number;
  x: number;
  y: number;
  color: string;
};

export default function ConfettiPiece({ delay, x, y, color }: ConfettiPieceProps) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${Math.random() * 360}deg` },
      ],
      opacity: withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: 100 }),
          withDelay(1000, withTiming(0, { duration: 500 }))
        )
      ),
    };
  });

  return (
    <Animated.View style={[styles.piece, { backgroundColor: color }, animatedStyle]} />
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});