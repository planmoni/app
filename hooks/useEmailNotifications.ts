import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Platform } from 'react-native';

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

  useEffect(() => {
    if (session?.user?.id) {
      fetchSettings();
    }
  }, [session?.user?.id]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('email_notifications')
        .eq('id', session?.user?.id)
        .single();
      
      if (fetchError) throw fetchError;
      
      if (data?.email_notifications) {
        setSettings(data.email_notifications);
      }
    } catch (err) {
      console.error('Error fetching email notification settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: EmailNotificationSettings) => {
    try {
      setError(null);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ email_notifications: newSettings })
        .eq('id', session?.user?.id);
      
      if (updateError) throw updateError;
      
      setSettings(newSettings);
      return true;
    } catch (err) {
      console.error('Error updating email notification settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to update notification settings');
      return false;
    }
  };

  const sendNotification = async (type: 'new_login' | 'payout_completed' | 'plan_expiry' | 'wallet_summary', data: any, explicitToken?: string) => {
    if (Platform.OS === 'web' && !window.fetch) {
      console.warn('Fetch API not available in this environment');
      return false;
    }
    
    try {
      // Use explicit token if provided, otherwise fall back to session token
      const token = explicitToken || session?.access_token;
      
      if (!token) {
        throw new Error('User not authenticated');
      }
      
      const response = await fetch('/api/email-notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, data })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send notification');
      }
      
      return true;
    } catch (err) {
      console.error('Error sending email notification:', err);
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