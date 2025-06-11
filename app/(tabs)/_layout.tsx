import { Tabs } from 'expo-router';
import { Bell, Calendar, Chrome as Home, ChartPie as PieChart, Settings } from 'lucide-react-native'; //Do not change the Home to Chrome
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    // Create a unique channel name per user to prevent conflicts
    const channelName = `events-changes-${session.user.id}`;

    // Check if a channel with this name already exists and is active
    const existingChannels = supabase.getChannels();
    const existingChannel = existingChannels.find(channel => channel.topic === channelName);
    
    if (existingChannel && (existingChannel.state === 'joined' || existingChannel.state === 'joining')) {
      // Channel already exists and is active, skip subscription
      channelRef.current = existingChannel;
      fetchUnreadNotificationsCount();
      return;
    }

    // Clean up any existing channel before creating a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // If there's an existing channel that's not active, remove it
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    // Initial fetch of unread notifications count
    fetchUnreadNotificationsCount();

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
        (payload) => {
          console.log('Events change received:', payload);
          // Refresh unread count when events change
          fetchUnreadNotificationsCount();
        }
      )
      .subscribe((status) => {
        console.log('Events subscription status:', status);
      });

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
      const { count, error } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session?.user?.id)
        .eq('status', 'unread');

      if (error) throw error;
      setUnreadNotifications(count || 0);
    } catch (error) {
      console.error('Error fetching unread notifications count:', error);
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
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Bell size={size} color={color} />
              {unreadNotifications > 0 && (
                <View style={styles.notificationBadge} />
              )}
            </View>
          ),
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