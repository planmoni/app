import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ScrollView, 
  Alert,
  Clipboard,
  Share
} from 'react-native';
import { 
  ArrowLeft, 
  Key, 
  Eye,
  EyeOff,
  Copy,
  Download,
  Shield,
  AlertCircle
} from 'lucide-react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';
import { useOnlineStatus } from '@/components/OnlineStatusProvider';
import OfflineNotice from '@/components/OfflineNotice';
import PinVerificationModal from '@/components/PinVerificationModal';
import { 
  getRemainingBackupCodesCount,
  formatBackupCodes
} from '@/lib/totp';

export default function ViewBackupCodesScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { isOnline } = useOnlineStatus();
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showCodes, setShowCodes] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [codesCount, setCodesCount] = useState(0);

  useEffect(() => {
    if (session?.user?.id && isOnline) {
      loadBackupCodesCount();
    }
  }, [session?.user?.id, isOnline]);

  const loadBackupCodesCount = async () => {
    try {
      const count = await getRemainingBackupCodesCount(session!.user.id);
      setCodesCount(count);
    } catch (error) {
      console.error('Error loading backup codes count:', error);
    }
  };

  const handleViewCodes = () => {
    if (codesCount === 0) {
      Alert.alert(
        "No Backup Codes",
        "You don't have any remaining backup codes. Generate new ones to continue.",
        [
          {
            text: "OK",
            onPress: () => router.back()
          }
        ]
      );
      return;
    }
    
    setShowPinModal(true);
  };

  const handlePinVerified = async () => {
    setShowPinModal(false);
    await loadBackupCodes();
  };

  const loadBackupCodes = async () => {
    try {
      setIsLoading(true);
      // For now, we'll show a placeholder since we need to implement the actual backup codes retrieval
      // In a real implementation, you'd call an Edge Function to get the actual codes
      const mockCodes = [
        'A1B2C3D4', 'E5F6G7H8', 'I9J0K1L2', 'M3N4O5P6',
        'Q7R8S9T0', 'U1V2W3X4', 'Y5Z6A7B8', 'C9D0E1F2',
        'G3H4I5J6', 'K7L8M9N0'
      ];
      setBackupCodes(mockCodes);
    } catch (error) {
      console.error('Error loading backup codes:', error);
      Alert.alert('Error', 'Failed to load backup codes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCodes = async () => {
    try {
      const formattedCodes = formatBackupCodes(backupCodes);
      const text = formattedCodes.join('\n');
      await Clipboard.setString(text);
      Alert.alert('Copied', 'Backup codes copied to clipboard');
    } catch (error) {
      console.error('Error copying codes:', error);
      Alert.alert('Error', 'Failed to copy codes');
    }
  };

  const handleDownloadCodes = async () => {
    try {
      const formattedCodes = formatBackupCodes(backupCodes);
      const text = `Planmoni Backup Codes\n\nGenerated: ${new Date().toLocaleDateString()}\n\n${formattedCodes.join('\n')}\n\nKeep these codes safe. Each can only be used once.`;
      
      await Share.share({
        message: text,
        title: 'Planmoni Backup Codes'
      });
    } catch (error) {
      console.error('Error sharing codes:', error);
      Alert.alert('Error', 'Failed to share codes');
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Backup Codes</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {!isOnline && (
          <OfflineNotice message="Backup codes require an internet connection" />
        )}

        {/* Status Section */}
        <View style={styles.section}>
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusIcon}>
                <Key size={24} color="#1E3A8A" />
              </View>
              <View style={styles.statusContent}>
                <Text style={styles.statusTitle}>Backup Codes Status</Text>
                <Text style={styles.statusDescription}>
                  {codesCount} codes remaining
                </Text>
              </View>
            </View>
            
            {codesCount === 0 && (
              <View style={styles.warningContainer}>
                <AlertCircle size={16} color="#F59E0B" />
                <Text style={styles.warningText}>
                  You have no remaining backup codes. Generate new ones to maintain account access.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <View style={styles.actionCard}>
            <Pressable 
              style={styles.actionItem}
              onPress={handleViewCodes}
              disabled={!isOnline}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#F0F9FF' }]}>
                <Eye size={20} color="#0EA5E9" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionLabel}>View Backup Codes</Text>
                <Text style={styles.actionDescription}>
                  Enter your PIN to view your backup codes
                </Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable 
              style={styles.actionItem}
              onPress={() => router.push({
                pathname: '/two-factor-setup',
                params: { method: 'authenticator', action: 'regenerate-backup-codes' }
              })}
              disabled={!isOnline}
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
          </View>
        </View>

        {/* Codes Display Section */}
        {backupCodes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Backup Codes</Text>
            
            <View style={styles.codesCard}>
              <View style={styles.codesHeader}>
                <Text style={styles.codesTitle}>Emergency Access Codes</Text>
                <Pressable 
                  onPress={() => setShowCodes(!showCodes)}
                  style={styles.toggleButton}
                >
                  {showCodes ? (
                    <EyeOff size={20} color={colors.primary} />
                  ) : (
                    <Eye size={20} color={colors.primary} />
                  )}
                </Pressable>
              </View>

              {showCodes ? (
                <View style={styles.codesList}>
                  {backupCodes.map((code, index) => (
                    <View key={index} style={styles.codeItem}>
                      <Text style={styles.codeText}>{code}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.hiddenCodes}>
                  <Text style={styles.hiddenText}>
                    {backupCodes.length} codes hidden
                  </Text>
                </View>
              )}

              {showCodes && (
                <>
                  <View style={styles.divider} />
                  
                  <View style={styles.actionsRow}>
                    <Pressable 
                      style={styles.actionButton}
                      onPress={handleCopyCodes}
                    >
                      <Copy size={16} color={colors.primary} />
                      <Text style={styles.actionButtonText}>Copy</Text>
                    </Pressable>
                    
                    <Pressable 
                      style={styles.actionButton}
                      onPress={handleDownloadCodes}
                    >
                      <Download size={16} color={colors.primary} />
                      <Text style={styles.actionButtonText}>Download</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <Shield size={20} color="#1E3A8A" />
              </View>
              <Text style={styles.infoTitle}>About Backup Codes</Text>
            </View>
            <Text style={styles.infoDescription}>
              Backup codes are single-use recovery codes that allow you to access your account when you can't use your authenticator app. Each code can only be used once, so store them safely.
            </Text>
          </View>
        </View>
      </ScrollView>
      
      <SafeFooter />

      {/* PIN Verification Modal */}
      <PinVerificationModal
        isVisible={showPinModal}
        onSuccess={handlePinVerified}
        onClose={() => setShowPinModal(false)}
        title="Verify PIN to View Backup Codes"
        description="Enter your PIN to view your backup codes"
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
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  statusDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    marginLeft: 8,
    flex: 1,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
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
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  codesCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  codesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  toggleButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  codeItem: {
    backgroundColor: colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: '45%',
  },
  codeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  hiddenCodes: {
    backgroundColor: colors.backgroundSecondary,
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  hiddenText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
    marginLeft: 6,
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
