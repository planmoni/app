import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

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

  useEffect(() => {
    if (session?.access_token) {
      fetchSettings(session.access_token);
    }
  }, [session?.access_token]);

  const fetchSettings = async (accessToken?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = accessToken || session?.access_token;
      if (!token) {
        throw new Error('No access token available');
      }
      
      const response = await fetch('/api/email-notifications', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch notification settings');
      }
      
      if (data.settings) {
        setSettings(data.settings);
      }
      
      return data.settings;
    } catch (err) {
      console.error('Error fetching notification settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notification settings');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: EmailNotificationSettings, accessToken?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = accessToken || session?.access_token;
      if (!token) {
        throw new Error('No access token available');
      }
      
      const response = await fetch('/api/email-notifications', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings: newSettings })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update notification settings');
      }
      
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
      
      const response = await fetch('/api/email-notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type, data })
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Failed to send notification:', responseData.error);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Error sending notification:', err);
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