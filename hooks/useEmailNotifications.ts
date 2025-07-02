import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { sendEmail, sendNotificationEmail } from '@/lib/email-service';
import { supabase } from '@/lib/supabase';

export type EmailNotificationSettings = {
  login_alerts: boolean;
  payout_alerts: boolean;
  expiry_reminders: boolean;
  wallet_summary: 'daily' | 'weekly' | 'monthly' | 'never';
};

export function useEmailNotifications() {
  const [settings, setSettings] = useState<EmailNotificationSettings>({
    login_alerts: true,
    payout_alerts: true,
    expiry_reminders: true,
    wallet_summary: 'weekly'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();
  const { showToast } = useToast();

  // Helper: get user id from session
  const userId = session?.user?.id;

  useEffect(() => {
    if (userId) {
      fetchSettings();
    }
  }, [userId]);

  // Fetch settings directly from Supabase
  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (!userId) throw new Error('No user ID available');
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('email_notifications')
        .eq('id', userId)
        .single();
      if (fetchError) throw fetchError;
      if (data?.email_notifications) {
        setSettings(data.email_notifications);
        return data.email_notifications;
      }
      return null;
    } catch (err) {
      console.error('Error fetching notification settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notification settings');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Update settings directly in Supabase
  const updateSettings = async (newSettings: EmailNotificationSettings): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      if (!userId) throw new Error('No user ID available');
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ email_notifications: newSettings })
        .eq('id', userId);
      if (updateError) throw updateError;
      setSettings(newSettings);
      showToast?.('Notification settings updated successfully', 'success');
      return true;
    } catch (err) {
      console.error('Error updating notification settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update notification settings');
      showToast?.('Failed to update notification settings', 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Keep sendNotification via Edge Function
  const sendNotification = async (
    type: 'new_login' | 'payout_completed' | 'plan_expiry' | 'wallet_summary',
    data: any,
    accessToken?: string
  ): Promise<boolean> => {
    try {
      const token = accessToken || session?.access_token;
      if (!token) {
        console.error('No access token available for sending notification');
        return false;
      }
      const apiUrl = process.env.EXPO_PUBLIC_SUPABASE_FUNCTION_URL
        ? `${process.env.EXPO_PUBLIC_SUPABASE_FUNCTION_URL}/email-notifications`
        : 'https://<your-project-ref>.functions.supabase.co/email-notifications';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          type,
          data
        })
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        return false;
      }
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        await response.json();
        console.log('Notification sent successfully');
        return true;
      } else {
        const text = await response.text();
        console.error('Expected JSON, got:', text);
        return false;
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  };

  return {
    settings,
    isLoading,
    error,
    fetchSettings,
    updateSettings,
    sendNotification
  };
}