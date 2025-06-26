import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, ActivityIndicator } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Bell, Calendar, Wallet, Mail } from 'lucide-react-native';
import { useHaptics } from '@/hooks/useHaptics';
import { Platform } from 'react-native';

type EmailNotificationSettings = {
  login_alerts: boolean;
  payout_alerts: boolean;
  expiry_reminders: boolean;
  wallet_summary: 'daily' | 'weekly' | 'monthly' | 'never';
};

export default function EmailNotificationSettings() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const { showToast } = useToast();
  const haptics = useHaptics();
  
  const [settings, setSettings] = useState<EmailNotificationSettings>({
    login_alerts: true,
    payout_alerts: true,
    expiry_reminders: true,
    wallet_summary: 'weekly'
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [session?.access_token]);

  const fetchSettings = async () => {
    if (!session?.access_token) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/email-notifications', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      setError('Failed to load notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!session?.access_token) return;
    
    try {
      setIsSaving(true);
      setError(null);
      
      const response = await fetch('/api/email-notifications', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update notification settings');
      }
      
      showToast('Notification settings updated successfully', 'success');
      
      if (Platform.OS !== 'web') {
        haptics.success();
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
      setError('Failed to update notification settings');
      showToast('Failed to update notification settings', 'error');
      
      if (Platform.OS !== 'web') {
        haptics.error();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (setting: keyof Omit<EmailNotificationSettings, 'wallet_summary'>) => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    
    setSettings(prev => {
      const newSettings = { ...prev, [setting]: !prev[setting] };
      return newSettings;
    });
  };

  const handleSummaryChange = (value: EmailNotificationSettings['wallet_summary']) => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    
    setSettings(prev => ({ ...prev, wallet_summary: value }));
  };

  const styles = createStyles(colors, isDark);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading notification settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Email Notifications</Text>
        <Text style={styles.sectionDescription}>
          Choose which email notifications you want to receive
        </Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View style={[styles.settingIcon, { backgroundColor: '#FEF3C7' }]}>
              <Bell size={20} color="#F59E0B" />
            </View>
            <View>
              <Text style={styles.settingTitle}>Login Alerts</Text>
              <Text style={styles.settingDescription}>Get notified about new logins to your account</Text>
            </View>
          </View>
          <Switch
            value={settings.login_alerts}
            onValueChange={() => handleToggle('login_alerts')}
            trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
            thumbColor={settings.login_alerts ? '#1E3A8A' : colors.backgroundTertiary}
            disabled={isSaving}
          />
        </View>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View style={[styles.settingIcon, { backgroundColor: '#DCFCE7' }]}>
              <Wallet size={20} color="#22C55E" />
            </View>
            <View>
              <Text style={styles.settingTitle}>Payout Alerts</Text>
              <Text style={styles.settingDescription}>Get notified when payouts are processed</Text>
            </View>
          </View>
          <Switch
            value={settings.payout_alerts}
            onValueChange={() => handleToggle('payout_alerts')}
            trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
            thumbColor={settings.payout_alerts ? '#1E3A8A' : colors.backgroundTertiary}
            disabled={isSaving}
          />
        </View>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <View style={[styles.settingIcon, { backgroundColor: '#EFF6FF' }]}>
              <Calendar size={20} color="#1E3A8A" />
            </View>
            <View>
              <Text style={styles.settingTitle}>Plan Expiry Reminders</Text>
              <Text style={styles.settingDescription}>Get notified when your payout plans are about to expire</Text>
            </View>
          </View>
          <Switch
            value={settings.expiry_reminders}
            onValueChange={() => handleToggle('expiry_reminders')}
            trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
            thumbColor={settings.expiry_reminders ? '#1E3A8A' : colors.backgroundTertiary}
            disabled={isSaving}
          />
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wallet Summary</Text>
        <Text style={styles.sectionDescription}>
          How often would you like to receive wallet summary emails?
        </Text>
        
        <View style={styles.summaryOptions}>
          <Pressable
            style={[
              styles.summaryOption,
              settings.wallet_summary === 'daily' && styles.selectedOption
            ]}
            onPress={() => handleSummaryChange('daily')}
            disabled={isSaving}
          >
            <Text style={[
              styles.summaryOptionText,
              settings.wallet_summary === 'daily' && styles.selectedOptionText
            ]}>Daily</Text>
          </Pressable>
          
          <Pressable
            style={[
              styles.summaryOption,
              settings.wallet_summary === 'weekly' && styles.selectedOption
            ]}
            onPress={() => handleSummaryChange('weekly')}
            disabled={isSaving}
          >
            <Text style={[
              styles.summaryOptionText,
              settings.wallet_summary === 'weekly' && styles.selectedOptionText
            ]}>Weekly</Text>
          </Pressable>
          
          <Pressable
            style={[
              styles.summaryOption,
              settings.wallet_summary === 'monthly' && styles.selectedOption
            ]}
            onPress={() => handleSummaryChange('monthly')}
            disabled={isSaving}
          >
            <Text style={[
              styles.summaryOptionText,
              settings.wallet_summary === 'monthly' && styles.selectedOptionText
            ]}>Monthly</Text>
          </Pressable>
          
          <Pressable
            style={[
              styles.summaryOption,
              settings.wallet_summary === 'never' && styles.selectedOption
            ]}
            onPress={() => handleSummaryChange('never')}
            disabled={isSaving}
          >
            <Text style={[
              styles.summaryOptionText,
              settings.wallet_summary === 'never' && styles.selectedOptionText
            ]}>Never</Text>
          </Pressable>
        </View>
      </View>
      
      <View style={styles.infoContainer}>
        <Mail size={16} color={colors.primary} />
        <Text style={styles.infoText}>
          Email notifications help you stay informed about important account activities and updates.
        </Text>
      </View>
      
      <Pressable
        style={[styles.saveButton, isSaving && styles.savingButton]}
        onPress={saveSettings}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save Preferences</Text>
        )}
      </Pressable>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    padding: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: colors.errorLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  summaryOption: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: colors.backgroundTertiary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedOption: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF',
    borderColor: colors.primary,
  },
  summaryOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  selectedOptionText: {
    color: colors.primary,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  savingButton: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});