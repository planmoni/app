import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

type PendingActionCardProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  priority?: 'high' | 'medium' | 'low';
};

export default function PendingActionCard({
  title,
  description,
  icon,
  route,
  priority = 'medium'
}: PendingActionCardProps) {
  const { colors } = useTheme();
  
  const handlePress = () => {
    router.push(route);
  };
  
  const styles = createStyles(colors, priority);
  
  return (
    <Pressable 
      style={styles.card}
      onPress={handlePress}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {icon}
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
        <ChevronRight size={20} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

const createStyles = (colors: any, priority: 'high' | 'medium' | 'low') => {
  // Define colors based on priority
  const getPriorityColors = () => {
    switch (priority) {
      case 'high':
        return {
          border: '#EF4444',
          background: '#FEF2F2',
        };
      case 'medium':
        return {
          border: '#F59E0B',
          background: '#FEF3C7',
        };
      case 'low':
        return {
          border: '#3B82F6',
          background: '#EFF6FF',
        };
      default:
        return {
          border: '#3B82F6',
          background: '#EFF6FF',
        };
    }
  };
  
  const priorityColors = getPriorityColors();
  
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      marginRight: 16,
      width: 280,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      borderLeftColor: priorityColors.border,
      overflow: 'hidden',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: priorityColors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
      marginRight: 8,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    description: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
    },
  });
};