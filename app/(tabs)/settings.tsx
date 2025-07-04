import Button from '@/components/Button';
import InitialsAvatar from '@/components/InitialsAvatar';
import SafeFooter from '@/components/SafeFooter';
import { useAuth } from '@/contexts/AuthContext';
import { useBalance } from '@/contexts/BalanceContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
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
  Trash2,
  Wallet
} from 'lucide-react-native';
import { useState, useEffect, useRef } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AccountStatementModal from '@/components/AccountStatementModal';
import HelpCenterModal from '@/components/HelpCenterModal';
import LanguageModal from '@/components/LanguageModal';
import NotificationSettingsModal from '@/components/NotificationSettingsModal';
import SecurityModal from '@/components/SecurityModal';
import SupportModal from '@/components/SupportModal';
import TermsModal from '@/components/TermsModal';
import BiometricSetupModal from '@/components/settings/BiometricSetupModal';
import { logAnalyticsEvent } from '@/lib/firebase';
import { Platform } from 'react-native';

export default function SettingsScreen() {
  const { colors, isDark, theme, setTheme } = useTheme();
  const { session, signOut } = useAuth();
  const { showBalances, toggleBalances } = useBalance();
  const haptics = useHaptics();
  
  const firstName = session?.user?.user_metadata?.first_name || '';
  const lastName = session?.user?.user_metadata?.last_name || '';
  const email = session?.user?.email || '';

  const [biometrics, setBiometrics] = useState(false);
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
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  // Log screen view for analytics
  useEffect(() => {
    logAnalyticsEvent('screen_view', {
      screen_name: 'Settings',
      screen_class: 'SettingsScreen',
    });
  }, []);

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
              router.replace('/');
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
    logAnalyticsEvent('two_factor_auth');
  };

  const handleTransactionLimits = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.push('/transaction-limits');
    logAnalyticsEvent('transaction_limits');
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    setTheme(newTheme);
    logAnalyticsEvent('change_theme', { theme: newTheme });
  };

  const handleToggleSwitch = (setter: React.Dispatch<React.SetStateAction<boolean>>, settingName: string) => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    setter(prev => {
      const newValue = !prev;
      logAnalyticsEvent('toggle_setting', { setting: settingName, value: newValue });
      return newValue;
    });
  };

  const handleDeleteAccount = () => {
    if (Platform.OS !== 'web') {
      haptics.notification(Haptics.NotificationFeedbackType.Error);
    }
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
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
          text: "Delete",
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
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>
          </View>
          <ChevronRight size={20} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <View style={[styles.settingIcon, { backgroundColor: '#EFF6FF' }]}>
                <Eye size={20} color="#1E3A8A" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Show Dashboard Balances</Text>
                <Text style={styles.settingDescription}>Hide or display wallet and vault balances</Text>
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
                trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
                thumbColor={showBalances ? '#1E3A8A' : colors.backgroundTertiary}
              />
            </View>

            <View style={styles.divider} />

            <Pressable 
              style={styles.settingItem}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                setShowBiometricModal(true);
                logAnalyticsEvent('open_biometric_settings');
              }}
            >
              <View style={[styles.settingIcon, { backgroundColor: '#F0FDF4' }]}>
                <Fingerprint size={20} color="#22C55E" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Enable Biometrics</Text>
                <Text style={styles.settingDescription}>Use biometrics for authentication</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

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
          <Text style={styles.sectionTitle}>Account Management</Text>
          
          <View style={styles.card}>
            <Pressable 
              style={styles.settingItem}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.lightImpact();
                }
                setShowAccountStatement(true);
                logAnalyticsEvent('view_account_statement');
              }}
            >
              <View style={[styles.settingIcon, { backgroundColor: '#F0F9FF' }]}>
                <Terms size={20} color="#0EA5E9" />
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
              onPress={handleViewLinkedAccounts}
            >
              <View style={[styles.settingIcon, { backgroundColor: '#F0F9FF' }]}>
                <Building2 size={20} color="#0EA5E9" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Linked Bank Accounts</Text>
                <Text style={styles.settingDescription}>Manage accounts for deposits</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>
            
            <View style={styles.divider} />

            <Pressable 
              style={styles.settingItem}
              onPress={handleViewPayoutAccounts}
            >
              <View style={[styles.settingIcon, { backgroundColor: '#F0FDF4' }]}>
                <Wallet size={20} color="#22C55E" />
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
              <View style={[styles.settingIcon, { backgroundColor: '#FEF3C7' }]}>
                <DollarSign size={20} color="#D97706" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Transaction Limits</Text>
                <Text style={styles.settingDescription}>See your transaction limits</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <View style={styles.card}>
            <Pressable 
              style={styles.settingItem}
              onPress={handleChangePassword}
            >
              <View style={[styles.settingIcon, { backgroundColor: '#FEE2E2' }]}>
                <Lock size={20} color="#EF4444" />
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
              <View style={[styles.settingIcon, { backgroundColor: '#F0FDF4' }]}>
                <Shield size={20} color="#22C55E" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Two-Factor Authentication</Text>
                <Text style={styles.settingDescription}>Add an extra layer of security</Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.card}>
            <View style={styles.settingItem}>
              <View style={[styles.settingIcon, { backgroundColor: '#FEF9C3' }]}>
                <Bell size={20} color="#CA8A04" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Vault Payout Alerts</Text>
                <Text style={styles.settingDescription}>Get notified about payouts</Text>
              </View>
              <Switch
                value={vaultAlerts}
                onValueChange={() => handleToggleSwitch(setVaultAlerts, 'vault_alerts')}
                trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
                thumbColor={vaultAlerts ? '#1E3A8A' : colors.backgroundTertiary}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={[styles.settingIcon, { backgroundColor: '#EFF6FF' }]}>
                <Shield size={20} color="#1E3A8A" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>New Login Notifications</Text>
                <Text style={styles.settingDescription}>Security alerts for new logins</Text>
              </View>
              <Switch
                value={loginAlerts}
                onValueChange={() => handleToggleSwitch(setLoginAlerts, 'login_alerts')}
                trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
                thumbColor={loginAlerts ? '#1E3A8A' : colors.backgroundTertiary}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={[styles.settingIcon, { backgroundColor: '#F5F3FF' }]}>
                <Clock size={20} color="#8B5CF6" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Plan Expiry Reminders</Text>
                <Text style={styles.settingDescription}>Get notified before plans expire</Text>
              </View>
              <Switch
                value={expiryReminders}
                onValueChange={() => handleToggleSwitch(setExpiryReminders, 'expiry_reminders')}
                trackColor={{ false: colors.borderSecondary, true: '#93C5FD' }}
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
              <View style={[styles.settingIcon, { backgroundColor: '#FFF7ED' }]}>
                <MessageSquare size={20} color="#F97316" />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Help & Support</Text>
                <Text style={styles.settingDescription}>FAQ, chat with support, submit a ticket, knowledge base, </Text>
              </View>
              <ChevronRight size={20} color={colors.textTertiary} />
            </Pressable>

            <View style={styles.divider} />

            <Pressable 
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

            <View style={styles.divider} />

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
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          </Pressable>
        </View>
      </ScrollView>

      <AccountStatementModal
        isVisible={showAccountStatement}
        onClose={() => {
          if (Platform.OS !== 'web') {
            haptics.lightImpact();
          }
          setShowAccountStatement(false);
        }}
      />

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
      
      <BiometricSetupModal
        isVisible={showBiometricModal}
        onClose={() => {
          if (Platform.OS !== 'web') {
            haptics.lightImpact();
          }
          setShowBiometricModal(false);
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
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
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
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
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
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
    marginRight: 8,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
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
    borderRadius: 12,
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
});