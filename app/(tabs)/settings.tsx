import Button from '@/components/Button';
import InitialsAvatar from '@/components/InitialsAvatar';
import SafeFooter from '@/components/SafeFooter';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/contexts/BalanceContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { 
  Bell, 
  Building2, 
  ChevronRight, 
  Clock, 
  DollarSign, 
  Eye, 
  FileSliders as Sliders, 
  FileText as Terms, 
  Fingerprint, 
  Gift, 
  CircleHelp as HelpCircle, 
  Languages, 
  Lock, 
  LogOut, 
  MessageSquare, 
  Moon, 
  Shield, 
  ShieldUser,
  Trash2,
  Wallet,
  History,
  AlertTriangle,
  ScanFace,
  ClockAlert
} from 'lucide-react-native';
import { useState, useEffect, useRef } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View , Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HelpCenterModal from '@/components/HelpCenterModal';
import LanguageModal from '@/components/LanguageModal';
import NotificationSettingsModal from '@/components/NotificationSettingsModal';
import SecurityModal from '@/components/SecurityModal';
import SupportModal from '@/components/SupportModal';
import TermsModal from '@/components/TermsModal';
import { logAnalyticsEvent } from '@/lib/firebase';
import React from 'react';
import { useEmailNotifications } from '@/hooks/useEmailNotifications';
import { useAppVersion } from '@/contexts/AppVersionContext';
import Constants from 'expo-constants';
import { Download, Info } from 'lucide-react-native';

export default function SettingsScreen() {
  const { colors, theme, setTheme } = useTheme();
  const { session, signOut } = useAuth();
  const { showBalances, toggleBalances } = useBalance();
  const haptics = useHaptics();
  const { settings: emailSettings, updateSettings: updateEmailSettings } = useEmailNotifications();
  const { needsUpdate, checkForUpdates, currentVersion, currentBuild, isChecking } = useAppVersion();
  
  const firstName = session?.user?.user_metadata?.first_name || '';
  const lastName = session?.user?.user_metadata?.last_name || '';
  const email = session?.user?.email || '';

  // Use email notification settings from the hook
  const vaultAlerts = emailSettings.payout_alerts;
  const loginAlerts = emailSettings.login_alerts;
  const expiryReminders = emailSettings.expiry_reminders;
  
  // 2FA status state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<string>('email');
  const [isLoading2FA, setIsLoading2FA] = useState(true);

  // Modal visibility states
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Log screen view for analytics
  useEffect(() => {
    logAnalyticsEvent('screen_view', {
      screen_name: 'Settings',
      screen_class: 'SettingsScreen',
    });
  }, []);

  // Load 2FA status
  useEffect(() => {
    if (session?.user?.id) {
      fetch2FAStatus();
    }
  }, [session?.user?.id]);

  // Refresh 2FA status when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (session?.user?.id) {
        fetch2FAStatus();
      }
    }, [session?.user?.id])
  );

  const fetch2FAStatus = async () => {
    try {
      setIsLoading2FA(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('two_factor_enabled, two_factor_method, totp_enabled, totp_secret')
        .eq('id', session?.user?.id)
        .single();

      if (error) throw error;
      
      // Only consider 2FA enabled if both flags are true AND there's a TOTP secret
      const isActuallyEnabled = !!(
        data?.two_factor_enabled && 
        data?.totp_enabled && 
        data?.totp_secret
      );
      
      setTwoFactorEnabled(isActuallyEnabled);
      setTwoFactorMethod(data?.two_factor_method || 'email');
    } catch (error) {
      console.error('Error fetching 2FA status:', error);
    } finally {
      setIsLoading2FA(false);
    }
  };

  const handleProfilePress = () => {
    router.push('/profile');
    logAnalyticsEvent('profile_click');
  };

  const handleSignOut = async () => {
    try {
      if (Platform.OS !== 'web') {
        haptics.notification(Haptics.NotificationFeedbackType.Warning);
      }
      Alert.alert(
        "Sign Out",
        "Are you sure you want to sign out?",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              if (Platform.OS !== 'web') {
                haptics.lightImpact();
              }
            }
          },
          {
            text: "Sign Out",
            style: "destructive",
            onPress: async () => {
              if (Platform.OS !== 'web') {
                haptics.heavyImpact();
              }
              logAnalyticsEvent('sign_out');
              await signOut();
              router.replace('/logging-out');
            }
          }
        ]
      );
    } catch (error) {
      if (Platform.OS !== 'web') {
        haptics.notification(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert("Error", "Failed to sign out. Please try again.");
    }
  };

  const handleViewProfile = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.push('/profile');
    logAnalyticsEvent('view_profile');
  };

  const handleViewLinkedAccounts = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.push('/linked-accounts');
    logAnalyticsEvent('view_linked_accounts');
  };
  
  const handleViewPayoutAccounts = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.push('/payout-accounts');
    logAnalyticsEvent('view_payout_accounts');
  };

  const handleViewReferral = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.push('/referral');
    logAnalyticsEvent('view_referral');
  };

  const handleChangePassword = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.push('/change-password');
    logAnalyticsEvent('change_password');
  };

  const handleTwoFactorAuth = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.push('/two-factor-auth');
    logAnalyticsEvent('two_factor_auth', { 
      current_status: twoFactorEnabled ? 'enabled' : 'disabled',
      method: twoFactorMethod 
    });
  };
  const handleLoginHistory = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.push('/login-history');
    logAnalyticsEvent('view_login_history');
  };

  const handleTransactionLimits = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.push('/transaction-limits');
    logAnalyticsEvent('transaction_limits');
  };

  const handleViewTransactionHistory = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.push('/transactions');
    logAnalyticsEvent('view_transaction_history', { source: 'settings' });
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    setTheme(newTheme);
    logAnalyticsEvent('change_theme', { theme: newTheme });
  };

  const handleToggleSwitch = async (settingName: 'payout_alerts' | 'login_alerts' | 'expiry_reminders') => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    
    const currentValue = emailSettings[settingName];
    const newValue = !currentValue;
    
    logAnalyticsEvent('toggle_setting', { setting: settingName, value: newValue });
    
    // Update settings through the hook (persists to database)
    await updateEmailSettings({
      ...emailSettings,
      [settingName]: newValue
    });
  };

  const handleDeleteAccount = () => {
    if (Platform.OS !== 'web') {
      haptics.notification(Haptics.NotificationFeedbackType.Error);
    }
    Alert.alert(
      "Close Account",
      "Are you sure you want to close your account?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
          }
        },
        {
          text: "Yes, Close!",
          style: "destructive",
          onPress: () => {
            if (Platform.OS !== 'web') {
              haptics.heavyImpact();
            }
            logAnalyticsEvent('delete_account_attempt');
            // Implement account deletion logic here
            Alert.alert("Account Deletion", "Please contact support to complete account deletion.");
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
        <Pressable style={styles.profileCard} onPress={handleViewProfile}>
          <View style={styles.profileContent}>
            <InitialsAvatar 
              firstName={firstName} 
              lastName={lastName} 
              size={60}
              fontSize={24}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{firstName} {lastName}</Text>
              <Text style={styles.profileEmail}>{email}</Text>
              <View style={styles.badgeContainer}>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
                {!isLoading2FA && twoFactorEnabled && (
                  <View style={styles.twoFactorBadge}>
                    <Shield size={12} color="#22C55E" />
                    <Text style={styles.twoFactorText}>2FA</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          <ChevronRight size={20} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <Eye size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Show Dashboard Balances</Text>
              </View>
              <Switch
                value={showBalances}
                onValueChange={() => {
                  if (Platform.OS !== 'web') {
                    haptics.selection();
                  }
                  toggleBalances();
                  logAnalyticsEvent('toggle_balance_visibility', { show_balances: !showBalances });
                }}
                trackColor={{ false: colors.borderSecondary, true: '#D1EAAE' }}
                thumbColor={showBalances ? '#1E3A8A' : colors.backgroundTertiary}
              />
            </View>



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
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <View style={styles.card}>
            <Pressable 
              style={styles.settingItem}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.lightImpact();
                }
                router.push('/account-statement');
                logAnalyticsEvent('view_account_statement');
              }}
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
            
            <View style={styles.divider} />

            <Pressable 
              style={styles.settingItem}
              onPress={handleViewTransactionHistory}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <History size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Transaction History</Text>
                <Text style={styles.settingDescription}>View all your transaction records</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            {/* Linked account tab */}

            {/* <Pressable 
              style={styles.settingItem}
              onPress={handleViewLinkedAccounts}
            >
              <View style={[styles.settingIcon, { backgroundColor: '#F0F9FF' }]}> 
                <Building2 size={20} color="#0EA5E9" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Linked Bank Accounts</Text>
                <Text style={styles.settingDescription}>Manage accounts for deposits</Text>
              </View>
             <View style={styles.comingSoonTag}><Text style={styles.comingSoonText}>Coming Soon</Text></View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>
            
            <View style={styles.divider} /> */}

            <Pressable 
              style={styles.settingItem}
              onPress={handleViewPayoutAccounts}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <Wallet size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Payout Accounts</Text>
                <Text style={styles.settingDescription}>Manage accounts for receiving payouts</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            <Pressable 
              style={styles.settingItem}
              onPress={handleTransactionLimits}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <ClockAlert size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Transaction Limits</Text>
                <Text style={styles.settingDescription}>See your transaction limits</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            {/* <Pressable 
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
            </Pressable> */}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <View style={styles.card}>
            <Pressable 
              style={styles.settingItem}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.lightImpact();
                }
                router.push('/settings/security-center');
                logAnalyticsEvent('view_security_center');
              }}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <ScanFace size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Security Center</Text>
                <Text style={styles.settingDescription}>Manage PINs, biometrics, and security settings</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            <Pressable 
              style={styles.settingItem}
              onPress={handleChangePassword}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <Lock size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Change Password</Text>
                <Text style={styles.settingDescription}>Update your account password</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            <Pressable 
              style={styles.settingItem}
              onPress={handleTwoFactorAuth}
            >
              <View style={[
                styles.settingIcon, 
                { backgroundColor: twoFactorEnabled ? colors.backgroundTertiary : colors.backgroundTertiary }
              ]}>
                <ShieldUser size={20} color={twoFactorEnabled ? colors.primary : colors.textTertiary} />
              </View>
              <View style={styles.settingContent}>
                <View style={styles.settingLabelContainer}>
                  <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
                  {!isLoading2FA && (
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: twoFactorEnabled ? colors.backgroundTertiary : colors.backgroundTertiary }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: twoFactorEnabled ? colors.primary : colors.textTertiary }
                      ]}>
                        {twoFactorEnabled ? 'Enabled' : 'Not Enabled'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.settingDescription}>
                  {isLoading2FA 
                    ? 'Loading...' 
                    : twoFactorEnabled 
                      ? `Protected with ${twoFactorMethod === 'authenticator' ? 'Authenticator App' : 'Email'}`
                      : 'Add an extra layer of security'
                  }
                </Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>
            
            <View style={styles.divider} />

            <Pressable
              style={styles.settingItem}
              onPress={handleLoginHistory}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <History size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Login History</Text>
                <Text style={styles.settingDescription}>View your recent login activity</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <Bell size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Payout Alerts</Text>
                <Text style={styles.settingDescription}>Get notified about payouts</Text>
              </View>
              <Switch
                value={vaultAlerts}
                onValueChange={() => handleToggleSwitch('payout_alerts')}
                trackColor={{ false: colors.borderSecondary, true: '#D1EAAE' }}
                thumbColor={vaultAlerts ? '#1E3A8A' : colors.backgroundTertiary}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <AlertTriangle size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>New Login Notifications</Text>
                <Text style={styles.settingDescription}>Security alerts for new logins</Text>
              </View>
              <Switch
                value={loginAlerts}
                onValueChange={() => handleToggleSwitch('login_alerts')}
                trackColor={{ false: colors.borderSecondary, true: '#D1EAAE' }}
                thumbColor={loginAlerts ? '#1E3A8A' : colors.backgroundTertiary}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <Clock size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Plan Expiry Reminders</Text>
                <Text style={styles.settingDescription}>Get notified before plans expire</Text>
              </View>
              <Switch
                value={expiryReminders}
                onValueChange={() => handleToggleSwitch('expiry_reminders')}
                trackColor={{ false: colors.borderSecondary, true: '#D1EAAE' }}
                thumbColor={expiryReminders ? '#1E3A8A' : colors.backgroundTertiary}
              />
            </View>

            <View style={styles.divider} />

            <Pressable 
              style={styles.settingItem}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.lightImpact();
                }
                setShowNotificationSettings(true);
                logAnalyticsEvent('view_notification_settings');
              }}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <Sliders size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Customize Notifications</Text>
                <Text style={styles.settingDescription}>Fine-tune your notification preferences</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & Legal</Text>
          
          <View style={styles.card}>
            <Pressable 
              style={styles.settingItem}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.lightImpact();
                }
                setShowHelpCenter(true);
                logAnalyticsEvent('view_help_center');
              }}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <MessageSquare size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Help & Support</Text>
                <Text style={styles.settingDescription}>FAQ, chat with support, submit a ticket, knowledge base, </Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            {/* <Pressable 
              style={styles.settingItem}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.lightImpact();
                }
                setShowLanguage(true);
                logAnalyticsEvent('language_preference');
              }}
            >
              <View style={[styles.settingIcon, { backgroundColor: '#F0FDF4' }]}>
                <Languages size={20} color="#22C55E" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Language Preference</Text>
                <Text style={styles.settingDescription}>Change app language</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} /> */}

            <Pressable 
              style={styles.settingItem}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.lightImpact();
                }
                setShowTerms(true);
                logAnalyticsEvent('view_terms');
              }}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <Terms size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Terms & Privacy</Text>
                <Text style={styles.settingDescription}>Legal information</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>
          </View>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>

          <View style={styles.card}>
            <Pressable
              style={styles.settingItem}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.lightImpact();
                }
                checkForUpdates();
                logAnalyticsEvent('check_for_updates_manual');
              }}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.backgroundTertiary }]}>
                <Info size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>App Version</Text>
                <Text style={styles.settingDescription}>
                  Version {currentVersion} (Build {currentBuild})
                </Text>
              </View>
              {needsUpdate && (
                <View style={styles.updateBadge}>
                  <Download size={14} color="#FFFFFF" />
                </View>
              )}
            </Pressable>

            {needsUpdate && (
              <>
                <View style={styles.divider} />
                <Pressable
                  style={styles.settingItem}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      haptics.selection();
                    }
                    checkForUpdates();
                    logAnalyticsEvent('trigger_update_modal');
                  }}
                >
                  <View style={[styles.settingIcon, { backgroundColor: '#EFF6FF' }]}>
                    <Download size={20} color="#1E3A8A" />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={[styles.settingLabel, { color: colors.primary }]}>Update Available</Text>
                    <Text style={styles.settingDescription}>Tap to update to the latest version</Text>
                  </View>
                  <ChevronRight size={20} color={colors.primary} />
                </Pressable>
              </>
            )}
          </View>
        </View>

        <View style={styles.accountActions}>

          <Pressable 
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <LogOut size={20} color="#EF4444" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
          
          <Pressable 
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
          >
            <Trash2 size={20} color={colors.textTertiary} />
            <Text style={styles.deleteAccountText}>Close your account</Text>
          </Pressable>
        </View>
      </ScrollView>

     

      <NotificationSettingsModal
        isVisible={showNotificationSettings}
        onClose={() => {
          if (Platform.OS !== 'web') {
            haptics.lightImpact();
          }
          setShowNotificationSettings(false);
        }}
      />

      <SecurityModal
        isVisible={showSecurity}
        onClose={() => {
          if (Platform.OS !== 'web') {
            haptics.lightImpact();
          }
          setShowSecurity(false);
        }}
      />

      <HelpCenterModal
        isVisible={showHelpCenter}
        onClose={() => {
          if (Platform.OS !== 'web') {
            haptics.lightImpact();
          }
          setShowHelpCenter(false);
        }}
      />

      <SupportModal
        isVisible={showSupport}
        onClose={() => {
          if (Platform.OS !== 'web') {
            haptics.lightImpact();
          }
          setShowSupport(false);
        }}
      />

      <LanguageModal
        isVisible={showLanguage}
        onClose={() => {
          if (Platform.OS !== 'web') {
            haptics.lightImpact();
          }
          setShowLanguage(false);
        }}
      />

      <TermsModal
        isVisible={showTerms}
        onClose={() => {
          if (Platform.OS !== 'web') {
            haptics.lightImpact();
          }
          setShowTerms(false);
        }}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: Platform.OS === 'ios' ? 24 : 20,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Platform.OS === 'ios' ? 24 : 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: Platform.OS === 'ios' ? 16 : 10,
    marginBottom: Platform.OS === 'ios' ? 24 : 16,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: Platform.OS === 'ios' ? 18 : 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: Platform.OS === 'ios' ? 14 : 12,
    color: colors.textSecondary,
    marginBottom: Platform.OS === 'ios' ? 6 : 4,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: Platform.OS === 'ios' ? 12 : 10,
    color: '#22C55E',
    fontWeight: '500',
  },
  twoFactorBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  twoFactorText: {
    fontSize: 12,
    color: '#1E3A8A',
    fontWeight: '500',
  },
  section: {
    marginBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  sectionTitle: {
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    paddingHorizontal: Platform.OS === 'ios' ? 4 : 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Platform.OS === 'ios' ? 16 : 14,
  },
  settingIcon: {
    width: Platform.OS === 'ios' ? 40 : 32,
    height: Platform.OS === 'ios' ? 40 : 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Platform.OS === 'ios' ? 16 : 10,
  },
  settingContent: {
    flex: 1,
    marginRight: 8,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  settingLabel: {
    fontSize: Platform.OS === 'ios' ? 16 : 14,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  settingDescription: {
    fontSize: Platform.OS === 'ios' ? 13 : 12,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: Platform.OS === 'ios' ? 16 : 10,
  },
  themeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    padding: Platform.OS === 'ios' ? 2 : 1,
  },
  themeOption: {
    paddingHorizontal: Platform.OS === 'ios' ? 12 : 10,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
    borderRadius: 6,
    minWidth: Platform.OS === 'ios' ? 50 : 40,
    alignItems: 'center',
  },
  activeThemeOption: {
    backgroundColor: colors.primary,
  },
  themeOptionText: {
    fontSize: Platform.OS === 'ios' ? 12 : 10,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeThemeOptionText: {
    color: '#FFFFFF',
  },
  accountActions: {
    marginTop: 8,
    gap: 16,
    alignItems: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    width: '100%',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 12,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  deleteAccountText: {
    fontSize: 14,
    color: colors.textTertiary,
    marginLeft: 8,
  },
  disabledSettingItem: {
    opacity: 0.5,
  },
  comingSoonTag: {
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
    alignSelf: 'center',
  },
  comingSoonText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});