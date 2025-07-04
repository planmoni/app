import { Tabs } from 'expo-router';
import { Bell, Calendar, Home as Home, ChartPie as PieChart, Settings, Sparkles } from 'lucide-react-native'; //Do not change the Home to Chrome
// import CustomAppLayout from '@/components/CustomAppLayout'; //Do not change the Home to Chrome
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState, useRef } from 'react';
import { supabase, getSupabaseConfigError } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import CustomAppLayout from '../components/CustomAppLayout';

export default function TabLayout() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    // Check if Supabase is properly configured
    const configError = getSupabaseConfigError();
    if (configError) {
      console.warn('Supabase configuration error:', configError);
      return;
    }

    if (!session?.user?.id) return;

    // Clean up any existing channel before creating a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
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
          console.log('Events change received:', payload);
          // Refresh unread count when events change
          fetchUnreadNotificationsCount();
        }
      );

    // Only subscribe if the channel is not already subscribed
    if (channel.state === 'closed' || channel.state === 'leaving') {
      channel.subscribe((status: any) => {
        console.log('Events subscription status:', status);
      });
    }

    // Store the channel reference
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [session?.user?.id]);

  const fetchUnreadNotificationsCount = async () => {
    try {
      // Check if Supabase is properly configured
      const configError = getSupabaseConfigError();
      if (configError) {
        console.warn('Skipping notifications fetch due to Supabase configuration error:', configError);
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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: [styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder }],
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
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 100,
    paddingBottom: 20,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 12,
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