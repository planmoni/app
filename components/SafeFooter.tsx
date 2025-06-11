import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

type SafeFooterProps = {
  backgroundColor?: string;
  borderTopWidth?: number;
  borderTopColor?: string;
};

export default function SafeFooter({
  backgroundColor,
  borderTopWidth,
  borderTopColor,
}: SafeFooterProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  return (
    <View
      style={[
        styles.footer,
        {
          height: insets.bottom || 16,
          backgroundColor: backgroundColor || colors.surface,
          borderTopWidth: borderTopWidth !== undefined ? borderTopWidth : 1,
          borderTopColor: borderTopColor || colors.border,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  footer: {
    width: '100%',
  },
});