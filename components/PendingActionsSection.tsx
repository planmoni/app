import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Mail, Lock, Shield, Fingerprint, Bell } from 'lucide-react-native';
import PendingActionCard from './PendingActionCard';
import { useAuth } from '@/contexts/AuthContext';

export default function PendingActionsSection() {
  const { colors } = useTheme();
  const { session } = useAuth();
  
  // Mock data for pending actions
  // In a real app, these would be determined by checking user state
  const pendingActions = [
    {
      id: 'verify-email',
      title: 'Verify your email address',
      description: 'Confirm your email to secure your account',
      icon: <Mail size={20} color="#EF4444" />,
      route: '/profile',
      priority: 'high' as const,
      // Only show if email is not verified
      show: session?.user?.email_confirmed_at ? false : true,
    },
    {
      id: 'setup-app-lock',
      title: 'Setup App Lock Screen',
      description: 'Add an extra layer of security to your app',
      icon: <Lock size={20} color="#F59E0B" />,
      route: '/two-factor-auth',
      priority: 'medium' as const,
      show: true, // Always show for demo
    },
    {
      id: 'account-verification',
      title: 'Start Account Verification',
      description: 'Verify your identity to unlock higher limits',
      icon: <Shield size={20} color="#F59E0B" />,
      route: '/transaction-limits',
      priority: 'medium' as const,
      show: true, // Always show for demo
    },
    {
      id: 'setup-2fa',
      title: 'Setup 2FA',
      description: 'Enable two-factor authentication for better security',
      icon: <Fingerprint size={20} color="#1E3A8A" />,
      route: '/two-factor-auth',
      priority: 'low' as const,
      show: true, // Always show for demo
    },
    {
      id: 'enable-notifications',
      title: 'Enable Notifications',
      description: 'Stay updated with important account activities',
      icon: <Bell size={20} color="#3B82F6" />,
      route: '/(tabs)/settings',
      priority: 'low' as const,
      show: true, // Always show for demo
    },
  ];
  
  // Filter actions to only show relevant ones
  const visibleActions = pendingActions.filter(action => action.show);
  
  // Don't render the section if there are no pending actions
  if (visibleActions.length === 0) {
    return null;
  }
  
  const styles = createStyles(colors);
  
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pending Actions</Text>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsContainer}
      >
        {visibleActions.map((action) => (
          <PendingActionCard
            key={action.id}
            title={action.title}
            description={action.description}
            icon={action.icon}
            route={action.route}
            priority={action.priority}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cardsContainer: {
    paddingRight: 8,
  },
});