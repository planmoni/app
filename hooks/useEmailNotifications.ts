import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { sendEmail, sendNotificationEmail } from '@/lib/email-service';

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
      
      // Fix: Use absolute URL instead of relative URL
      const apiUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/email-notifications` 
        : '/api/email-notifications';
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Check if response is OK before trying to parse JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
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
      
      // Fix: Use absolute URL instead of relative URL
      const apiUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/email-notifications` 
        : '/api/email-notifications';
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings: newSettings })
      });
      
      // Check if response is OK before trying to parse JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
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
      
      // Fix: Use absolute URL instead of relative URL
      const apiUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/api/email-notifications` 
        : '/api/email-notifications';
      
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
      
      // Check if response is OK before trying to parse JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        return false;
      }
      
      const responseData = await response.json();
      
      console.log('Notification sent successfully');
      return true;
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