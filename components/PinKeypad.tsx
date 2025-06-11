import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface PinKeypadProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  disabled?: boolean;
}

export default function PinKeypad({ onKeyPress, onDelete, disabled = false }: PinKeypadProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
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
        {
          width: keySize,
          height: keySize,
          borderRadius: keySize / 2,
          backgroundColor: isDark ? colors.backgroundSecondary : colors.backgroundTertiary,
          borderColor: colors.border,
        },
        pressed && styles.keyButtonPressed,
        disabled && styles.keyButtonDisabled
      ]}
      onPress={() => handleKeyPress(key)}
      disabled={disabled}
    >
      <Text style={[
        styles.keyText, 
        { 
          fontSize: keyTextSize,
          color: disabled ? colors.textTertiary : colors.text 
        }
      ]}>
        {key}
      </Text>
    </Pressable>
  );

  // Calculate responsive sizes
  const keySize = isSmallScreen ? 60 : 70;
  const keyTextSize = isSmallScreen ? 20 : 24;
  const keypadWidth = keySize * 3 + 16 * 2; // 3 keys + 2 gaps
  
  const styles = StyleSheet.create({
    container: {
      width: keypadWidth,
      alignSelf: 'center',
      marginTop: isSmallScreen ? 16 : 24,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: isSmallScreen ? 12 : 16,
    },
    keyButton: {
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
    },
    keyButtonPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.95 }],
    },
    keyButtonDisabled: {
      opacity: 0.5,
    },
    keyText: {
      fontWeight: '600',
    },
    emptyKey: {
      width: keySize,
      height: keySize,
    },
  });

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
            {
              width: keySize,
              height: keySize,
              borderRadius: keySize / 2,
              backgroundColor: isDark ? colors.backgroundSecondary : colors.backgroundTertiary,
              borderColor: colors.border,
            },
            pressed && styles.keyButtonPressed,
            disabled && styles.keyButtonDisabled
          ]}
          onPress={handleDelete}
          disabled={disabled}
        >
          <X size={keyTextSize} color={disabled ? colors.textTertiary : colors.text} />
        </Pressable>
      </View>
    </View>
  );
}