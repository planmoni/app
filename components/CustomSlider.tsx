import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, PanResponder, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface CustomSliderProps {
  minimumValue: number;
  maximumValue: number;
  value: number;
  step?: number;
  onValueChange: (value: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  style?: any;
}

export default function CustomSlider({
  minimumValue,
  maximumValue,
  value,
  step = 0.01,
  onValueChange,
  minimumTrackTintColor,
  maximumTrackTintColor,
  thumbTintColor,
  style,
}: CustomSliderProps) {
  const { colors } = useTheme();
  const [sliderWidth, setSliderWidth] = useState(0);
  const containerRef = useRef<View>(null);

  // Convert value to percentage (0-100)
  const valueToPercentage = useCallback((val: number) => {
    return ((val - minimumValue) / (maximumValue - minimumValue)) * 100;
  }, [minimumValue, maximumValue]);

  // Convert percentage to value
  const percentageToValue = useCallback((percentage: number) => {
    const rawValue = minimumValue + (percentage / 100) * (maximumValue - minimumValue);
    const steppedValue = Math.round(rawValue / step) * step;
    return Math.max(minimumValue, Math.min(maximumValue, steppedValue));
  }, [minimumValue, maximumValue, step]);

  const updateValueFromPosition = useCallback((x: number) => {
    if (sliderWidth === 0) return;
    const percentage = (x / sliderWidth) * 100;
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    const newValue = percentageToValue(clampedPercentage);
    onValueChange(newValue);
  }, [sliderWidth, percentageToValue, onValueChange]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        containerRef.current?.measure((x, y, width, height, pageX, pageY) => {
          const touchX = evt.nativeEvent.pageX - pageX;
          updateValueFromPosition(touchX);
        });
      },
      onPanResponderMove: (evt) => {
        containerRef.current?.measure((x, y, width, height, pageX, pageY) => {
          const touchX = evt.nativeEvent.pageX - pageX;
          updateValueFromPosition(touchX);
        });
      },
      onPanResponderRelease: () => {
        // Value already updated in move
      },
    })
  ).current;

  const handlePress = useCallback((evt: any) => {
    if (sliderWidth === 0) return;
    const { locationX } = evt.nativeEvent;
    updateValueFromPosition(locationX);
  }, [sliderWidth, updateValueFromPosition]);

  const percentage = valueToPercentage(value);
  const thumbPosition = sliderWidth > 0 ? (percentage / 100) * sliderWidth : 0;

  return (
    <View
      ref={containerRef}
      style={[styles.container, style]}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width > 0) {
          setSliderWidth(width);
        }
      }}
    >
      <Pressable
        style={styles.trackContainer}
        onPress={handlePress}
        {...panResponder.panHandlers}
      >
        <View style={[styles.track, { backgroundColor: maximumTrackTintColor || colors.border }]}>
          <View
            style={[
              styles.trackActive,
              {
                width: `${percentage}%`,
                backgroundColor: minimumTrackTintColor || colors.primary,
              },
            ]}
          />
        </View>
        <View
          style={[
            styles.thumb,
            {
              backgroundColor: thumbTintColor || colors.primary,
              left: Math.max(0, Math.min(sliderWidth - 20, thumbPosition - 10)),
            },
          ]}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  trackContainer: {
    height: 20,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 4,
    borderRadius: 2,
    position: 'relative',
    width: '100%',
  },
  trackActive: {
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: 'absolute',
    top: 0,
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
