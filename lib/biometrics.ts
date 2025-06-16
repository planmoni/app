import * as LocalAuthentication from "expo-local-authentication"
import * as SecureStore from "expo-secure-store"
import { Alert, Platform } from "react-native"
import * as Linking from 'expo-linking';

export interface BiometricSettings {
  isEnabled: boolean
  supportedTypes: LocalAuthentication.AuthenticationType[]
  isEnrolled: boolean
  isAvailable: boolean
}

const BIOMETRIC_SETTINGS_KEY = "biometric_settings"
const BIOMETRIC_TOKEN_KEY = "biometric_token"

export class BiometricService {
  static async checkBiometricSupport(): Promise<BiometricSettings> {
    // Return default values for web platform
    if (Platform.OS === 'web') {
      return {
        isEnabled: false,
        supportedTypes: [],
        isEnrolled: false,
        isAvailable: false,
      }
    }

    try {
      const isAvailable = await LocalAuthentication.hasHardwareAsync()
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync()
      const isEnrolled = await LocalAuthentication.isEnrolledAsync()

      const settings = await this.getBiometricSettings()

      return {
        isEnabled: settings.isEnabled && isAvailable && isEnrolled,
        supportedTypes,
        isEnrolled,
        isAvailable,
      }
    } catch (error) {
      console.error("Error checking biometric support:", error)
      return {
        isEnabled: false,
        supportedTypes: [],
        isEnrolled: false,
        isAvailable: false,
      }
    }
  }

  static async getBiometricSettings(): Promise<{ isEnabled: boolean }> {
    // Return default values for web platform
    if (Platform.OS === 'web') {
      return { isEnabled: false }
    }

    try {
      const settings = await SecureStore.getItemAsync(BIOMETRIC_SETTINGS_KEY)
      return settings ? JSON.parse(settings) : { isEnabled: false }
    } catch (error) {
      console.error("Error getting biometric settings:", error)
      return { isEnabled: false }
    }
  }

  static async setBiometricEnabled(enabled: boolean): Promise<boolean> {
    // Return false for web platform
    if (Platform.OS === 'web') {
      console.warn("Biometric authentication is not available on web platform")
      return false
    }

    try {
      if (enabled) {
        // Check if biometrics are available before enabling
        const support = await this.checkBiometricSupport()
        if (!support.isAvailable) {
          Alert.alert("Biometrics Not Available", "Your device does not support biometric authentication.")
          return false
        }

        if (!support.isEnrolled) {
          Alert.alert(
            "No Biometrics Enrolled",
            "Please set up biometric authentication in your device settings first.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Settings", onPress: () => Linking.openSettings() },
            ],
          )
          return false
        }

        // Test biometric authentication before enabling
        const authResult = await this.authenticateWithBiometrics("Enable biometric authentication for Planmoni?")
        if (!authResult.success) {
          return false
        }
      }

      const settings = { isEnabled: enabled }
      await SecureStore.setItemAsync(BIOMETRIC_SETTINGS_KEY, JSON.stringify(settings))

      if (!enabled) {
        // Clear stored biometric token when disabled
        await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY)
      }

      return true
    } catch (error) {
      console.error("Error setting biometric enabled:", error)
      Alert.alert("Error", "Failed to update biometric settings")
      return false
    }
  }

  static async authenticateWithBiometrics(
    promptMessage = "Authenticate to access Planmoni",
  ): Promise<{ success: boolean; error?: string }> {
    // Return failure for web platform
    if (Platform.OS === 'web') {
      return { success: false, error: "Biometric authentication not available on web platform" }
    }

    try {
      const support = await this.checkBiometricSupport()

      if (!support.isAvailable) {
        return { success: false, error: "Biometric authentication not available" }
      }

      if (!support.isEnrolled) {
        return { success: false, error: "No biometric credentials enrolled" }
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: "Cancel",
        fallbackLabel: "Use Password",
        disableDeviceFallback: false,
      })

      if (result.success) {
        return { success: true }
      } else {
        let errorMessage = "Authentication failed"

        if (result.error === "user_cancel") {
          errorMessage = "Authentication cancelled"
        } else if (result.error === "user_fallback") {
          errorMessage = "User chose fallback authentication"
        } else if (result.error === "system_cancel") {
          errorMessage = "Authentication was cancelled by the system"
        } else if (result.error === "app_cancel") {
          errorMessage = "Authentication was cancelled by the app"
        } else if (result.error === "invalid_context") {
          errorMessage = "Authentication context is invalid"
        }

        return { success: false, error: errorMessage }
      }
    } catch (error) {
      console.error("Biometric authentication error:", error)
      return { success: false, error: "Authentication error occurred" }
    }
  }

  static async storeBiometricToken(token: string): Promise<void> {
    // Do nothing for web platform
    if (Platform.OS === 'web') {
      console.warn("Secure storage is not available on web platform")
      return
    }

    try {
      await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token)
    } catch (error) {
      console.error("Error storing biometric token:", error)
    }
  }

  static async getBiometricToken(): Promise<string | null> {
    // Return null for web platform
    if (Platform.OS === 'web') {
      return null
    }

    try {
      return await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY)
    } catch (error) {
      console.error("Error getting biometric token:", error)
      return null
    }
  }

  static getBiometricTypeLabel(types: LocalAuthentication.AuthenticationType[]): string {
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return "Face ID"
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return "Fingerprint"
    } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return "Iris"
    } else {
      return "Biometric"
    }
  }

  static getBiometricIcon(types: LocalAuthentication.AuthenticationType[]): string {
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return "face-recognition" // This might need to be 'person' for Ionicons
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return "finger-print"
    } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return "eye"
    } else {
      return "shield-checkmark"
    }
  }
}