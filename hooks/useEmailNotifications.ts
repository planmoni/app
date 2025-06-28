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
      
      const response = await fetch('/api/email-notifications', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Check if response is ok before attempting to parse JSON
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            // If response is not JSON (e.g., HTML error page), use status text
            errorMessage = `Server returned ${response.status}: ${response.statusText}`;
          }
        } catch (parseError) {
          // If we can't parse the error response, use the status
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      // Check content type before parsing as JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response but received ${contentType || 'unknown content type'}`);
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
      
      const response = await fetch('/api/email-notifications', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings: newSettings })
      });
      
      // Check if response is ok before attempting to parse JSON
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } else {
            errorMessage = `Server returned ${response.status}: ${response.statusText}`;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      // Check content type before parsing as JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response but received ${contentType || 'unknown content type'}`);
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
      
      // Use the new email service
      return await sendNotificationEmail(type, data, token);
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