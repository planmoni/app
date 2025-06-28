import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { ChevronRight, X, Mail, Lock, Shield, Fingerprint, CircleAlert as AlertCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOnlineStatus } from './OnlineStatusProvider';
import OfflineNotice from './OfflineNotice';

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

export default function PendingActionsCard() {
  const { colors, isDark } = useTheme();
  const [isHidden, setIsHidden] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { session } = useAuth();
  const haptics = useHaptics();
  const { isOnline } = useOnlineStatus();

  // Load profile data from database on mount
  useEffect(() => {
    if (session?.user?.id) {
      fetchProfileData();
    }
  }, [session?.user?.id]);

  const fetchProfileData = async () => {
    if (!isOnline) {
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      // Use .maybeSingle() instead of .single() to handle cases where no profile exists
      const { data, error } = await supabase
        .from('profiles')
        .select('email_verified, app_lock_enabled, two_factor_enabled, account_verified')
        .eq('id', session?.user?.id)
        .maybeSingle();

      if (error) throw error;
      
      // If no profile exists, create default values
      if (!data) {
        console.log('No profile found for user, using default values');
        setProfileData({
          email_verified: false,
          app_lock_enabled: false,
          two_factor_enabled: false,
          account_verified: false
        });
      } else {
        setProfileData(data);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      // Set default values on error to prevent app from breaking
      setProfileData({
        email_verified: false,
        app_lock_enabled: false,
        two_factor_enabled: false,
        account_verified: false
      });
    } finally {
      setIsLoading(false);
    }
  };

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

  // Mark an action as completed in the database
  const markActionAsCompleted = async (actionId: string) => {
    if (!isOnline) {
      haptics.error();
      return;
    }
    
    try {
      const updates: any = {};
      
      switch (actionId) {
        case 'verify-email':
          updates.email_verified = true;
          break;
        case 'setup-app-lock':
          updates.app_lock_enabled = true;
          break;
        case 'account-verification':
          updates.account_verified = true;
          break;
        case 'setup-2fa':
          updates.two_factor_enabled = true;
          break;
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', session?.user?.id);
          
      if (error) throw error;
      
      // Refresh profile data
      await fetchProfileData();
      haptics.success();
    } catch (error) {
      console.error('Error marking action as completed:', error);
      haptics.error();
    }
  };

  // Check if an action is completed
  const isActionCompleted = (actionId: string): boolean => {
    if (!profileData) return false;
    
    switch (actionId) {
      case 'verify-email':
        return !!profileData.email_verified || !!session?.user?.email_confirmed_at;
      case 'setup-app-lock':
        return !!profileData.app_lock_enabled;
      case 'account-verification':
        return !!profileData.account_verified;
      case 'setup-2fa':
        return !!profileData.two_factor_enabled;
      default:
        return false;
    }
  };

  // Handle navigation to action route
  const handleActionPress = (action: PendingAction) => {
    haptics.mediumImpact();
    router.push(action.route);
  };

  // Handle completing an action
  const handleCompleteAction = async (actionId: string, event: any) => {
    event.stopPropagation();
    await markActionAsCompleted(actionId);
  };

  if (isHidden) {
    return null;
  }

  // Filter out completed actions
  const filteredActions = pendingActions.filter(action => !isActionCompleted(action.id));

  // Don't render if there are no pending actions
  if (filteredActions.length === 0 && !isLoading) {
    return null;
  }

  const styles = createStyles(colors, isDark);

  if (!isOnline) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Pending Actions</Text>
          <Pressable onPress={() => setIsHidden(true)} style={styles.hideButton}>
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        <OfflineNotice message="Pending actions are unavailable while offline" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pending Actions</Text>
        <Pressable onPress={() => setIsHidden(true)} style={styles.hideButton}>
          <X size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading pending actions...</Text>
        </View>
      ) : (
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
      )}
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
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});