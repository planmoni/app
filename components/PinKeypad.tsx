import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, Platform } from 'react-native';
import { Delete } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

interface PinKeypadProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  disabled?: boolean;
}

const KEY_LETTERS: Record<string, string> = {
  '2': 'ABC',
  '3': 'DEF',
  '4': 'GHI',
  '5': 'JKL',
  '6': 'MNO',
  '7': 'PQRS',
  '8': 'TUV',
  '9': 'WXYZ',
};

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

export default function PinKeypad({ onKeyPress, onDelete, disabled = false }: PinKeypadProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const haptics = useHaptics();
  const initialDimensions = useRef({ width, height });
  const isSmallScreen = initialDimensions.current.width < 380 || initialDimensions.current.height < 700;

  const keySize = isSmallScreen ? 72 : 78;
  const gap = isSmallScreen ? 16 : 20;
  const keypadWidth = keySize * 3 + gap * 2;
  const keyFill = isDark ? '#1E293B' : '#F1F5F9';
  const keyFillPressed = isDark ? '#334155' : '#E2E8F0';

  const handleKeyPress = (key: string) => {
    if (!disabled) {
      haptics.selection();
      onKeyPress(key);
    }
  };

  const handleDelete = () => {
    if (!disabled) {
      haptics.lightImpact();
      onDelete();
    }
  };

  const renderKey = (key: string) => {
    const letters = KEY_LETTERS[key];
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityLabel={key}
        style={({ pressed }) => [
          styles.keyButton,
          {
            width: keySize,
            height: keySize,
            borderRadius: keySize / 2,
            backgroundColor: pressed && !disabled ? keyFillPressed : keyFill,
          },
          pressed && !disabled && styles.keyButtonPressed,
          disabled && styles.keyButtonDisabled,
        ]}
        onPress={() => handleKeyPress(key)}
        disabled={disabled}
        collapsable={false}
        removeClippedSubviews={false}
      >
        <Text
          style={[
            styles.keyText,
            { color: disabled ? colors.textTertiary : colors.text },
          ]}
        >
          {key}
        </Text>
        {letters ? (
          <Text style={[styles.keyLetters, { color: disabled ? colors.textTertiary : colors.textSecondary }]}>
            {letters}
          </Text>
        ) : (
          <View style={styles.keyLettersSpacer} />
        )}
      </Pressable>
    );
  };

  const styles = StyleSheet.create({
    container: {
      width: keypadWidth,
      alignSelf: 'center',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: gap,
    },
    keyButton: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    keyButtonPressed: {
      transform: [{ scale: 0.96 }],
    },
    keyButtonDisabled: {
      opacity: 0.45,
    },
    keyText: {
      fontSize: isSmallScreen ? 28 : 32,
      fontWeight: '500',
      lineHeight: isSmallScreen ? 32 : 36,
    },
    keyLetters: {
      fontSize: 9,
      fontWeight: '600',
      letterSpacing: 1.2,
      marginTop: -2,
    },
    keyLettersSpacer: {
      height: 11,
    },
    emptyKey: {
      width: keySize,
      height: keySize,
    },
  });

  return (
    <View style={styles.container} collapsable={false} removeClippedSubviews={false}>
      {ROWS.map((row) => (
        <View key={row.join('')} style={styles.row}>
          {row.map(renderKey)}
        </View>
      ))}
      <View style={styles.row}>
        <View style={styles.emptyKey} />
        {renderKey('0')}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete"
          style={({ pressed }) => [
            styles.keyButton,
            styles.emptyKey,
            pressed && !disabled && styles.keyButtonPressed,
            disabled && styles.keyButtonDisabled,
          ]}
          onPress={handleDelete}
          disabled={disabled}
          collapsable={false}
          removeClippedSubviews={false}
          {...(Platform.OS === 'ios' && {
            accessible: true,
            keyboardShouldPersistTaps: 'handled',
          })}
        >
          <Delete size={26} color={disabled ? colors.textTertiary : colors.text} />
        </Pressable>
      </View>
    </View>
  );
}
