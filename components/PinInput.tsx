import { View, TextInput, StyleSheet } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

type PinInputProps = {
  length: number;
  value: string;
  onChange: (value: string) => void;
};

export default function PinInput({ length, value, onChange }: PinInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    // Focus the input when the component mounts
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  const handleChange = (text: string) => {
    // Only allow numbers and limit to the specified length
    const numericText = text.replace(/[^0-9]/g, '');
    if (numericText.length <= length) {
      onChange(numericText);
    }
  };

  const renderPinDots = () => {
    const dots = [];
    for (let i = 0; i < length; i++) {
      dots.push(
        <View
          key={i}
          style={[
            styles.dot,
            value.length > i && styles.filledDot,
            focused && i === value.length && styles.activeDot,
            { backgroundColor: value.length > i ? colors.primary : colors.backgroundTertiary }
          ]}
        />
      );
    }
    return dots;
  };

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.dotsContainer}>{renderPinDots()}</View>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 24,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filledDot: {
    borderColor: colors.primary,
  },
  activeDot: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
});