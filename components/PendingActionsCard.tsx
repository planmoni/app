import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { ChevronRight, X, Mail, Lock, Shield, Fingerprint, CircleAlert as AlertCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePin } from '@/contexts/PinContext';
import { useOnlineStatus } from './OnlineStatusProvider';
import OfflineNotice from './OfflineNotice';

type PendingAction = {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  iconBg: string;
  iconColor: string;
  route: string;
  priority: 'high' | 'medium' | 'low';
};

export default function PendingActionsCard() {
  const { colors, isDark } = useTheme();
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const { session } = useAuth();
  const { hasAppLockPin } = usePin();
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
      // Modify the query to exclude kyc_tier which doesn't exist yet
      const { data, error } = await supabase
        .from('profiles')
        .select('email_verified, app_lock_enabled, two_factor_enabled, account_verified')
        .eq('id', session?.user?.id)
        .single();

      if (error) throw error;
      setProfileData(data);
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const pendingActions: PendingAction[] = [
    {
      id: 'account-verification',
      title: 'Start KYC Verification',
      icon: Shield,
      iconBg: colors.backgroundTertiary,
      iconColor: colors.text,
      route: '/kyc-upgrade',
      priority: 'high',
    },
    {
      id: 'verify-email',
      title: 'Verify your email address',
      icon: Mail,
      iconBg: colors.backgroundTertiary,
      iconColor: colors.text,
      route: '/verify-email',
      priority: 'high',
    },
    {
      id: 'setup-app-lock',
      title: 'Setup App PIN',
      icon: Lock,
      iconBg: colors.backgroundTertiary,
      iconColor: colors.text,
      route: '/settings/setup-pin',
      priority: 'high',
    },
    
    {
      id: 'setup-2fa',
      title: 'Setup 2FA',
      icon: Fingerprint,
      iconBg: colors.backgroundTertiary,
      iconColor: colors.text,
      route: '/two-factor-auth',
      priority: 'medium',
    },
  ];

  // Check if an action is completed
  const isActionCompleted = (actionId: string): boolean => {
    if (!profileData) return false;
    
    switch (actionId) {
      case 'verify-email':
        return !!profileData.email_verified || !!session?.user?.email_confirmed_at;
      case 'setup-app-lock':
        return hasAppLockPin;
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

  // Filter out completed actions
  const filteredActions = pendingActions.filter(action => !isActionCompleted(action.id));

  // Create styles before any conditional returns
  const styles = createStyles(colors, isDark);

  // Don't render if there are no pending actions and data is loaded
  if (!isLoading && filteredActions.length === 0) {
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <View>
        <Text style={styles.sectionTitle}>Pending Actions</Text>
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading pending actions...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <View>
        <Text style={styles.sectionTitle}>Pending Actions</Text>
        <View style={styles.container}>
          <OfflineNotice message="Pending actions are unavailable while offline" />
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>Pending Actions</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${((pendingActions.length - filteredActions.length) / pendingActions.length) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(((pendingActions.length - filteredActions.length) / pendingActions.length) * 100)}%
          </Text>
        </View>
      </View>
      <View style={styles.container}>
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
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 10,
    borderRadius: 16,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 1,
    gap: 12,
  },
  actionCard: {
    width: Platform.OS === 'ios' ? 280 : 240,
    backgroundColor: colors.card,
    borderRadius: 12,
    height: 110,
    padding: 16,
    borderWidth: 0.5,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 6},
    shadowOpacity: 0.05,
    shadowRadius: 9,
    elevation: 9,
  
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconContainer: {
    width: Platform.OS === 'ios' ? 48 : 40,
    height: Platform.OS === 'ios' ? 48 : 40,
    borderRadius: Platform.OS === 'ios' ? 24 : 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Platform.OS === 'ios' ? 12 : 10,
  },
  actionContent: {
    flex: 1,
    marginRight: 8,
  },
  actionTitle: {
    fontSize: Platform.OS === 'ios' ? 15 : 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 10,
  },
  actionDescription: {
    fontSize: Platform.OS === 'ios' ? 13 : 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  actionButtons: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  actionArrow: {
    width: Platform.OS === 'ios' ? 24 : 20,
    height: Platform.OS === 'ios' ? 24 : 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: Platform.OS === 'ios' ? 16 : 12,
    height: Platform.OS === 'ios' ? 16 : 12,
    borderRadius: Platform.OS === 'ios' ? 8 : 6,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: -20,
    marginTop: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: -20,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 3,
    width: 60,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    minWidth: 25,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});