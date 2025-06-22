import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mail, Info } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import EmailNotificationSettings from '@/components/EmailNotificationSettings';
import SafeFooter from '@/components/SafeFooter';
import { useHaptics } from '@/hooks/useHaptics';
import { Platform } from 'react-native';

export default function EmailPreferencesScreen() {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();

  const handleBack = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.back();
  };

  const styles = createStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Email Preferences</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <Mail size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Manage Email Notifications</Text>
          <Text style={styles.description}>
            Choose which emails you want to receive from Planmoni. You'll always receive important account notifications.
          </Text>
        </View>

        <EmailNotificationSettings />

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.infoIconContainer}>
              <Info size={20} color={colors.primary} />
            </View>
            <Text style={styles.infoTitle}>About Email Notifications</Text>
          </View>
          <Text style={styles.infoText}>
            We send email notifications to help you stay informed about your account activity and important updates. You can change these settings at any time.
          </Text>
          <Text style={styles.infoText}>
            Note: Some emails, such as password resets and security alerts, cannot be disabled as they are essential for account security.
          </Text>
        </View>
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
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    marginTop: 32,
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
});