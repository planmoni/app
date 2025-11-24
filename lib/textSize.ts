/**
 * Helper function to apply text size multiplier to font sizes
 * @param baseSize - The base font size (can be iOS or Android specific)
 * @param multiplier - The text size multiplier (0.75 to 1.5)
 * @returns The scaled font size
 */
export function getScaledFontSize(baseSize: number, multiplier: number): number {
  // Round to 1 decimal place for cleaner values
  return Math.round((baseSize * multiplier) * 10) / 10;
}

/**
 * Helper function to scale font sizes that have Platform.OS conditional logic
 * @param iosSize - Font size for iOS
 * @param androidSize - Font size for Android
 * @param multiplier - The text size multiplier (0.75 to 1.5)
 * @returns Object with scaled fontSize for iOS and Android
 */
export function getScaledPlatformFontSize(
  iosSize: number,
  androidSize: number,
  multiplier: number
): { ios: number; android: number } {
  return {
    ios: getScaledFontSize(iosSize, multiplier),
    android: getScaledFontSize(androidSize, multiplier),
  };
}

