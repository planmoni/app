import { Modal, View, Text, StyleSheet, Pressable, Switch, ScrollView, useWindowDimensions } from 'react-native';
import { X, Bell, Shield, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface NotificationSettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function NotificationSettingsModal({ isVisible, onClose }: NotificationSettingsModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  // State for notification settings
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [payoutAlerts, setPayoutAlerts] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [marketingAlerts, setMarketingAlerts] = useState(false);
  
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
          
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.description}>
              Customize your notification preferences and alerts.
            </Text>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notification Channels</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Push Notifications</Text>
                  <Text style={styles.settingDescription}>Receive alerts on your device</Text>
                </View>
                <Switch
                  value={pushEnabled}
                  onValueChange={setPushEnabled}
                  trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
                  thumbColor={pushEnabled ? '#1E3A8A' : colors.backgroundTertiary}
                />
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Email Notifications</Text>
                  <Text style={styles.settingDescription}>Receive alerts via email</Text>
                </View>
                <Switch
                  value={emailEnabled}
                  onValueChange={setEmailEnabled}
                  trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
                  thumbColor={emailEnabled ? '#1E3A8A' : colors.backgroundTertiary}
                />
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notification Types</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingIconContainer}>
                    <Bell size={isSmallScreen ? 16 : 20} color="#F97316" />
                  </View>
                  <View>
                    <Text style={styles.settingTitle}>Payout Alerts</Text>
                    <Text style={styles.settingDescription}>Notifications about your payouts</Text>
                  </View>
                </View>
                <Switch
                  value={payoutAlerts}
                  onValueChange={setPayoutAlerts}
                  trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
                  thumbColor={payoutAlerts ? '#1E3A8A' : colors.backgroundTertiary}
                />
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingIconContainer}>
                    <Shield size={isSmallScreen ? 16 : 20} color="#1E3A8A" />
                  </View>
                  <View>
                    <Text style={styles.settingTitle}>Security Alerts</Text>
                    <Text style={styles.settingDescription}>Login attempts and security updates</Text>
                  </View>
                </View>
                <Switch
                  value={securityAlerts}
                  onValueChange={setSecurityAlerts}
                  trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
                  thumbColor={securityAlerts ? '#1E3A8A' : colors.backgroundTertiary}
                />
              </View>
              
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <View style={styles.settingIconContainer}>
                    <Clock size={isSmallScreen ? 16 : 20} color="#8B5CF6" />
                  </View>
                  <View>
                    <Text style={styles.settingTitle}>Marketing & Updates</Text>
                    <Text style={styles.settingDescription}>News, tips, and product updates</Text>
                  </View>
                </View>
                <Switch
                  value={marketingAlerts}
                  onValueChange={setMarketingAlerts}
                  trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
                  thumbColor={marketingAlerts ? '#1E3A8A' : colors.backgroundTertiary}
                />
              </View>
            </View>
            
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>
                You can change these settings at any time. Some security-related notifications cannot be disabled as they are essential for account security.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.saveButton} onPress={onClose}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '100%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '600',
  },
});