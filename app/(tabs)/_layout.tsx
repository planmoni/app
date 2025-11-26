import { Tabs } from 'expo-router';
import { Bell, Calendar, Home as Home, ChartPie as PieChart, Settings, Sparkles } from 'lucide-react-native'; //Do not change the Home to Chrome
// import CustomAppLayout from '@/components/CustomAppLayout'; //Do not change the Home to Chrome
import { StyleSheet, View, Platform} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import CustomAppLayout from '../components/CustomAppLayout';
import { useRouteTracking } from '@/hooks/useRouteTracking';
import { useBottomNav } from '@/contexts/BottomNavContext';
// WelcomeModal will be lazy loaded when needed

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const { isBottomNavVisible } = useBottomNav();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [WelcomeModalComponent, setWelcomeModalComponent] = useState<React.ComponentType<any> | null>(null);
  const channelRef = useRef<any>(null);
  const welcomeModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lazy load WelcomeModal when needed
  useEffect(() => {
    if (showWelcomeModal && !WelcomeModalComponent) {
      import('@/components/WelcomeModal').then(module => {
        setWelcomeModalComponent(() => module.default);
      });
    }
  }, [showWelcomeModal, WelcomeModalComponent]);

  // Track route changes for persistence
  useRouteTracking();

  // Show WelcomeModal 5 seconds after mount when unauthenticated
  useEffect(() => {
    if (!session?.user?.id) {
      // Clear any existing timer
      if (welcomeModalTimerRef.current) {
        clearTimeout(welcomeModalTimerRef.current);
        welcomeModalTimerRef.current = null;
      }

      // Set timer to show modal after 5 seconds
      welcomeModalTimerRef.current = setTimeout(() => {
        setShowWelcomeModal(true);
      }, 5000);

      return () => {
        if (welcomeModalTimerRef.current) {
          clearTimeout(welcomeModalTimerRef.current);
          welcomeModalTimerRef.current = null;
        }
      };
    } else {
      // If user becomes authenticated, hide the modal and clear timer
      setShowWelcomeModal(false);
      if (welcomeModalTimerRef.current) {
        clearTimeout(welcomeModalTimerRef.current);
        welcomeModalTimerRef.current = null;
      }
    }
  }, [session?.user?.id]);

  useEffect(() => {
    // Check if Supabase is properly configured
    const isConfigured = isSupabaseConfigured();
    if (!isConfigured) {
      console.log('Supabase config check completed');
      return;
    }

    if (!session?.user?.id) return;

    // Clean up any existing channel
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (err) {
        // Ignore errors
      }
      channelRef.current = null;
    }

    // Initial fetch of unread notifications count
    fetchUnreadNotificationsCount();

    // Poll for updates every 30 seconds instead of real-time subscription
    // Server-side push notifications handle delivery when app is closed
    const pollInterval = setInterval(() => {
      fetchUnreadNotificationsCount();
    }, 30000); // Poll every 30 seconds

    return () => {
      clearInterval(pollInterval);
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (err) {
          // Ignore errors
        }
        channelRef.current = null;
      }
    };
  }, [session?.user?.id]);

  const fetchUnreadNotificationsCount = async () => {
    try {
      // Check if Supabase is properly configured
      const isConfigured = isSupabaseConfigured();
      if (!isConfigured) {
        console.log('Notifications fetch skipped');
        return;
      }

      if (!session?.user?.id) {
        console.warn('No user session available for fetching notifications');
        return;
      }

      const { count, error } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('status', 'unread');

      if (error) {
        console.error('Supabase error fetching unread notifications:', error);
        return;
      }

      setUnreadNotifications(count || 0);
    } catch (error) {
      console.error('Error fetching unread notifications count:', error);
      // Don't throw the error, just log it and continue
      // This prevents the app from crashing due to network issues
    }
  };

  // Use darker color for inactive icons on Android in light mode for better visibility
  const getInactiveTintColor = () => {
    if (Platform.OS === 'android' && !isDark) {
      // Use textSecondary instead of textTertiary for better contrast on white background
      return colors.textSecondary;
    }
    return colors.textTertiary;
  };

  return (
    <>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: isDark ? colors.text : colors.primary,
        tabBarInactiveTintColor: getInactiveTintColor(),
        tabBarStyle: isBottomNavVisible ? [styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder }] : { display: 'none' },
        // tabBarStyle: [styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder }],
        tabBarLabelStyle: styles.tabBarLabel,
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai-assistant"
        options={{
          title: 'AI',
          tabBarIcon: ({ color, size }) => <Sparkles size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => <PieChart size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
      {showWelcomeModal && WelcomeModalComponent && (
        <WelcomeModalComponent
          isVisible={showWelcomeModal}
          onClose={() => setShowWelcomeModal(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 85 : 100,
    paddingBottom: Platform.OS === 'ios' ? 15 : 10 ,
    paddingTop: 5,
  },
  tabBarLabel: {
    fontSize: Platform.OS === 'ios' ? 12 : 10,
    fontWeight: '500',
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});