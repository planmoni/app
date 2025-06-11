import { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function TabsLayout() {
  const { session } = useAuth();
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
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}