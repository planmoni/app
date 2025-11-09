import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, Volume2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { inAppNotificationService, NotificationPreferences } from '@/lib/in-app-notifications';
import Toast from 'react-native-toast-message';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    transaction_alerts: true,
    payout_alerts: true,
    security_alerts: true,
    marketing_alerts: false,
    system_alerts: true,
    local_notifications_enabled: true,
    notification_sound: true,
  });

  useEffect(() => {
    loadPreferences();
  }, [user?.id]);

  const loadPreferences = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const prefs = await inAppNotificationService.getNotificationPreferences(user.id);
      if (prefs) {
        setPreferences(prefs);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load notification settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user?.id) return;

    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    try {
      setSaving(true);
      const success = await inAppNotificationService.updateNotificationPreferences(user.id, {
        [key]: value,
      });

      if (success) {
        Toast.show({
          type: 'success',
          text1: 'Updated',
          text2: 'Notification settings saved',
        });
      } else {
        setPreferences(preferences);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to update settings',
        });
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      setPreferences(preferences);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const SettingItem = ({
    title,
    description,
    value,
    onToggle,
    icon,
  }: {
    title: string;
    description: string;
    value: boolean;
    onToggle: () => void;
    icon?: React.ReactNode;
  }) => (
    <View style={[styles.settingItem, { backgroundColor: theme.colors.card }]}>
      <View style={styles.settingLeft}>
        {icon && <View style={styles.settingIcon}>{icon}</View>}
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
            {description}
          </Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
        thumbColor="#FFFFFF"
        disabled={saving}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Notification Settings
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>General</Text>

          <SettingItem
            title="Push Notifications"
            description="Enable local push notifications on this device"
            value={preferences.local_notifications_enabled}
            onToggle={() =>
              updatePreference('local_notifications_enabled', !preferences.local_notifications_enabled)
            }
            icon={<Bell size={20} color={theme.colors.primary} />}
          />

          <SettingItem
            title="Notification Sound"
            description="Play sound when receiving notifications"
            value={preferences.notification_sound}
            onToggle={() => updatePreference('notification_sound', !preferences.notification_sound)}
            icon={<Volume2 size={20} color={theme.colors.primary} />}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Notification Types
          </Text>

          <SettingItem
            title="Transaction Alerts"
            description="Get notified about deposits and withdrawals"
            value={preferences.transaction_alerts}
            onToggle={() => updatePreference('transaction_alerts', !preferences.transaction_alerts)}
            icon={<Text style={styles.emoji}>💰</Text>}
          />

          <SettingItem
            title="Payout Alerts"
            description="Get notified about payout status and reminders"
            value={preferences.payout_alerts}
            onToggle={() => updatePreference('payout_alerts', !preferences.payout_alerts)}
            icon={<Text style={styles.emoji}>💸</Text>}
          />

          <SettingItem
            title="Security Alerts"
            description="Important security notifications (always on)"
            value={preferences.security_alerts}
            onToggle={() => updatePreference('security_alerts', !preferences.security_alerts)}
            icon={<Text style={styles.emoji}>🔒</Text>}
          />

          <SettingItem
            title="System Alerts"
            description="App updates and maintenance notifications"
            value={preferences.system_alerts}
            onToggle={() => updatePreference('system_alerts', !preferences.system_alerts)}
            icon={<Text style={styles.emoji}>ℹ️</Text>}
          />

          <SettingItem
            title="Marketing Alerts"
            description="Promotional offers and tips"
            value={preferences.marketing_alerts}
            onToggle={() => updatePreference('marketing_alerts', !preferences.marketing_alerts)}
            icon={<Text style={styles.emoji}>📢</Text>}
          />
        </View>

        <View style={[styles.infoBox, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            Security alerts cannot be disabled to ensure you're always informed about important account
            activity.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 58, 138, 0.1)',
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  emoji: {
    fontSize: 20,
  },
  infoBox: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
