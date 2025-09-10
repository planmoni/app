import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ScrollView, 
  Alert,
  Switch
} from 'react-native';
import { 
  ArrowLeft, 
  Shield, 
  QrCode, 
  Key,
  Trash2,
  AlertCircle,
  Check
} from 'lucide-react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';
import { useOnlineStatus } from '@/components/OnlineStatusProvider';
import OfflineNotice from '@/components/OfflineNotice';
import { 
  disableTOTPForUser,
  get2FAStatus,
  getRemainingBackupCodesCount,
  hasBackupCodes
} from '@/lib/totp';
import { supabase } from '@/lib/supabase';

export default function TwoFactorSettingsScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { isOnline } = useOnlineStatus();
  
  const [twoFactorStatus, setTwoFactorStatus] = useState<any>(null);
  const [backupCodesCount, setBackupCodesCount] = useState(0);
  const [hasBackupCodesAvailable, setHasBackupCodesAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisabling, setIsDisabling] = useState(false);

  useEffect(() => {
    if (session?.user?.id && isOnline) {
      load2FAStatus();
    }
  }, [session?.user?.id, isOnline]);

  const load2FAStatus = async () => {
    try {
      setIsLoading(true);
      
      // Get 2FA status
      const status = await get2FAStatus(session!.user.id);
      setTwoFactorStatus(status);
      
      // Get backup codes count
      const count = await getRemainingBackupCodesCount(session!.user.id);
      setBackupCodesCount(count);
      
      // Check if backup codes exist
      const hasCodes = await hasBackupCodes(session!.user.id);
      setHasBackupCodesAvailable(hasCodes);
      
    } catch (error) {
      console.error('Error loading 2FA status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable2FA = () => {
    Alert.alert(
      "Disable Two-Factor Authentication",
      "Are you sure you want to disable 2FA? This will make your account less secure.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Disable",
          style: "destructive",
          onPress: confirmDisable2FA
        }
      ]
    );
  };

  const confirmDisable2FA = async () => {
    try {
      setIsDisabling(true);
      
      const success = await disableTOTPForUser(session!.user.id);
      
      if (success) {
        Alert.alert(
          "2FA Disabled",
          "Two-factor authentication has been disabled for your account.",
          [
            {
              text: "OK",
              onPress: () => router.back()
            }
          ]
        );
      } else {
        Alert.alert("Error", "Failed to disable 2FA. Please try again.");
      }
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      Alert.alert("Error", "Failed to disable 2FA. Please try again.");
    } finally {
      setIsDisabling(false);
    }
  };

  const handleRegenerateBackupCodes = () => {
    Alert.alert(
      "Regenerate Backup Codes",
      "This will invalidate your current backup codes and generate new ones. Make sure you have access to your authenticator app.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Regenerate",
          style: "destructive",
          onPress: () => {
            // Navigate to backup codes generation
            router.push({
              pathname: '/two-factor-setup',
              params: { method: 'authenticator', action: 'regenerate-backup-codes' }
            });
          }
        }
      ]
    );
  };

  const handleViewBackupCodes = () => {
    router.push('/view-backup-codes');
  };

  const styles = createStyles(colors);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>2FA Settings</Text>
        </View>
        
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading 2FA settings...</Text>
        </View>
        
        <SafeFooter />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>2FA Settings</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {!isOnline && (
          <OfflineNotice message="2FA settings require an internet connection" />
        )}

        {/* Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          
          <View style={styles.card}>
            <View style={styles.statusItem}>
              <View style={[styles.statusIcon, { backgroundColor: '#F0FDF4' }]}>
                <Shield size={20} color="#22C55E" />
              </View>
              <View style={styles.statusContent}>
                <Text style={styles.statusLabel}>Two-Factor Authentication</Text>
                <Text style={styles.statusDescription}>
                  {twoFactorStatus?.two_factor_enabled ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: twoFactorStatus?.two_factor_enabled ? '#DCFCE7' : '#FEE2E2' }
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  { color: twoFactorStatus?.two_factor_enabled ? '#22C55E' : '#EF4444' }
                ]}>
                  {twoFactorStatus?.two_factor_enabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </View>

            {twoFactorStatus?.two_factor_enabled && (
              <>
                <View style={styles.divider} />
                
                <View style={styles.statusItem}>
                  <View style={[styles.statusIcon, { backgroundColor: '#EFF6FF' }]}>
                    <QrCode size={20} color="#1E3A8A" />
                  </View>
                  <View style={styles.statusContent}>
                    <Text style={styles.statusLabel}>Authentication Method</Text>
                    <Text style={styles.statusDescription}>
                      {twoFactorStatus?.two_factor_method === 'authenticator' 
                        ? 'Authenticator App' 
                        : 'Email'
                      }
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.statusItem}>
                  <View style={[styles.statusIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Key size={20} color="#D97706" />
                  </View>
                  <View style={styles.statusContent}>
                    <Text style={styles.statusLabel}>Backup Codes</Text>
                    <Text style={styles.statusDescription}>
                      {backupCodesCount} codes remaining
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Management Section */}
        {twoFactorStatus?.two_factor_enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Management</Text>
            
            <View style={styles.card}>
              {hasBackupCodesAvailable && (
                <>
                  <Pressable 
                    style={styles.actionItem}
                    onPress={handleViewBackupCodes}
                  >
                    <View style={[styles.actionIcon, { backgroundColor: '#F0F9FF' }]}>
                      <Key size={20} color="#0EA5E9" />
                    </View>
                    <View style={styles.actionContent}>
                      <Text style={styles.actionLabel}>View Backup Codes</Text>
                      <Text style={styles.actionDescription}>
                        View and download your backup codes
                      </Text>
                    </View>
                  </Pressable>

                  <View style={styles.divider} />
                </>
              )}

              <Pressable 
                style={styles.actionItem}
                onPress={handleRegenerateBackupCodes}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Key size={20} color="#D97706" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionLabel}>Regenerate Backup Codes</Text>
                  <Text style={styles.actionDescription}>
                    Generate new backup codes (invalidates current ones)
                  </Text>
                </View>
              </Pressable>

              <View style={styles.divider} />

              <Pressable 
                style={styles.actionItem}
                onPress={handleDisable2FA}
                disabled={isDisabling}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Trash2 size={20} color="#EF4444" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={[styles.actionLabel, { color: '#EF4444' }]}>
                    Disable 2FA
                  </Text>
                  <Text style={styles.actionDescription}>
                    Remove two-factor authentication from your account
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        {/* Setup Section */}
        {!twoFactorStatus?.two_factor_enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Setup</Text>
            
            <View style={styles.card}>
              <View style={styles.setupItem}>
                <View style={[styles.setupIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Shield size={20} color="#22C55E" />
                </View>
                <View style={styles.setupContent}>
                  <Text style={styles.setupLabel}>Enable Two-Factor Authentication</Text>
                  <Text style={styles.setupDescription}>
                    Add an extra layer of security to your account
                  </Text>
                </View>
                <Button
                  title="Setup"
                  onPress={() => router.push('/two-factor-auth')}
                  style={styles.setupButton}
                />
              </View>
            </View>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <AlertCircle size={20} color="#1E3A8A" />
              </View>
              <Text style={styles.infoTitle}>About Two-Factor Authentication</Text>
            </View>
            <Text style={styles.infoDescription}>
              Two-factor authentication adds an extra security layer to your account. 
              Even if someone knows your password, they won't be able to access your account 
              without the second factor (authenticator app or email code).
            </Text>
          </View>
        </View>
      </ScrollView>
      
      <SafeFooter />
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
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
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
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusContent: {
    flex: 1,
    marginRight: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  statusDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
    marginRight: 8,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  setupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  setupIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  setupContent: {
    flex: 1,
    marginRight: 12,
  },
  setupLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  setupDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  setupButton: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#1E3A8A',
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
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  infoDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
