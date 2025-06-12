import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Custom hook for handling haptic feedback with platform compatibility
 */
export function useHaptics() {
  /**
   * Trigger light impact haptic feedback
   * Used for subtle feedback like successful form submissions, button presses
   */
  const lightImpact = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  /**
   * Trigger medium impact haptic feedback
   * Used for more significant actions like completing a transaction
   */
  const mediumImpact = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  /**
   * Trigger heavy impact haptic feedback
   * Used for major events like errors or important confirmations
   */
  const heavyImpact = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };

  /**
   * Trigger success notification haptic feedback
   * Used for successful operations like payments or form submissions
   */
  const success = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  /**
   * Trigger warning notification haptic feedback
   * Used for warning alerts or confirmations of destructive actions
   */
  const warning = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  /**
   * Trigger error notification haptic feedback
   * Used for error states or failed operations
   */
  const error = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  /**
   * Trigger selection haptic feedback
   * Used for selection changes like toggling switches or selecting items
   */
  const selection = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  };

  return {
    lightImpact,
    mediumImpact,
    heavyImpact,
    success,
    warning,
    error,
    selection
  };
}