import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getItem, saveItem } from '@/lib/secure-storage';

const APP_BLUR_ENABLED_KEY = 'app_blur_enabled';

interface AppBlurSettingsProps {
  onToggle?: (enabled: boolean) => void;
}

export default function AppBlurSettings({ onToggle }: AppBlurSettingsProps) {
  const { colors } = useTheme();
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    loadSettings();
  }, []);

  if (Platform.OS !== 'ios') {
    return null;
  }

  const loadSettings = async () => {
    try {
      const enabled = await getItem(APP_BLUR_ENABLED_KEY);
      if (enabled !== null) {
        setIsEnabled(enabled === 'true');
      }
    } catch (error) {
      console.error('Failed to load app blur settings:', error);
    }
  };

  const handleToggle = async (value: boolean) => {
    try {
      await saveItem(APP_BLUR_ENABLED_KEY, value.toString());
      setIsEnabled(value);
      onToggle?.(value);
    } catch (error) {
      console.error('Failed to save app blur settings:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>
            App Blur Security
          </Text>
          <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
            Blur app content when minimized for enhanced security
          </Text>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={isEnabled ? '#FFFFFF' : colors.textSecondary}
        />
      </View>
    </View>
  );
}

export const isAppBlurEnabled = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    const enabled = await getItem(APP_BLUR_ENABLED_KEY);
    return enabled === null ? true : enabled === 'true'; // Default to enabled
  } catch (error) {
    console.error('Failed to check app blur settings:', error);
    return true; // Default to enabled on error
  }
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});
