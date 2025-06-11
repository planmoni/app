import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface PinKeypadProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  disabled?: boolean;
}

export default function PinKeypad({ onKeyPress, onDelete, disabled = false }: PinKeypadProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const handleKeyPress = (key: string) => {
    if (!disabled) {
      onKeyPress(key);
    }
  };

  const handleDelete = () => {
    if (!disabled) {
      onDelete();
    }
  };

  const renderKey = (key: string) => (
    <Pressable
      key={key}
      style={({ pressed }) => [
        styles.keyButton,
        pressed && styles.keyButtonPressed,
        disabled && styles.keyButtonDisabled
      ]}
      onPress={() => handleKeyPress(key)}
      disabled={disabled}
    >
      <Text style={[styles.keyText, disabled && styles.keyTextDisabled]}>{key}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {renderKey('1')}
        {renderKey('2')}
        {renderKey('3')}
      </View>
      <View style={styles.row}>
        {renderKey('4')}
        {renderKey('5')}
        {renderKey('6')}
      </View>
      <View style={styles.row}>
        {renderKey('7')}
        {renderKey('8')}
        {renderKey('9')}
      </View>
      <View style={styles.row}>
        <View style={styles.emptyKey} />
        {renderKey('0')}
        <Pressable
          style={({ pressed }) => [
            styles.keyButton,
            pressed && styles.keyButtonPressed,
            disabled && styles.keyButtonDisabled
          ]}
          onPress={handleDelete}
          disabled={disabled}
        >
          <X size={24} color={disabled ? colors.textTertiary : colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  keyButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  keyButtonPressed: {
    backgroundColor: colors.backgroundSecondary,
    transform: [{ scale: 0.95 }],
  },
  keyButtonDisabled: {
    opacity: 0.5,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  keyTextDisabled: {
    color: colors.textTertiary,
  },
  emptyKey: {
    width: 70,
    height: 70,
  },
});