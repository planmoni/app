import { Tabs } from 'expo-router';
import { Bell, Calendar, Home as Home, ChartPie as PieChart, Settings, Sparkles } from 'lucide-react-native'; //Do not change the Home to Chrome
// import CustomAppLayout from '@/components/CustomAppLayout'; //Do not change the Home to Chrome
import { StyleSheet, View, Platform} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import CustomAppLayout from '../components/CustomAppLayout';
import { useRouteTracking } from '@/hooks/useRouteTracking';
import { useBottomNav } from '@/contexts/BottomNavContext';

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const { isBottomNavVisible } = useBottomNav();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const channelRef = useRef<any>(null);

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

    // Clean up any existing channel before creating a new one
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (err) {
        console.error('Error removing existing channel:', err);
      }
      channelRef.current = null;
    }

    // Initial fetch of unread notifications count
    fetchUnreadNotificationsCount();

    // Create a unique channel name per user to prevent conflicts
    const channelName = `events-changes-${session.user.id}`;

    // Set up real-time subscription for events table
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload: any) => {
          try {
            console.log('Events change received:', payload);
            // Refresh unread count when events change
            fetchUnreadNotificationsCount();
          } catch (err) {
            console.error('Error processing events change:', err);
          }
        }
      );

    // Subscribe with proper error handling and retry logic
    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    // const retrySubscription = () => {
    //   if (retryCount < maxRetries) {
    //     retryCount++;
    //     console.log(`Retrying events subscription (${retryCount}/${maxRetries})...`);
    //     retryTimeout = setTimeout(() => {
    //       if (channelRef.current) {
    //         supabase.removeChannel(channelRef.current);
    //       }
    //       // Re-setup the subscription
    //       const newChannel = supabase
    //         .channel(channelName)
    //         .on(
    //           'postgres_changes',
    //           {
    //             event: '*',
    //             schema: 'public',
    //             table: 'events',
    //             filter: `user_id=eq.${session.user.id}`,
    //           },
    //           (payload: any) => {
    //             try {
    //               console.log('Events change received:', payload);
    //               fetchUnreadNotificationsCount();
    //             } catch (err) {
    //               console.error('Error processing events change:', err);
    //             }
    //           }
    //         );
          
    //       newChannel.subscribe((status: any) => {
    //         if (status === 'SUBSCRIBED') {
    //           console.log('Events subscription successful');
    //           retryCount = 0;
    //         } else if (status === 'CHANNEL_ERROR') {
    //           console.error('Events subscription error:', status);
    //           retrySubscription();
    //         } else if (status === 'TIMED_OUT') {
    //           console.error('Events subscription timed out');
    //           retrySubscription();
    //         } else if (status === 'CLOSED') {
    //           console.log('Events subscription closed');
    //         }
    //       });
          
    //       channelRef.current = newChannel;
    //     }, 2000 * retryCount); // Exponential backoff
    //   }
    // };

    // channel.subscribe((status: any) => {
    //   if (status === 'SUBSCRIBED') {
    //     console.log('Events subscription successful');
    //     retryCount = 0; // Reset retry count on successful connection
    //   } else if (status === 'CHANNEL_ERROR') {
    //     console.error('Events subscription error:', status);
    //     retrySubscription();
    //   } else if (status === 'TIMED_OUT') {
    //     console.error('Events subscription timed out');
    //     retrySubscription();
    //   } else if (status === 'CLOSED') {
    //     console.log('Events subscription closed');
    //   }
    // });

    // Store the channel reference
    channelRef.current = channel;

    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (err) {
          console.error('Error removing events channel:', err);
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

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: isDark ? colors.text : colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: isBottomNavVisible ? [styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder }] : { display: 'none' },
        // tabBarStyle: [styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder }],
        tabBarLabelStyle: styles.tabBarLabel,
        headerShown: false,
        gestureEnabled: false, // Disable swipe gestures in tabs
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
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 85 : 70,
    paddingBottom: Platform.OS === 'ios' ? 15 : 10 ,
    paddingTop: 8,
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