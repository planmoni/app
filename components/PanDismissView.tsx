import React, { useRef } from 'react';
import { Animated, PanResponder, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

interface PanDismissViewProps {
  children: React.ReactNode;
  onDismiss: () => void;
  translateY: Animated.Value;
  threshold?: number;
  style?: StyleProp<ViewStyle>;
  onDragBegin?: () => void;
  onDragEnd?: () => void;
}

export default function PanDismissView({
  children,
  onDismiss,
  translateY,
  threshold = 120,
  style,
  onDragBegin,
  onDragEnd,
}: PanDismissViewProps) {
  const { height } = useWindowDimensions();

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderGrant: () => {
        onDragBegin?.();
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        onDragEnd?.();
        if (gestureState.dy > threshold) {
          Animated.timing(translateY, {
            toValue: height,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onDismiss();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View style={style} {...panResponder.panHandlers}>
      {children}
    </Animated.View>
  );
}
