import { Modal, View, Text, StyleSheet, Pressable, Switch, ScrollView, useWindowDimensions , Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { X, Bell, Shield, Clock, Mail, BanknoteArrowUp, Key, Wallet, Megaphone, Calendar, ChevronRight } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useEmailNotifications, EmailNotificationSettings } from '@/hooks/useEmailNotifications';
import { useToast } from '@/contexts/ToastContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { areNotificationsEnabled, requestNotificationPermissions, getPushTokenAsync } from '@/lib/notifications';

interface NotificationSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function NotificationSettingsModal({
  isVisible,
  onClose,
}: NotificationSettingsModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { settings, isLoading, updateSettings } = useEmailNotifications();
  const { showToast } = useToast();
  const haptics = useHaptics();
  const { session } = useAuth();

  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  // Local state for notification settings
  const [localSettings, setLocalSettings] = useState<EmailNotificationSettings>({
    login_alerts: true,
    payout_alerts: true,
    deposit_alerts: true,
    expiry_reminders: true,
    wallet_summary: 'weekly'
  });
  
  // State for push notification settings (separate from email)
  const [pushEnabled, setPushEnabled] = useState(true);
  const [payoutAlerts, setPayoutAlerts] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [pushPreferences, setPushPreferences] = useState({
    payouts: true,
    deposits: true,
    security: true,
    general: true,
  });
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [isPushSaving, setIsPushSaving] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  
  // Update local settings when remote settings change
  useEffect(() => {
    if (!isLoading && settings) {
      setLocalSettings(settings);
    }
  }, [isLoading, settings]);

  // Load push notification settings and status
  useEffect(() => {
    loadPushNotificationSettings();
    checkPushNotificationStatus();
  }, []);

  const loadPushNotificationSettings = async () => {
    if (!session?.user?.id) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Error loading push notification preferences:", error);
        return;
      }

      if (data?.notification_preferences) {
        setPushPreferences(data.notification_preferences);
      }
    } catch (error) {
      console.error("Error loading push preferences:", error);
    } finally {
      setIsPushLoading(false);
    }
  };

  const checkPushNotificationStatus = async () => {
    const enabled = await areNotificationsEnabled();
    setPushNotificationsEnabled(enabled);
  };

  const savePushPreferences = async (
    newPreferences: typeof pushPreferences
  ) => {
    if (!session?.user?.id || isPushSaving) return;

    setIsPushSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          notification_preferences: newPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id);

      if (error) {
        console.error("Error saving push notification preferences:", error);
        showToast("Failed to save notification preferences", "error");
        return;
      }

      setPushPreferences(newPreferences);
      showToast("Notification preferences saved", "success");
    } catch (error) {
      console.error("Error saving push preferences:", error);
      showToast("Failed to save notification preferences", "error");
    } finally {
      setIsPushSaving(false);
    }
  };

  const handlePushPreferenceChange = (
    key: keyof typeof pushPreferences,
    value: boolean
  ) => {
    if (Platform.OS !== "web") {
      haptics.selection();
    }

    const newPreferences = { ...pushPreferences, [key]: value };
    savePushPreferences(newPreferences);
  };

  const enablePushNotifications = async () => {
    try {
      const granted = await requestNotificationPermissions();

      if (granted) {
        setPushNotificationsEnabled(true);
        // Get FCM token to ensure it's stored
        await getPushTokenAsync();
        showToast("Push notifications enabled", "success");
      } else {
        Alert.alert(
          "Permission Denied",
          "To receive notifications, please enable them in your device settings."
        );
      }
    } catch (error) {
      console.error("Error enabling push notifications:", error);
      showToast("Failed to enable push notifications", "error");
    }
  };

  const handleToggleEmail = (
    setting: keyof Omit<EmailNotificationSettings, "wallet_summary">
  ) => {
    if (Platform.OS !== "web") {
      haptics.selection();
    }

    setLocalSettings((prev) => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const handleSummaryChange = (
    value: EmailNotificationSettings["wallet_summary"]
  ) => {
    if (Platform.OS !== "web") {
      haptics.selection();
    }

    setLocalSettings((prev) => ({
      ...prev,
      wallet_summary: value,
    }));
  };

  const handleTogglePush = (
    setter: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (Platform.OS !== "web") {
      haptics.selection();
    }

    setter((prev) => !prev);
  };

  const handleSaveChanges = async () => {
    if (Platform.OS !== "web") {
      haptics.mediumImpact();
    }

    const success = await updateSettings(localSettings);

    if (success) {
      showToast('Notification settings saved successfully', 'success');

      if (Platform.OS !== 'web') {
        haptics.success();
      }

      onClose();
    } else {
      showToast('Failed to save notification settings', 'error');

      if (Platform.OS !== 'web') {
        haptics.error();
      }
    }
  };

  const handleMarketingPress = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    onClose();
    router.push('/marketing-preferences');
  };
  
  const styles = createStyles(colors, isDark, isSmallScreen);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.centeredView}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modalView}>
          <View style={styles.header}>
            <Text style={styles.modalTitle}>Notification Settings</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <X size={isSmallScreen ? 20 : 24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.description}>
              Customize your notification preferences and alerts.
            </Text>

            <View style={styles.section}>
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingIconContainer}>
                    <Bell size={isSmallScreen ? 16 : 20} color={colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={styles.settingTitle}>Push Notifications</Text>
                    <Text style={styles.settingDescription}>Receive alerts on your device</Text>
                  </View>
                </View>
                <Switch
                  value={pushEnabled}
                  onValueChange={() => handleTogglePush(setPushEnabled)}
                  trackColor={{ false: colors.borderSecondary, true: '#D1EAAE' }}
                  thumbColor={pushEnabled ? '#1E3A8A' : colors.backgroundTertiary}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingIconContainer}>
                    <BanknoteArrowUp size={isSmallScreen ? 16 : 20} color={colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={styles.settingTitle}>Payout Alerts</Text>
                    <Text style={styles.settingDescription}>
                      Notifications about your payouts
                    </Text>
                  </View>
                </View>
                <Switch
                  value={payoutAlerts}
                  onValueChange={() => handleTogglePush(setPayoutAlerts)}
                  trackColor={{ false: colors.borderSecondary, true: '#D1EAAE' }}
                  thumbColor={payoutAlerts ? '#1E3A8A' : colors.backgroundTertiary}
                  disabled={!pushEnabled}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingIconContainer}>
                    <Shield size={isSmallScreen ? 16 : 20} color={colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={styles.settingTitle}>Security Alerts</Text>
                    <Text style={styles.settingDescription}>
                      Login attempts and security updates
                    </Text>
                  </View>
                </View>
                <Switch
                  value={securityAlerts}
                  onValueChange={() => handleTogglePush(setSecurityAlerts)}
                  trackColor={{ false: colors.borderSecondary, true: '#D1EAAE' }}
                  thumbColor={securityAlerts ? '#1E3A8A' : colors.backgroundTertiary}
                  disabled={!pushEnabled}
                />
              </View>
              
              
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Email Notifications</Text>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingIconContainer}>
                    <Key size={isSmallScreen ? 16 : 20} color={colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={styles.settingTitle}>Login Attempt</Text>
                    <Text style={styles.settingDescription}>Get notified about new logins to your account</Text>
                  </View>
                </View>
                <Switch
                  value={localSettings.login_alerts}
                  onValueChange={() => handleToggleEmail('login_alerts')}
                  trackColor={{ false: colors.borderSecondary, true: '#D1EAAE' }}
                  thumbColor={localSettings.login_alerts ? '#1E3A8A' : colors.backgroundTertiary}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingIconContainer}>
                    <BanknoteArrowUp size={isSmallScreen ? 16 : 20} color={colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={styles.settingTitle}>Payout Alerts</Text>
                    <Text style={styles.settingDescription}>
                      Get notified when payouts are processed
                    </Text>
                  </View>
                </View>
                <Switch
                  value={localSettings.payout_alerts}
                  onValueChange={() => handleToggleEmail('payout_alerts')}
                  trackColor={{ false: colors.borderSecondary, true: '#D1EAAE' }}
                  thumbColor={localSettings.payout_alerts ? '#1E3A8A' : colors.backgroundTertiary}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingIconContainer}>
                    <Clock size={isSmallScreen ? 16 : 20} color={colors.textSecondary} />
                  </View>
                  <View>
                    <Text style={styles.settingTitle}>
                      Plan Expiry Reminders
                    </Text>
                    <Text style={styles.settingDescription}>
                      Get notified when your payout plans are about to expire
                    </Text>
                  </View>
                </View>
                <Switch
                  value={localSettings.expiry_reminders}
                  onValueChange={() => handleToggleEmail('expiry_reminders')}
                  trackColor={{ false: colors.borderSecondary, true: '#D1EAAE' }}
                  thumbColor={localSettings.expiry_reminders ? '#1E3A8A' : colors.backgroundTertiary}
                />
              </View>
              <Pressable style={styles.navigationItem} onPress={handleMarketingPress}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingIconContainer}>
                    <Mail size={isSmallScreen ? 16 : 20} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingTitle}>Marketing & Updates</Text>
                    <Text style={styles.settingDescription}>Manage email preferences for promotional content</Text>
                  </View>
                </View>
                <ChevronRight size={isSmallScreen ? 18 : 20} color={colors.textSecondary} />
              </Pressable>
            </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Wallet Summary Emails</Text>
              <Text style={styles.sectionDescription}>
                How often would you like to receive wallet summary emails?
              </Text>

              <View style={styles.summaryOptions}>
                <Pressable
                  style={[
                    styles.summaryOption,
                    localSettings.wallet_summary === "daily" &&
                      styles.selectedOption,
                  ]}
                  onPress={() => handleSummaryChange("daily")}
                >
                  <Text
                    style={[
                      styles.summaryOptionText,
                      localSettings.wallet_summary === "daily" &&
                        styles.selectedOptionText,
                    ]}
                  >
                    Daily
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.summaryOption,
                    localSettings.wallet_summary === "weekly" &&
                      styles.selectedOption,
                  ]}
                  onPress={() => handleSummaryChange("weekly")}
                >
                  <Text
                    style={[
                      styles.summaryOptionText,
                      localSettings.wallet_summary === "weekly" &&
                        styles.selectedOptionText,
                    ]}
                  >
                    Weekly
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.summaryOption,
                    localSettings.wallet_summary === "monthly" &&
                      styles.selectedOption,
                  ]}
                  onPress={() => handleSummaryChange("monthly")}
                >
                  <Text
                    style={[
                      styles.summaryOptionText,
                      localSettings.wallet_summary === "monthly" &&
                        styles.selectedOptionText,
                    ]}
                  >
                    Monthly
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.summaryOption,
                    localSettings.wallet_summary === "never" &&
                      styles.selectedOption,
                  ]}
                  onPress={() => handleSummaryChange("never")}
                >
                  <Text
                    style={[
                      styles.summaryOptionText,
                      localSettings.wallet_summary === "never" &&
                        styles.selectedOptionText,
                    ]}
                  >
                    Never
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.saveButton} onPress={handleSaveChanges}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) =>
  StyleSheet.create({
    centeredView: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "transparent",
    },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalView: {
      width: "100%",
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "90%",
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isSmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: isSmallScreen ? 18 : 24,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: isSmallScreen ? 32 : 40,
    height: isSmallScreen ? 32 : 40,
    borderRadius: isSmallScreen ? 16 : 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    maxHeight: '70%',
  },
  scrollContent: {
    padding: isSmallScreen ? 16 : 24,
  },
  description: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.textSecondary,
    lineHeight: isSmallScreen ? 20 : 24,
    marginBottom: isSmallScreen ? 20 : 24,
  },
  section: {
    marginBottom: isSmallScreen ? 20 : 24,
  },
  sectionTitle: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: isSmallScreen ? 12 : 16,
  },
  sectionDescription: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    marginBottom: isSmallScreen ? 12 : 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navigationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 1,
    marginBottom: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  settingIconContainer: {
    width: isSmallScreen ? 32 : 40,
    height: isSmallScreen ? 32 : 40,
    borderRadius: isSmallScreen ? 16 : 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingTitle: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    maxWidth: '95%',
  },
  summaryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,

  },
  summaryOption: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.backgroundTertiary,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  selectedOption: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    borderColor: colors.primary,
    borderRadius: 20,
  },
  summaryOptionText: {
    fontSize: isSmallScreen ? 12 : 14,
    fontWeight: '500',
    color: colors.text,
  },
  selectedOptionText: {
    color: colors.primary,
  },
  infoContainer: {
    backgroundColor: colors.backgroundTertiary,
    padding: 16,
    borderRadius: 8,
    marginBottom: isSmallScreen ? 16 : 24,
  },
  infoText: {
    fontSize: isSmallScreen ? 12 : 14,
    color: colors.textSecondary,
    lineHeight: isSmallScreen ? 18 : 20,
  },
  footer: {
    padding: isSmallScreen ? 16 : 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 20,
    height: 55,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
  },
});
