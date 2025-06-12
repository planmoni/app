import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Custom hook for handling haptic feedback with platform checks
 */
export function useHaptics() {
  /**
   * Trigger impact feedback with specified intensity
   */
  const impact = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  };

  /**
   * Trigger notification feedback with specified type
   */
  const notification = (type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(type);
    }
  };

  /**
   * Trigger selection feedback
   */
  const selection = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  };

  return {
    impact,
    notification,
    selection
  };
}