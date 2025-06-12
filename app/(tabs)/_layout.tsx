import { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { Home, Calendar, BarChart3, Bell, Settings } from 'lucide-react-native';

export default function TabsLayout() {
  const { session } = useAuth();
  const { colors, isDark } = useTheme();
  const channelRef = useRef<any>(null);

  const fetchUnreadNotificationsCount = async () => {
    // Implementation for fetching unread notifications count
    // This function should be implemented based on your app's requirements
  };

  useEffect(() => {
    if (!session?.user?.id) return;

    const channelName = `events-changes-${session.user.id}`;

    const existingChannels = supabase.getChannels();
    const existingChannel = existingChannels.find(channel => channel.topic === `realtime:${channelName}`);

    if (existingChannel && (existingChannel.state === 'joined' || existingChannel.state === 'joining')) {
      channelRef.current = existingChannel;
      fetchUnreadNotificationsCount();
      return;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    fetchUnreadNotificationsCount();

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
          fetchUnreadNotificationsCount();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [session?.user?.id]);

  return (
    <Tabs 
      screenOptions={{ 
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 0,
          marginBottom: 4,
        }
      }}
    >
      <Tabs.Screen 
        name="index" 
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen 
        name="calendar" 
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen 
        name="insights" 
        options={{
          title: "Insights",
          tabBarIcon: ({ color, size }) => (
            <BarChart3 size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen 
        name="notifications" 
        options={{
          title: "Notifications",
          tabBarIcon: ({ color, size }) => (
            <Bell size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen 
        name="settings" 
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}