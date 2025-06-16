import React, { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, useWindowDimensions, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { BiometricService } from "@/lib/biometrics"
import { useTheme } from "@/contexts/ThemeContext"

export const BiometricSetup: React.FC = () => {
  const { colors, isDark } = useTheme()
  const { width, height } = useWindowDimensions()
  const [biometricSettings, setBiometricSettings] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700

  const refreshBiometricSettings = async () => {
    try {
      const settings = await BiometricService.checkBiometricSupport()
      setBiometricSettings(settings)
    } catch (error) {
      console.error('Failed to check biometric support:', error)
    }
  }

  const setBiometricEnabled = async (enabled: boolean) => {
    try {
      const success = await BiometricService.setBiometricEnabled(enabled)
      if (success) {
        await refreshBiometricSettings()
      }
      return success
    } catch (error) {
      console.error('Failed to set biometric enabled:', error)
      return false
    }
  }

  useEffect(() => {
    refreshBiometricSettings()
  }, [])

  const handleToggleBiometric = async () => {
    if (!biometricSettings) return

    setLoading(true)
    try {
      const newState = !biometricSettings.isEnabled
      const success = await setBiometricEnabled(newState)

      if (success) {
        Alert.alert("Success", `Biometric authentication has been ${newState ? "enabled" : "disabled"}.`)
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update biometric settings")
    } finally {
      setLoading(false)
    }
  }

  const handleTestBiometric = async () => {
    if (!biometricSettings?.isAvailable) return

    setTesting(true)
    try {
      const result = await BiometricService.authenticateWithBiometrics("Test biometric authentication")

      if (result.success) {
        Alert.alert("Success", "Biometric authentication test passed!")
      } else {
        Alert.alert("Failed", result.error || "Biometric authentication test failed")
      }
    } catch (error) {
      Alert.alert("Error", "Failed to test biometric authentication")
    } finally {
      setTesting(false)
    }
  }

  if (!biometricSettings) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Checking biometric support...</Text>
      </View>
    )
  }

  const biometricLabel = BiometricService.getBiometricTypeLabel(biometricSettings.supportedTypes)
  const biometricIcon = BiometricService.getBiometricIcon(biometricSettings.supportedTypes)

  // Calculate responsive sizes
  const iconSize = isSmallScreen ? 40 : 48
  const titleSize = isSmallScreen ? 16 : 18
  const textSize = isSmallScreen ? 13 : 14
  const padding = isSmallScreen ? 16 : 20

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary, padding }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.iconContainer, { 
          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff',
          width: iconSize,
          height: iconSize,
        }]}>
          <Ionicons name={biometricIcon as any} size={iconSize / 2} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text, fontSize: titleSize }]}>{biometricLabel} Authentication</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: textSize }]}>
            {biometricSettings.isAvailable
              ? `Use ${biometricLabel.toLowerCase()} to quickly and securely access your account`
              : "Biometric authentication is not available on this device"}
          </Text>
        </View>
      </View>

      {biometricSettings.isAvailable && (
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
              <Text style={[styles.toggleLabel, { color: colors.text, fontSize: titleSize - 2 }]}>Enable {biometricLabel}</Text>
              <Text style={[styles.toggleDescription, { color: colors.textSecondary, fontSize: textSize }]}>
                {biometricSettings.isEnabled
                  ? `${biometricLabel} authentication is enabled`
                  : `Enable ${biometricLabel.toLowerCase()} for quick access`}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={handleToggleBiometric}
              disabled={loading || !biometricSettings.isEnrolled}
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
            </TouchableOpacity>
          </View>

          {biometricSettings.isEnabled && (
            <TouchableOpacity 
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
            </TouchableOpacity>
          )}

          <View style={[styles.infoContainer, { backgroundColor: isDark ? colors.backgroundTertiary : '#f9fafb' }]}>
            <Text style={[styles.infoTitle, { color: colors.text, fontSize: titleSize - 2 }]}>Security Information</Text>
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
                Your password is still required for sensitive operations
              </Text>
            </View>
          </View>
        </>
      )}

      {!biometricSettings.isAvailable && (
        <View style={styles.unavailableContainer}>
          <Ionicons name="information-circle" size={48} color={colors.textTertiary} />
          <Text style={[styles.unavailableText, { color: colors.textSecondary, fontSize: textSize }]}>
            Biometric authentication is not supported on this device
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  loadingText: {
    textAlign: "center",
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderBottomWidth: 1,
  },
  iconContainer: {
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontWeight: "600",
    marginBottom: 4,
  },
  subtitle: {
    lineHeight: 20,
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 20,
  },
  toggleContent: {
    flex: 1,
  },
  toggleLabel: {
    fontWeight: "500",
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
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  testButtonText: {
    fontWeight: "500",
    marginLeft: 8,
  },
  infoContainer: {
    padding: 16,
    borderRadius: 12,
  },
  infoTitle: {
    fontWeight: "600",
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    lineHeight: 20,
  },
  unavailableContainer: {
    alignItems: "center",
    padding: 32,
  },
  unavailableText: {
    textAlign: "center",
    marginTop: 16,
    maxWidth: 300,
  },
})