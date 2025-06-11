import { View, TextInput, StyleSheet } from 'react-native';
import { useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

type PinInputProps = {
  length: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
};

export default function PinInput({ length, value, onChange, autoFocus = false }: PinInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  
  useEffect(() => {
    if (autoFocus) {
      // Delay focus to ensure component is fully mounted
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);
  
  const handleChange = (text: string) => {
    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, '');
    
    // Limit to specified length
    if (numericValue.length <= length) {
      onChange(numericValue);
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
            { 
              backgroundColor: i < value.length ? colors.primary : colors.surface,
              borderColor: colors.border
            }
          ]}
        />
      );
    }
    
    return dots;
  };
  
  const styles = createStyles(colors);
  
  return (
    <View style={styles.container}>
      <View style={styles.dotsContainer}>
        {renderPinDots()}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        caretHidden
      />
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
});