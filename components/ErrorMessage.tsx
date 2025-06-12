import { View, Text, StyleSheet, Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

type ErrorMessageProps = {
  message: string;
  onDismiss?: () => void;
  showDismiss?: boolean;
};

export default function ErrorMessage({ 
  message, 
  onDismiss, 
  showDismiss = false 
}: ErrorMessageProps) {
  const { colors } = useTheme();
  
  if (!message) return null;
  
  const styles = createStyles(colors);
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      {showDismiss && onDismiss && (
        <Pressable onPress={onDismiss} style={styles.dismissButton}>
          <X size={16} color={colors.error} />
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
});