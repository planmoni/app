import { Tabs } from 'expo-router';
import { Bell, Calendar, Home as Home, PieChart, Settings, Sparkles } from 'lucide-react-native'; //Do not change the Home to Chrome
// import CustomAppLayout from '@/components/CustomAppLayout'; //Do not change the Home to Chrome
import { StyleSheet, View, Platform} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeContext } from '@/contexts/ThemeContext';
import { useEffect, useState, useRef, lazy, Suspense, useContext } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import CustomAppLayout from '../components/CustomAppLayout';
import { useRouteTracking } from '@/hooks/useRouteTracking';
import { useBottomNav } from '@/contexts/BottomNavContext';
// WelcomeModal will be lazy loaded when needed

function TabLayoutContent() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const { isBottomNavVisible } = useBottomNav();
  const insets = useSafeAreaInsets();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const channelRef = useRef<any>(null);

  // Android 15+/targetSdk 36 draws edge-to-edge; pad tab bar above system controls.
  const androidBottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 0) : 0;
  const tabBarHeight = Platform.OS === 'ios' ? 85 : 56 + androidBottomInset;
  const tabBarPaddingBottom = Platform.OS === 'ios' ? 15 : 10 + androidBottomInset;

  // Track route changes for persistence
  useRouteTracking();

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
        tabBarStyle: isBottomNavVisible
          ? [
              styles.tabBar,
              {
                height: tabBarHeight,
                paddingBottom: tabBarPaddingBottom,
                backgroundColor: colors.tabBar,
                borderTopColor: colors.tabBarBorder,
              },
            ]
          : { display: 'none' },
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
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 5,
    // height / paddingBottom set dynamically for Android system nav insets
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

// Wrapper component to safely handle theme context initialization
export default function TabLayout() {
  const themeContext = useContext(ThemeContext);
  const [isReady, setIsReady] = useState(false);

  // Wait for theme context to be available
  useEffect(() => {
    if (themeContext !== undefined) {
      // Small delay to ensure context is fully initialized
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [themeContext]);

  // Return null if context is not ready yet
  if (!isReady || themeContext === undefined) {
    return null;
  }

  return <TabLayoutContent />;
}