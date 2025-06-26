import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Alert } from 'react-native';
import { ArrowLeft, Shield, Eye, Bell, Lock, Database, Share2, Trash2, Download } from 'lucide-react-native';
import { router } from 'expo-router';
import Button from '@/components/Button';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

export default function PrivacySettingsScreen() {
  const { colors } = useTheme();
  
  // Privacy settings state
  const [dataCollection, setDataCollection] = useState(true);
  const [analyticsTracking, setAnalyticsTracking] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState(false);
  const [activityTracking, setActivityTracking] = useState(true);
  const [thirdPartySharing, setThirdPartySharing] = useState(false);
  const [locationTracking, setLocationTracking] = useState(false);
  const [cookieConsent, setCookieConsent] = useState(true);

  const handleDataExport = () => {
    Alert.alert(
      'Export Data',
      'We will prepare your data export and send it to your email address within 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Request Export', onPress: () => {
          Alert.alert('Success', 'Your data export request has been submitted.');
        }}
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Account', 
          style: 'destructive',
          onPress: () => {
            Alert.alert('Account Deletion', 'Please contact support to proceed with account deletion.');
          }
        }
      ]
    );
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.subtitle}>
          Manage your privacy preferences and control how your data is used
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Analytics</Text>
          
          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#EFF6FF' }]}>
              <Database size={20} color="#1E3A8A" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Data Collection</Text>
              <Text style={styles.settingDescription}>Allow collection of usage data to improve our services</Text>
            </View>
            <Switch
              value={dataCollection}
              onValueChange={setDataCollection}
              trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
              thumbColor={dataCollection ? '#1E3A8A' : colors.backgroundTertiary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#F5F3FF' }]}>
              <Eye size={20} color="#8B5CF6" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Analytics Tracking</Text>
              <Text style={styles.settingDescription}>Help us understand how you use the app</Text>
            </View>
            <Switch
              value={analyticsTracking}
              onValueChange={setAnalyticsTracking}
              trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
              thumbColor={analyticsTracking ? '#1E3A8A' : colors.backgroundTertiary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#FFF7ED' }]}>
              <Share2 size={20} color="#F97316" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Third-party Sharing</Text>
              <Text style={styles.settingDescription}>Share anonymized data with trusted partners</Text>
            </View>
            <Switch
              value={thirdPartySharing}
              onValueChange={setThirdPartySharing}
              trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
              thumbColor={thirdPartySharing ? '#1E3A8A' : colors.backgroundTertiary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Communication</Text>
          
          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#F0FDF4' }]}>
              <Bell size={20} color="#22C55E" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Marketing Emails</Text>
              <Text style={styles.settingDescription}>Receive promotional emails and product updates</Text>
            </View>
            <Switch
              value={marketingEmails}
              onValueChange={setMarketingEmails}
              trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
              thumbColor={marketingEmails ? '#1E3A8A' : colors.backgroundTertiary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile & Activity</Text>
          
          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#FEF3C7' }]}>
              <Eye size={20} color="#D97706" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Profile Visibility</Text>
              <Text style={styles.settingDescription}>Make your profile visible to other users</Text>
            </View>
            <Switch
              value={profileVisibility}
              onValueChange={setProfileVisibility}
              trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
              thumbColor={profileVisibility ? '#1E3A8A' : colors.backgroundTertiary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#F0F9FF' }]}>
              <Shield size={20} color="#0EA5E9" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Activity Tracking</Text>
              <Text style={styles.settingDescription}>Track your app usage for personalized insights</Text>
            </View>
            <Switch
              value={activityTracking}
              onValueChange={setActivityTracking}
              trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
              thumbColor={activityTracking ? '#1E3A8A' : colors.backgroundTertiary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#FDF2F8' }]}>
              <Lock size={20} color="#EC4899" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Location Tracking</Text>
              <Text style={styles.settingDescription}>Use location data for enhanced features</Text>
            </View>
            <Switch
              value={locationTracking}
              onValueChange={setLocationTracking}
              trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
              thumbColor={locationTracking ? '#1E3A8A' : colors.backgroundTertiary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cookies & Tracking</Text>
          
          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
              <Database size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Cookie Consent</Text>
              <Text style={styles.settingDescription}>Allow cookies for better user experience</Text>
            </View>
            <Switch
              value={cookieConsent}
              onValueChange={setCookieConsent}
              trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
              thumbColor={cookieConsent ? '#1E3A8A' : colors.backgroundTertiary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          
          <Pressable style={styles.actionItem} onPress={handleDataExport}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#EFF6FF' }]}>
                <Download size={20} color="#1E3A8A" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Export My Data</Text>
                <Text style={styles.actionDescription}>Download a copy of your personal data</Text>
              </View>
            </View>
          </Pressable>

          <Pressable style={styles.actionItem} onPress={handleDeleteAccount}>
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: '#FEE2E2' }]}>
                <Trash2 size={20} color="#EF4444" />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, { color: '#EF4444' }]}>Delete Account</Text>
                <Text style={styles.actionDescription}>Permanently delete your account and all data</Text>
              </View>
            </View>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.infoIconContainer}>
              <Shield size={20} color={colors.primary} />
            </View>
            <Text style={styles.infoTitle}>Your Privacy Matters</Text>
          </View>
          <Text style={styles.infoText}>
            We are committed to protecting your privacy and giving you control over your personal data. You can change these settings at any time.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
    lineHeight: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actionItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  actionDescription: {
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
    marginTop: 16,
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
    backgroundColor: colors.backgroundTertiary,
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
  },
});