import Button from '@/components/Button';
import InitialsAvatar from '@/components/InitialsAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/contexts/BalanceContext';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { Bell, Mail, PencilLine, Phone, User, Building2, Gift, CircleHelp as HelpCircle, Languages, Link2, Lock, LogOut, MessageSquare, Moon, Shield, FileSliders as Sliders, FileText as Terms, ChevronRight, Eye, Fingerprint, Clock, DollarSign } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AccountStatementModal from '@/components/AccountStatementModal';
import HelpCenterModal from '@/components/HelpCenterModal';
import LanguageModal from '@/components/LanguageModal';
import LogoutModal from '@/components/LogoutModal';
import NotificationSettingsModal from '@/components/NotificationSettingsModal';
import SecurityModal from '@/components/SecurityModal';
import SupportModal from '@/components/SupportModal';
import TermsModal from '@/components/TermsModal';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const { showBalances, toggleBalances } = useBalance();
  const { theme, setTheme, colors } = useTheme();
  const firstName = session?.user?.user_metadata?.first_name || '';
  const lastName = session?.user?.user_metadata?.last_name || '';
  const email = session?.user?.email || '';

  const [biometrics, setBiometrics] = useState(true);
  const [vaultAlerts, setVaultAlerts] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [expiryReminders, setExpiryReminders] = useState(false);

  // Modal visibility states
  const [showAccountStatement, setShowAccountStatement] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  const handleViewProfile = () => {
    router.push('/profile');
  };

  const handleViewLinkedAccounts = () => {
    router.push('/linked-accounts');
  };

  const handleViewReferral = () => {
    router.push('/referral');
  };

  const handleChangePassword = () => {
    router.push('/change-password');
  };

  const handleTwoFactorAuth = () => {
    router.push('/two-factor-auth');
  };

  const handleTransactionLimits = () => {
    router.push('/transaction-limits');
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setShowLogout(false);
      // Remove router.replace('/') - let the root layout handle navigation
    } catch (error) {
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            // TODO: Implement account deletion
            Alert.alert('Feature Coming Soon', 'Account deletion will be available in a future update.');
          }
        }
      ]
    );
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.profileSection}>
          <Pressable style={styles.profileInfo} onPress={handleViewProfile}>
            <InitialsAvatar 
              firstName={firstName} 
              lastName={lastName} 
              size={48}
              fontSize={20}
            />
            <View style={styles.profileText}>
              <Text style={styles.profileName}>{firstName} {lastName}</Text>
              <Text style={styles.profileEmail}>{email}</Text>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#EFF6FF' }]}>
              <Eye size={20} color="#3B82F6" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Show Dashboard Balances</Text>
              <Text style={styles.settingDescription}>Hide or display wallet and vault balances on your dashboard</Text>
            </View>
            <Switch
              value={showBalances}
              onValueChange={toggleBalances}
              trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
              thumbColor={showBalances ? '#3B82F6' : colors.backgroundTertiary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#F0FDF4' }]}>
              <Fingerprint size={20} color="#22C55E" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Enable Biometrics</Text>
              <Text style={styles.settingDescription}>Use biometrics to sign in or approve vault actions</Text>
            </View>
            <Switch
              value={biometrics}
              onValueChange={setBiometrics}
              trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
              thumbColor={biometrics ? '#3B82F6' : colors.backgroundTertiary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Management</Text>
          
          <Pressable 
            style={styles.settingItem}
            onPress={() => setShowAccountStatement(true)}
          >
            <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
              <Terms size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Generate Account Statement</Text>
              <Text style={styles.settingDescription}>PDF/CSV export, custom range</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>

          <Pressable 
            style={styles.settingItem}
            onPress={handleViewLinkedAccounts}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#F0F9FF' }]}>
              <Building2 size={20} color="#0EA5E9" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Linked Bank Accounts</Text>
              <Text style={styles.settingDescription}>Manage, verify, add/remove</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>

          <Pressable 
            style={styles.settingItem}
            onPress={handleTransactionLimits}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#FEF3C7' }]}>
              <DollarSign size={20} color="#D97706" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Transaction Limits</Text>
              <Text style={styles.settingDescription}>Set daily and per-transaction limits</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>

          <Pressable 
            style={styles.settingItem}
            onPress={handleViewReferral}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#FDF2F8' }]}>
              <Gift size={20} color="#EC4899" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Referral Program</Text>
              <Text style={styles.settingDescription}>Your code & bonuses</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <Pressable 
            style={styles.settingItem}
            onPress={handleChangePassword}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#FEE2E2' }]}>
              <Lock size={20} color="#EF4444" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Change Password</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>

          <Pressable 
            style={styles.settingItem}
            onPress={handleTwoFactorAuth}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#F0FDF4' }]}>
              <Shield size={20} color="#22C55E" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#FEF9C3' }]}>
              <Bell size={20} color="#CA8A04" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Vault Payout Alerts</Text>
            </View>
            <Switch
              value={vaultAlerts}
              onValueChange={setVaultAlerts}
              trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
              thumbColor={vaultAlerts ? '#3B82F6' : colors.backgroundTertiary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#EFF6FF' }]}>
              <Shield size={20} color="#3B82F6" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>New Login Notifications</Text>
            </View>
            <Switch
              value={loginAlerts}
              onValueChange={setLoginAlerts}
              trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
              thumbColor={loginAlerts ? '#3B82F6' : colors.backgroundTertiary}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: '#F5F3FF' }]}>
              <Clock size={20} color="#8B5CF6" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Plan Expiry Reminders</Text>
            </View>
            <Switch
              value={expiryReminders}
              onValueChange={setExpiryReminders}
              trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
              thumbColor={expiryReminders ? '#3B82F6' : colors.backgroundTertiary}
            />
          </View>

          <Pressable 
            style={styles.settingItem}
            onPress={() => setShowNotificationSettings(true)}
          >
            <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
              <Sliders size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Customize Notifications</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App & Support</Text>
          
          <Pressable 
            style={styles.settingItem}
            onPress={() => setShowHelpCenter(true)}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#FFF7ED' }]}>
              <HelpCircle size={20} color="#F97316" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Help Center</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>

          <Pressable 
            style={styles.settingItem}
            onPress={() => setShowSupport(true)}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#EFF6FF' }]}>
              <MessageSquare size={20} color="#3B82F6" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Contact Support</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>

          <View style={styles.settingItem}>
            <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
              <Moon size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Theme</Text>
              <Text style={styles.settingDescription}>
                {theme === 'system' ? 'Follow system' : theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </Text>
            </View>
            <View style={styles.themeSelector}>
              <Pressable
                style={[styles.themeOption, theme === 'light' && styles.activeThemeOption]}
                onPress={() => handleThemeChange('light')}
              >
                <Text style={[styles.themeOptionText, theme === 'light' && styles.activeThemeOptionText]}>
                  Light
                </Text>
              </Pressable>
              <Pressable
                style={[styles.themeOption, theme === 'dark' && styles.activeThemeOption]}
                onPress={() => handleThemeChange('dark')}
              >
                <Text style={[styles.themeOptionText, theme === 'dark' && styles.activeThemeOptionText]}>
                  Dark
                </Text>
              </Pressable>
              <Pressable
                style={[styles.themeOption, theme === 'system' && styles.activeThemeOption]}
                onPress={() => handleThemeChange('system')}
              >
                <Text style={[styles.themeOptionText, theme === 'system' && styles.activeThemeOptionText]}>
                  Auto
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable 
            style={styles.settingItem}
            onPress={() => setShowLanguage(true)}
          >
            <View style={[styles.settingIcon, { backgroundColor: '#F0FDF4' }]}>
              <Languages size={20} color="#22C55E" />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Language Preference</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>

          <Pressable 
            style={styles.settingItem}
            onPress={() => setShowTerms(true)}
          >
            <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
              <Terms size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Terms & Privacy</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Pressable 
            style={styles.logoutButton}
            onPress={() => setShowLogout(true)}
          >
            <LogOut size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>

          <Pressable 
            style={styles.deleteAccount}
            onPress={handleDeleteAccount}
          >
            <Text style={styles.deleteText}>Delete Account</Text>
          </Pressable>
        </View>
      </ScrollView>

      <AccountStatementModal
        isVisible={showAccountStatement}
        onClose={() => setShowAccountStatement(false)}
      />

      <NotificationSettingsModal
        isVisible={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />

      <SecurityModal
        isVisible={showSecurity}
        onClose={() => setShowSecurity(false)}
      />

      <HelpCenterModal
        isVisible={showHelpCenter}
        onClose={() => setShowHelpCenter(false)}
      />

      <SupportModal
        isVisible={showSupport}
        onClose={() => setShowSupport(false)}
      />

      <LanguageModal
        isVisible={showLanguage}
        onClose={() => setShowLanguage(false)}
      />

      <TermsModal
        isVisible={showTerms}
        onClose={() => setShowTerms(false)}
      />

      <LogoutModal
        isVisible={showLogout}
        onClose={() => setShowLogout(false)}
        onConfirmLogout={handleLogout}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  profileSection: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileText: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  verifiedBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  verifiedText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  settingDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  themeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: 2,
  },
  themeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  activeThemeOption: {
    backgroundColor: colors.primary,
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeThemeOptionText: {
    color: '#FFFFFF',
  },
  footer: {
    padding: 16,
    gap: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAccount: {
    alignItems: 'center',
  },
  deleteText: {
    color: colors.textTertiary,
    fontSize: 14,
  },
});