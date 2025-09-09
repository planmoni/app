import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeSubscriptionOptions {
  table: string;
  filter?: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  schema?: string;
  onError?: (error: any) => void;
  onStatusChange?: (status: string) => void;
}

export function createSafeRealtimeSubscription(
  channelName: string,
  options: RealtimeSubscriptionOptions,
  onPayload: (payload: any) => void
): RealtimeChannel {
  const {
    table,
    filter,
    event = '*',
    schema = 'public',
    onError,
    onStatusChange
  } = options;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event,
        schema,
        table,
        ...(filter && { filter })
      },
      (payload: any) => {
        try {
          onPayload(payload);
        } catch (err) {
          console.error(`Error processing ${table} change:`, err);
          onError?.(err);
        }
      }
    );

  channel.subscribe((status: any) => {
    onStatusChange?.(status);
    
    switch (status) {
      case 'SUBSCRIBED':
        console.log(`${table} subscription successful`);
        break;
      case 'CHANNEL_ERROR':
        console.error(`${table} subscription error:`, status);
        onError?.(new Error(`Channel subscription error for ${table}`));
        break;
      case 'TIMED_OUT':
        console.error(`${table} subscription timed out`);
        onError?.(new Error(`Channel subscription timed out for ${table}`));
        break;
      case 'CLOSED':
        console.log(`${table} subscription closed`);
        break;
    }
  });

  return channel;
}

export function removeChannelSafely(channel: RealtimeChannel | null) {
  if (channel) {
    try {
      supabase.removeChannel(channel);
    } catch (err) {
      console.error('Error removing channel:', err);
    }
  }
} 