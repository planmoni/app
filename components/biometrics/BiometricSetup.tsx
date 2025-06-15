"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { BiometricService } from "@/lib/biometrics"

export const BiometricSetup: React.FC = () => {
  const [biometricSettings, setBiometricSettings] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)

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
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#2563eb" />
        <Text style={styles.loadingText}>Checking biometric support...</Text>
      </View>
    )
  }

  const biometricLabel = BiometricService.getBiometricTypeLabel(biometricSettings.supportedTypes)
  const biometricIcon = BiometricService.getBiometricIcon(biometricSettings.supportedTypes)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name={biometricIcon as any} size={24} color="#2563eb" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{biometricLabel} Authentication</Text>
          <Text style={styles.subtitle}>
            {biometricSettings.isAvailable
              ? `Use ${biometricLabel.toLowerCase()} to quickly and securely access your account`
              : "Biometric authentication is not available on this device"}
          </Text>
        </View>
      </View>

      {biometricSettings.isAvailable && (
        <>
          {!biometricSettings.isEnrolled && (
            <View style={styles.warningContainer}>
              <Ionicons name="warning" size={20} color="#f59e0b" />
              <Text style={styles.warningText}>
                No biometric credentials are enrolled on this device. Please set up {biometricLabel.toLowerCase()} in
                your device settings.
              </Text>
            </View>
          )}

          <View style={styles.toggleContainer}>
            <View style={styles.toggleContent}>
              <Text style={styles.toggleLabel}>Enable {biometricLabel}</Text>
              <Text style={styles.toggleDescription}>
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
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <View style={[styles.toggle, biometricSettings.isEnabled && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, biometricSettings.isEnabled && styles.toggleThumbActive]} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {biometricSettings.isEnabled && (
            <TouchableOpacity style={styles.testButton} onPress={handleTestBiometric} disabled={testing}>
              {testing ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <Ionicons name="play-circle" size={20} color="#2563eb" />
              )}
              <Text style={styles.testButtonText}>{testing ? "Testing..." : `Test ${biometricLabel}`}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>Security Information</Text>
            <View style={styles.infoItem}>
              <Ionicons name="shield-checkmark" size={16} color="#10b981" />
              <Text style={styles.infoText}>
                Your biometric data is stored securely on your device and never shared
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="lock-closed" size={16} color="#10b981" />
              <Text style={styles.infoText}>You can disable biometric authentication at any time</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="key" size={16} color="#10b981" />
              <Text style={styles.infoText}>Your password is still required for sensitive operations</Text>
            </View>
          </View>
        </>
      )}

      {!biometricSettings.isAvailable && (
        <View style={styles.unavailableContainer}>
          <Ionicons name="information-circle" size={48} color="#6b7280" />
          <Text style={styles.unavailableText}>Biometric authentication is not supported on this device</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    margin: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    textAlign: "center",
    color: "#6b7280",
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fffbeb",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: "#92400e",
    marginLeft: 8,
    lineHeight: 18,
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f3f4f6",
    marginBottom: 20,
  },
  toggleContent: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1f2937",
  },
  toggleDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  toggleButton: {
    marginLeft: 16,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#d1d5db",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: "#2563eb",
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "white",
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },
  testButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#2563eb",
    marginLeft: 8,
  },
  infoContainer: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#6b7280",
    marginLeft: 8,
    lineHeight: 18,
  },
  unavailableContainer: {
    alignItems: "center",
    padding: 32,
  },
  unavailableText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 16,
  },
})