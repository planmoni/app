import { View, Text, StyleSheet, Pressable, ScrollView, Switch, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, Info, Megaphone, BookOpen, Newspaper, Gift } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import SafeFooter from '@/components/SafeFooter';
import { useHaptics } from '@/hooks/useHaptics';
import { useEmailNotifications } from '@/hooks/useEmailNotifications';

export default function MarketingPreferencesScreen() {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { marketingSettings, isLoading, error, updateMarketingSettings } = useEmailNotifications();

  const [localSettings, setLocalSettings] = useState(marketingSettings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setLocalSettings(marketingSettings);
    }
  }, [isLoading, marketingSettings]);

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.back();
  };

  const handleToggle = (setting: keyof typeof marketingSettings) => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }

    setLocalSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const handleSaveChanges = async () => {
    if (Platform.OS !== 'web') {
      haptics.mediumImpact();
    }

    setIsSaving(true);
    try {
      const success = await updateMarketingSettings(localSettings);

      if (success) {
        if (Platform.OS !== 'web') {
          haptics.success();
        }
      } else {
        if (Platform.OS !== 'web') {
          haptics.error();
        }
      }
    } catch (error) {
      console.error('Error saving marketing settings:', error);

      if (Platform.OS !== 'web') {
        haptics.error();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(colors, isDark);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Marketing & Updates</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Marketing & Updates</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => window.location.reload()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Marketing & Updates</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.heroSection}>
          <Text style={styles.title}>Marketing Email Preferences</Text>
          <Text style={styles.description}>
            Choose which types of marketing emails you'd like to receive from Planmoni. You can unsubscribe at any time.
          </Text>
        </View>

        <View style={styles.preferencesCard}>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <Gift size={20} color={colors.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Promotional Offers</Text>
                <Text style={styles.settingDescription}>
                  Special deals, discounts, and exclusive offers just for you
                </Text>
              </View>
            </View>
            <Switch
              value={localSettings.promotional}
              onValueChange={() => handleToggle('promotional')}
              trackColor={{ false: colors.borderSecondary, true: '#D1EAAE' }}
              thumbColor={localSettings.promotional ? '#1E3A8A' : colors.backgroundTertiary}
              disabled={isSaving}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <Megaphone size={20} color={colors.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Product Updates</Text>
                <Text style={styles.settingDescription}>
                  New features, improvements, and platform announcements
                </Text>
              </View>
            </View>
            <Switch
              value={localSettings.product_updates}
              onValueChange={() => handleToggle('product_updates')}
              trackColor={{ false: colors.borderSecondary, true: '#D1EAAE' }}
              thumbColor={localSettings.product_updates ? '#1E3A8A' : colors.backgroundTertiary}
              disabled={isSaving}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <BookOpen size={20} color={colors.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Educational Content</Text>
                <Text style={styles.settingDescription}>
                  Financial tips, guides, insights, and best practices
                </Text>
              </View>
            </View>
            <Switch
              value={localSettings.educational}
              onValueChange={() => handleToggle('educational')}
              trackColor={{ false: colors.borderSecondary, true: '#D1EAAE' }}
              thumbColor={localSettings.educational ? '#1E3A8A' : colors.backgroundTertiary}
              disabled={isSaving}
            />
          </View>

          <View style={[styles.settingItem, styles.lastSettingItem]}>
            <View style={styles.settingInfo}>
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <Newspaper size={20} color={colors.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Newsletters</Text>
                <Text style={styles.settingDescription}>
                  Monthly summaries, company news, and community updates
                </Text>
              </View>
            </View>
            <Switch
              value={localSettings.newsletters}
              onValueChange={() => handleToggle('newsletters')}
              trackColor={{ false: colors.borderSecondary, true: '#D1EAAE' }}
              thumbColor={localSettings.newsletters ? '#1E3A8A' : colors.backgroundTertiary}
              disabled={isSaving}
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.infoIconContainer}>
              <Info size={20} color={colors.primary} />
            </View>
            <Text style={styles.infoTitle}>About Marketing Emails</Text>
          </View>
          <Text style={styles.infoText}>
            Marketing emails are separate from essential account notifications. You'll always receive important emails like password resets, security alerts, and transaction confirmations.
          </Text>
          <Text style={styles.infoText}>
            All marketing emails include an unsubscribe link, allowing you to opt out at any time.
          </Text>
        </View>

        <Pressable
          style={[styles.saveButton, isSaving && styles.savingButton]}
          onPress={handleSaveChanges}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          )}
        </Pressable>
      </ScrollView>

      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  preferencesCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastSettingItem: {
    borderBottomWidth: 0,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 16,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    marginBottom: 24,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 100,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  savingButton: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
