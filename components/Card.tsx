import { View, Text, StyleSheet, ViewProps } from 'react-native';
import { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

type CardProps = ViewProps & {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function Card({ title, children, footer, style, ...props }: CardProps) {
  const { colors, isDark } = useTheme();
  
  const styles = createStyles(colors, isDark);

  return (
    <View style={[styles.card, style]} {...props}>
      {title && (
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
      )}
      
      <View style={styles.cardBody}>
        {children}
      </View>
      
      {footer && (
        <View style={styles.cardFooter}>
          {footer}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    // Conditional styling based on theme
    ...(isDark ? {
      // Dark mode: Use border instead of shadow for better visual separation
      borderWidth: 1,
      borderColor: colors.border,
      // Minimal shadow for depth
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    } : {
      // Light mode: Use subtle shadow without border
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    }),
  },
  cardHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cardBody: {
    padding: 16,
  },
  cardFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});