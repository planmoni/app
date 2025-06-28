import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  Pressable, 
  ActivityIndicator, 
  Animated, 
  Platform,
  ScrollView,
  Alert,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { BiometricService } from '@/lib/biometrics';
import { useAppLock } from '@/contexts/AppLockContext';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

interface BiometricSetupModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function BiometricSetupModal({ isVisible, onClose }: BiometricSetupModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const { isAppLockEnabled } = useAppLock();
  const haptics = useHaptics();
  
  const [biometricSettings, setBiometricSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  
  // Animation values
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;

  // Refresh biometric settings when modal becomes visible
  useEffect(() => {
    if (isVisible) {
      refreshBiometricSettings();
      
      // Animate modal in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      // Reset animation values when modal is hidden
      slideAnim.setValue(height);
      fadeAnim.setValue(0);
    }
  }, [isVisible, height]);

  const refreshBiometricSettings = async () => {
    try {
      if (Platform.OS === 'web') {
        // For web, set default values
        setBiometricSettings({
          isEnabled: false,
          isAvailable: false,
          isEnrolled: false,
          supportedTypes: []
        });
        return;
      }
      
      const settings = await BiometricService.checkBiometricSupport();
      setBiometricSettings(settings);
    } catch (error) {
      console.error('Failed to check biometric support:', error);
      setBiometricSettings({
        isEnabled: false,
        isAvailable: false,
        isEnrolled: false,
        supportedTypes: []
      });
    }
  };

  const setBiometricEnabled = async (enabled: boolean) => {
    try {
      setLoading(true);
      
      // Check if app lock is enabled first
      if (enabled && !isAppLockEnabled) {
        Alert.alert(
          "App Lock Required",
          "You need to set up App Lock PIN before enabling biometric authentication.",
          [
            { text: "OK", style: "default" },
            { 
              text: "Set Up PIN", 
              style: "default", 
              onPress: () => {
                onClose();
                router.push('/app-lock-setup');
              }
            }
          ]
        );
        return false;
      }
      
      if (Platform.OS !== 'web') {
        const success = await BiometricService.setBiometricEnabled(enabled);
        if (success) {
          await refreshBiometricSettings();
          haptics.success();
        } else {
          haptics.error();
        }
        return success;
      } else {
        // For web, just show an alert
        Alert.alert(
          "Not Available",
          "Biometric authentication is not available on web platforms."
        );
        return false;
      }
    } catch (error) {
      console.error('Failed to set biometric enabled:', error);
      haptics.error();
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBiometric = async () => {
    if (!biometricSettings) return;

    const newState = !biometricSettings.isEnabled;
    const success = await setBiometricEnabled(newState);

    if (success) {
      Alert.alert(
        "Success", 
        `Biometric authentication has been ${newState ? "enabled" : "disabled"}.`
      );
    }
  };

  const handleTestBiometric = async () => {
    if (!biometricSettings?.isAvailable || Platform.OS === 'web') return;

    setTesting(true);
    haptics.mediumImpact();
    
    try {
      const result = await BiometricService.authenticateWithBiometrics("Test biometric authentication");

      if (result.success) {
        haptics.success();
        Alert.alert("Success", "Biometric authentication test passed!");
      } else {
        haptics.error();
        Alert.alert("Failed", result.error || "Biometric authentication test failed");
      }
    } catch (error) {
      haptics.error();
      Alert.alert("Error", "Failed to test biometric authentication");
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    // Animate modal out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      haptics.lightImpact();
      onClose();
    });
  };

  if (!biometricSettings) {
    return (
      <Modal
        visible={isVisible}
        transparent={true}
        animationType="none"
        onRequestClose={handleClose}
      >
        <View style={styles.centeredView}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Checking biometric support...
          </Text>
        </View>
      </Modal>
    );
  }

  const biometricLabel = Platform.OS !== 'web' 
    ? BiometricService.getBiometricTypeLabel(biometricSettings.supportedTypes)
    : 'Biometric';
    
  const biometricIcon = Platform.OS !== 'web'
    ? BiometricService.getBiometricIcon(biometricSettings.supportedTypes)
    : 'finger-print';

  // Calculate responsive sizes
  const iconSize = isSmallScreen ? 40 : 48;
  const titleSize = isSmallScreen ? 16 : 18;
  const textSize = isSmallScreen ? 13 : 14;
  const padding = isSmallScreen ? 16 : 20;

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <Animated.View 
        style={[
          styles.overlay,
          { opacity: fadeAnim }
        ]}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        
        <Animated.View 
          style={[
            styles.modalContainer,
            { 
              transform: [{ translateY: slideAnim }],
              backgroundColor: colors.surface
            }
          ]}
        >
          <View style={styles.dragIndicator} />
          
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text, fontSize: titleSize }]}>
              Biometric Authentication
            </Text>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          
          <ScrollView style={styles.content}>
            <View style={[styles.contentInner, { backgroundColor: colors.backgroundSecondary, padding }]}>
              <View style={styles.iconSection}>
                <View style={[styles.iconContainer, { 
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
                  width: iconSize,
                  height: iconSize,
                }]}>
                  <Ionicons name={biometricIcon as any} size={iconSize / 2} color={colors.primary} />
                </View>
                <View style={styles.headerText}>
                  <Text style={[styles.subtitle, { color: colors.text, fontSize: titleSize }]}>
                    {biometricLabel} Authentication
                  </Text>
                  <Text style={[styles.description, { color: colors.textSecondary, fontSize: textSize }]}>
                    {biometricSettings.isAvailable
                      ? `Use ${biometricLabel.toLowerCase()} to quickly and securely access your account`
                      : "Biometric authentication is not available on this device"}
                  </Text>
                </View>
              </View>

              {Platform.OS !== 'web' && biometricSettings.isAvailable && (
                <>
                  {!biometricSettings.isEnrolled && (
                    <View style={[styles.warningContainer, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb' }]}>
                      <Ionicons name="warning" size={20} color="#f59e0b" />
                      <Text style={[styles.warningText, { color: isDark ? '#fcd34d' : '#92400e', fontSize: textSize }]}>
                        No biometric credentials are enrolled on this device. Please set up {biometricLabel.toLowerCase()} in
                        your device settings.
                      </Text>
                    </View>
                  )}

                  <View style={[styles.toggleContainer, { borderColor: colors.border }]}>
                    <View style={styles.toggleContent}>
                      <Text style={[styles.toggleLabel, { color: colors.text, fontSize: titleSize - 2 }]}>
                        Enable {biometricLabel}
                      </Text>
                      <Text style={[styles.toggleDescription, { color: colors.textSecondary, fontSize: textSize }]}>
                        {biometricSettings.isEnabled
                          ? `${biometricLabel} authentication is enabled`
                          : `Enable ${biometricLabel.toLowerCase()} for quick access`}
                      </Text>
                    </View>

                    <Pressable
                      style={styles.toggleButton}
                      onPress={handleToggleBiometric}
                      disabled={loading || !biometricSettings.isEnrolled || !isAppLockEnabled}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <View style={[
                          styles.toggle, 
                          { 
                            backgroundColor: biometricSettings.isEnabled ? colors.primary : colors.border 
                          }
                        ]}>
                          <View style={[
                            styles.toggleThumb, 
                            { 
                              alignSelf: biometricSettings.isEnabled ? 'flex-end' : 'flex-start',
                              backgroundColor: colors.surface
                            }
                          ]} />
                        </View>
                      )}
                    </Pressable>
                  </View>

                  {!isAppLockEnabled && (
                    <View style={[styles.warningContainer, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb' }]}>
                      <Ionicons name="warning" size={20} color="#f59e0b" />
                      <Text style={[styles.warningText, { color: isDark ? '#fcd34d' : '#92400e', fontSize: textSize }]}>
                        You need to set up App Lock PIN before enabling biometric authentication. Go to Settings > App Lock to set up a PIN.
                      </Text>
                    </View>
                  )}

                  {biometricSettings.isEnabled && (
                    <Pressable 
                      style={[
                        styles.testButton, 
                        { 
                          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff' 
                        }
                      ]} 
                      onPress={handleTestBiometric} 
                      disabled={testing}
                    >
                      {testing ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons name="play-circle" size={20} color={colors.primary} />
                      )}
                      <Text style={[styles.testButtonText, { color: colors.primary, fontSize: textSize }]}>
                        {testing ? "Testing..." : `Test ${biometricLabel}`}
                      </Text>
                    </Pressable>
                  )}
                </>
              )}

              <View style={[styles.infoContainer, { backgroundColor: isDark ? colors.backgroundTertiary : '#f9fafb' }]}>
                <Text style={[styles.infoTitle, { color: colors.text, fontSize: titleSize - 2 }]}>
                  Security Information
                </Text>
                <View style={styles.infoItem}>
                  <Ionicons name="shield-checkmark" size={16} color={isDark ? '#34d399' : '#10b981'} />
                  <Text style={[styles.infoText, { color: colors.textSecondary, fontSize: textSize }]}>
                    Your biometric data is stored securely on your device and never shared
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="lock-closed" size={16} color={isDark ? '#34d399' : '#10b981'} />
                  <Text style={[styles.infoText, { color: colors.textSecondary, fontSize: textSize }]}>
                    You can disable biometric authentication at any time
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="key" size={16} color={isDark ? '#34d399' : '#10b981'} />
                  <Text style={[styles.infoText, { color: colors.textSecondary, fontSize: textSize }]}>
                    Your PIN is still required for sensitive operations
                  </Text>
                </View>
              </View>

              {Platform.OS === 'web' && (
                <View style={styles.webNoticeContainer}>
                  <Ionicons name="information-circle" size={48} color={colors.textTertiary} />
                  <Text style={[styles.webNoticeText, { color: colors.textSecondary, fontSize: textSize }]}>
                    Biometric authentication is not supported in web browsers. This feature is only available in the native mobile app.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    maxHeight: '90%',
    // Add shadow for iOS
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  dragIndicator: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontWeight: '600',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(203, 213, 225, 0.2)',
  },
  content: {
    maxHeight: '80%',
  },
  contentInner: {
    padding: 20,
  },
  iconSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  iconContainer: {
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  subtitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    lineHeight: 20,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    lineHeight: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 20,
  },
  toggleContent: {
    flex: 1,
  },
  toggleLabel: {
    fontWeight: '500',
  },
  toggleDescription: {
    marginTop: 2,
  },
  toggleButton: {
    marginLeft: 16,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  testButtonText: {
    fontWeight: '500',
    marginLeft: 8,
  },
  infoContainer: {
    padding: 16,
    borderRadius: 12,
  },
  infoTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    lineHeight: 20,
  },
  webNoticeContainer: {
    alignItems: 'center',
    padding: 32,
  },
  webNoticeText: {
    textAlign: 'center',
    marginTop: 16,
    maxWidth: 300,
  },
});