import { Modal, View, Text, StyleSheet, Pressable, Switch, ScrollView, useWindowDimensions, Animated } from 'react-native';
import { X, Shield, Fingerprint, Lock, Eye } from 'lucide-react-native';
import { useState, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { PanGestureHandler } from 'react-native-gesture-handler';

interface SecurityModalProps {
  isVisible: boolean;
  onClose: () => void;
}

const DRAG_DISMISS_THRESHOLD = 120;

export default function SecurityModal({ isVisible, onClose }: SecurityModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState(false);
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  // State for security settings
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(true);
  
  const styles = createStyles(colors, isDark, isSmallScreen);
  
  const handleGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const handleGestureEnd = (event: any) => {
    setDragging(false);
    if (event.nativeEvent.translationY > DRAG_DISMISS_THRESHOLD) {
      Animated.timing(translateY, {
        toValue: height,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        translateY.setValue(0);
        onClose();
      });
    } else {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="none"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.centeredView}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <PanGestureHandler
          onGestureEvent={handleGestureEvent}
          onBegan={() => setDragging(true)}
          onEnded={handleGestureEnd}
        >
          <Animated.View style={[styles.modalView, { transform: [{ translateY }] }]}>
            <View style={styles.header}>
              <Text style={styles.modalTitle}>Security Settings</Text>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <X size={isSmallScreen ? 20 : 24} color={colors.text} />
              </Pressable>
            </View>
            
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
              <Text style={styles.description}>
                Update your security preferences to protect your account.
              </Text>
              
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Authentication</Text>
                
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <View style={styles.settingIconContainer}>
                      <Fingerprint size={isSmallScreen ? 16 : 20} color="#1E3A8A" />
                    </View>
                    <View>
                      <Text style={styles.settingTitle}>Biometric Authentication</Text>
                      <Text style={styles.settingDescription}>Use fingerprint or face ID to login</Text>
                    </View>
                  </View>
                  <Switch
                    value={biometricEnabled}
                    onValueChange={setBiometricEnabled}
                    trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
                    thumbColor={biometricEnabled ? '#1E3A8A' : colors.backgroundTertiary}
                  />
                </View>
                
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <View style={styles.settingIconContainer}>
                      <Lock size={isSmallScreen ? 16 : 20} color="#22C55E" />
                    </View>
                    <View>
                      <Text style={styles.settingTitle}>PIN Lock</Text>
                      <Text style={styles.settingDescription}>Require PIN to access app</Text>
                    </View>
                  </View>
                  <Switch
                    value={pinEnabled}
                    onValueChange={setPinEnabled}
                    trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
                    thumbColor={pinEnabled ? '#1E3A8A' : colors.backgroundTertiary}
                  />
                </View>
                
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <View style={styles.settingIconContainer}>
                      <Shield size={isSmallScreen ? 16 : 20} color="#F97316" />
                    </View>
                    <View>
                      <Text style={styles.settingTitle}>Two-Factor Authentication</Text>
                      <Text style={styles.settingDescription}>Add an extra layer of security</Text>
                    </View>
                  </View>
                  <Switch
                    value={twoFactorEnabled}
                    onValueChange={setTwoFactorEnabled}
                    trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
                    thumbColor={twoFactorEnabled ? '#1E3A8A' : colors.backgroundTertiary}
                  />
                </View>
              </View>
              
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Privacy</Text>
                
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <View style={styles.settingIconContainer}>
                      <Eye size={isSmallScreen ? 16 : 20} color="#8B5CF6" />
                    </View>
                    <View>
                      <Text style={styles.settingTitle}>Auto Session Timeout</Text>
                      <Text style={styles.settingDescription}>Automatically log out after 30 minutes of inactivity</Text>
                    </View>
                  </View>
                  <Switch
                    value={sessionTimeout}
                    onValueChange={setSessionTimeout}
                    trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
                    thumbColor={sessionTimeout ? '#1E3A8A' : colors.backgroundTertiary}
                  />
                </View>
              </View>
              
              <View style={styles.actionsSection}>
                <Text style={styles.sectionTitle}>Account Security</Text>
                
                <Pressable style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>Change Password</Text>
                </Pressable>
                
                <Pressable style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>Set Up Two-Factor Authentication</Text>
                </Pressable>
                
                <Pressable style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>View Active Sessions</Text>
                </Pressable>
              </View>
              
              <View style={styles.infoContainer}>
                <Text style={styles.infoText}>
                  We recommend enabling all security features to protect your account. Your security is our top priority.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable style={styles.saveButton} onPress={onClose}>
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </Pressable>
            </View>
          </Animated.View>
        </PanGestureHandler>
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
  actionsSection: {
    marginBottom: isSmallScreen ? 20 : 24,
  },
  actionButton: {
    backgroundColor: colors.backgroundTertiary,
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: isSmallScreen ? 14 : 16,
    color: colors.text,
    fontWeight: '500',
    textAlign: 'center',
  },
  infoContainer: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
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