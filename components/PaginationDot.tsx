// components/PaginationDot.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function PaginationDot({
  index,
  currentIndex,
  color,
}: {
  index: number;
  currentIndex: number;
  color: string;
}) {
  const isActive = index === currentIndex;

  return (
    <View
      style={[
        styles.dot,
        {
          width: isActive ? 18 : 8,
          backgroundColor: isActive ? color : '#999',
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
});
