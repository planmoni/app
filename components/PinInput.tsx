import React from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface PinInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
}

export default function PinInput({ length, value, onChange }: PinInputProps) {
  const { colors } = useTheme();
  const inputRefs = React.useRef<(TextInput | null)[]>([]);
  
  const handleChangeText = (text: string, index: number) => {
    // Only allow numeric input
    const numericText = text.replace(/[^0-9]/g, '');
    
    if (numericText.length > 1) {
      // Handle paste scenario
      const pastedValue = numericText.slice(0, length);
      onChange(pastedValue);
      
      // Focus the last filled input or the next empty one
      const nextIndex = Math.min(pastedValue.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }
    
    // Build new value
    const newValue = value.split('');
    newValue[index] = numericText;
    const updatedValue = newValue.join('').slice(0, length);
    
    onChange(updatedValue);
    
    // Auto-focus next input
    if (numericText && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };
  
  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !value[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };
  
  const handleInputPress = (index: number) => {
    // Focus the first empty input or the pressed input
    const firstEmptyIndex = value.length;
    const targetIndex = Math.min(firstEmptyIndex, index);
    inputRefs.current[targetIndex]?.focus();
  };
  
  const styles = createStyles(colors);
  
  return (
    <View style={styles.container}>
      {Array.from({ length }, (_, index) => (
        <Pressable
          key={index}
          onPress={() => handleInputPress(index)}
          style={styles.inputWrapper}
        >
          <TextInput
            ref={(ref) => (inputRefs.current[index] = ref)}
            style={[
              styles.input,
              value[index] && styles.inputFilled,
            ]}
            value={value[index] || ''}
            onChangeText={(text) => handleChangeText(text, index)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
            keyboardType="numeric"
            maxLength={1}
            selectTextOnFocus
            textAlign="center"
            secureTextEntry
          />
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  inputWrapper: {
    width: 50,
    height: 60,
  },
  input: {
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.surface,
    textAlign: 'center',
  },
  inputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
});