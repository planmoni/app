import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { ChevronRight, X, Mail, Lock, Shield, Fingerprint, CircleAlert as AlertCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import * as SecureStore from 'expo-secure-store';

type PendingAction = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  iconBg: string;
  iconColor: string;
  route: string;
  priority: 'high' | 'medium' | 'low';
};

// Storage key for completed actions
const COMPLETED_ACTIONS_KEY = 'completed_pending_actions';

export default function PendingActionsCard() {
  const { colors, isDark } = useTheme();
  const [isHidden, setIsHidden] = useState(false);
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const haptics = useHaptics();

  // Load completed actions from storage on mount
  useEffect(() => {
    const loadCompletedActions = async () => {
      try {
        const storedActions = await SecureStore.getItemAsync(COMPLETED_ACTIONS_KEY);
        if (storedActions) {
          setCompletedActions(JSON.parse(storedActions));
        }
      } catch (error) {
        console.error('Error loading completed actions:', error);
      }
    };

    loadCompletedActions();
  }, []);

  const pendingActions: PendingAction[] = [
    {
      id: 'verify-email',
      title: 'Verify your email address',
      description: 'Confirm your email to secure your account',
      icon: Mail,
      iconBg: '#EFF6FF',
      iconColor: '#1E3A8A',
      route: '/verify-email',
      priority: 'high',
    },
    {
      id: 'setup-app-lock',
      title: 'Setup App Lock Screen',
      description: 'Add an extra layer of security to your app',
      icon: Lock,
      iconBg: '#F0FDF4',
      iconColor: '#22C55E',
      route: '/app-lock-setup',
      priority: 'high',
    },
    {
      id: 'account-verification',
      title: 'Start Account Verification',
      description: 'Verify your identity to unlock higher limits',
      icon: Shield,
      iconBg: '#FEF3C7',
      iconColor: '#D97706',
      route: '/kyc-upgrade',
      priority: 'medium',
    },
    {
      id: 'setup-2fa',
      title: 'Setup 2FA',
      description: 'Add two-factor authentication for better security',
      icon: Fingerprint,
      iconBg: '#F5F3FF',
      iconColor: '#8B5CF6',
      route: '/two-factor-auth',
      priority: 'medium',
    },
  ];

  // Mark an action as completed
  const markActionAsCompleted = async (actionId: string) => {
    try {
      const updatedCompletedActions = [...completedActions, actionId];
      setCompletedActions(updatedCompletedActions);
      await SecureStore.setItemAsync(COMPLETED_ACTIONS_KEY, JSON.stringify(updatedCompletedActions));
      haptics.success();
    } catch (error) {
      console.error('Error marking action as completed:', error);
    }
  };

  // Handle navigation to action route
  const handleActionPress = (action: PendingAction) => {
    haptics.mediumImpact();
    router.push(action.route);
  };

  // Handle completing an action
  const handleCompleteAction = (actionId: string, event: any) => {
    event.stopPropagation();
    markActionAsCompleted(actionId);
    haptics.success();
  };

  if (isHidden) {
    return null;
  }

  // Filter out completed actions
  const filteredActions = pendingActions.filter(action => !completedActions.includes(action.id));

  // Don't render if there are no pending actions
  if (filteredActions.length === 0) {
    return null;
  }

  const styles = createStyles(colors, isDark);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pending Actions</Text>
        <Pressable onPress={() => setIsHidden(true)} style={styles.hideButton}>
          <X size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filteredActions.map((action) => (
          <Pressable 
            key={action.id} 
            style={styles.actionCard}
            onPress={() => handleActionPress(action)}
          >
            <View style={[styles.iconContainer, { backgroundColor: action.iconBg }]}>
              <action.icon size={24} color={action.iconColor} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionDescription}>{action.description}</Text>
            </View>
            <View style={styles.actionButtons}>
              <Pressable 
                style={styles.completeButton} 
                onPress={(e) => handleCompleteAction(action.id, e)}
              >
                <Text style={styles.completeButtonText}>Done</Text>
              </Pressable>
              <View style={styles.actionArrow}>
                <ChevronRight size={20} color={colors.textTertiary} />
              </View>
            </View>
            {action.priority === 'high' && (
              <View style={styles.priorityBadge}>
                <AlertCircle size={12} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    marginBottom: 24,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  hideButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  actionCard: {
    width: 280,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
    marginRight: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  actionButtons: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  completeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.successLight,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.success,
  },
  completeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.success,
  },
  actionArrow: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
});