import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface OnScreenKeypadProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onClear?: () => void;
  showDecimal?: boolean;
  disabled?: boolean;
}

export default function OnScreenKeypad({
  onKeyPress,
  onDelete,
  onClear,
  showDecimal = false,
  disabled = false,
}: OnScreenKeypadProps) {
  const { colors, isDark } = useTheme();
  
  const handleKeyPress = (key: string) => {
    if (disabled) return;
    onKeyPress(key);
  };
  
  const handleDelete = () => {
    if (disabled) return;
    onDelete();
  };
  
  const handleClear = () => {
    if (disabled || !onClear) return;
    onClear();
  };
  
  const styles = createStyles(colors, isDark);
  
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable 
          style={styles.key} 
          onPress={() => handleKeyPress('1')}
          disabled={disabled}
        >
          <Text style={styles.keyText}>1</Text>
        </Pressable>
        <Pressable 
          style={styles.key} 
          onPress={() => handleKeyPress('2')}
          disabled={disabled}
        >
          <Text style={styles.keyText}>2</Text>
        </Pressable>
        <Pressable 
          style={styles.key} 
          onPress={() => handleKeyPress('3')}
          disabled={disabled}
        >
          <Text style={styles.keyText}>3</Text>
        </Pressable>
      </View>
      
      <View style={styles.row}>
        <Pressable 
          style={styles.key} 
          onPress={() => handleKeyPress('4')}
          disabled={disabled}
        >
          <Text style={styles.keyText}>4</Text>
        </Pressable>
        <Pressable 
          style={styles.key} 
          onPress={() => handleKeyPress('5')}
          disabled={disabled}
        >
          <Text style={styles.keyText}>5</Text>
        </Pressable>
        <Pressable 
          style={styles.key} 
          onPress={() => handleKeyPress('6')}
          disabled={disabled}
        >
          <Text style={styles.keyText}>6</Text>
        </Pressable>
      </View>
      
      <View style={styles.row}>
        <Pressable 
          style={styles.key} 
          onPress={() => handleKeyPress('7')}
          disabled={disabled}
        >
          <Text style={styles.keyText}>7</Text>
        </Pressable>
        <Pressable 
          style={styles.key} 
          onPress={() => handleKeyPress('8')}
          disabled={disabled}
        >
          <Text style={styles.keyText}>8</Text>
        </Pressable>
        <Pressable 
          style={styles.key} 
          onPress={() => handleKeyPress('9')}
          disabled={disabled}
        >
          <Text style={styles.keyText}>9</Text>
        </Pressable>
      </View>
      
      <View style={styles.row}>
        {showDecimal ? (
          <Pressable 
            style={styles.key} 
            onPress={() => handleKeyPress('.')}
            disabled={disabled}
          >
            <Text style={styles.keyText}>.</Text>
          </Pressable>
        ) : (
          <Pressable 
            style={[styles.key, styles.clearKey]} 
            onPress={handleClear}
            disabled={disabled || !onClear}
          >
            <Text style={[styles.keyText, styles.clearText]}>Clear</Text>
          </Pressable>
        )}
        
        <Pressable 
          style={styles.key} 
          onPress={() => handleKeyPress('0')}
          disabled={disabled}
        >
          <Text style={styles.keyText}>0</Text>
        </Pressable>
        
        <Pressable 
          style={[styles.key, styles.deleteKey]} 
          onPress={handleDelete}
          disabled={disabled}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: isDark ? colors.backgroundSecondary : colors.backgroundTertiary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  key: {
    flex: 1,
    aspectRatio: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  deleteKey: {
    backgroundColor: colors.backgroundTertiary,
  },
  clearKey: {
    backgroundColor: colors.backgroundTertiary,
  },
  clearText: {
    fontSize: 16,
    color: colors.primary,
  },
});