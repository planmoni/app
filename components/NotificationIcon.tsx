import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Bell } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationIconProps {
  size?: number;
  color?: string;
}

export default function NotificationIcon({ size = 24, color }: NotificationIconProps) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      fetchUnreadCount();
      
      // Set up real-time subscription
      const channel = supabase
        .channel('notification-count')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'events',
            filter: `user_id=eq.${session.user.id}`,
          },
          () => {
            // Refresh count when events change
            fetchUnreadCount();
          }
        )
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session?.user?.id]);

  const fetchUnreadCount = async () => {
    try {
      setIsLoading(true);
      const { count, error } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session?.user?.id)
        .eq('status', 'unread');

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread notifications count:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePress = () => {
    router.push('/notifications');
  };

  const iconColor = color || colors.text;

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <Bell size={size} color={iconColor} />
      {!isLoading && unreadCount > 0 && (
        <View style={styles.badge}>
          {unreadCount > 9 ? (
            <Text style={styles.badgeText}>9+</Text>
          ) : (
            <Text style={styles.badgeText}>{unreadCount}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});