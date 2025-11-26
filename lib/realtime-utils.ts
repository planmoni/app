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
        console.log(`✅ ${table} subscription successful`);
        break;
      case 'CHANNEL_ERROR':
        console.warn(`⚠️ ${table} subscription error - continuing without realtime updates`);
        onError?.(new Error(`Channel subscription error for ${table}`));
        break;
      case 'TIMED_OUT':
        console.warn(`⚠️ ${table} subscription timed out - continuing without realtime updates`);
        onError?.(new Error(`Channel subscription timed out for ${table}`));
        break;
      case 'CLOSED':
        console.log(`ℹ️ ${table} subscription closed`);
        break;
    }
  });

  return channel;
}

/**
 * Creates a retry handler for realtime subscriptions
 */
export function createRetryHandler(
  maxRetries: number = 5,
  onRetry: () => void,
  onMaxRetriesReached?: () => void
) {
  let retryCount = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let isSubscribed = false;

  const retry = () => {
    if (retryCount < maxRetries && !isSubscribed) {
      retryCount++;
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
      console.log(`🔄 Retrying subscription (${retryCount}/${maxRetries}) in ${delay}ms...`);
      retryTimeout = setTimeout(() => {
        onRetry();
      }, delay);
    } else if (retryCount >= maxRetries) {
      console.warn(`⚠️ Max retries (${maxRetries}) reached - continuing without realtime updates`);
      onMaxRetriesReached?.();
    }
  };

  const reset = () => {
    retryCount = 0;
    isSubscribed = true;
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
  };

  const markUnsubscribed = () => {
    isSubscribed = false;
  };

  const cleanup = () => {
    isSubscribed = false; // Prevent retries during cleanup
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
  };

  return {
    retry,
    reset,
    markUnsubscribed,
    cleanup,
    getRetryCount: () => retryCount,
    isSubscribed: () => isSubscribed,
  };
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