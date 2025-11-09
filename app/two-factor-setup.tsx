import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ScrollView, 
  TextInput, 
  Alert,
  Clipboard,
  Share
} from 'react-native';
import { 
  ArrowLeft, 
  QrCode, 
  Shield, 
  ShieldUser,
  Check, 
  Copy, 
  Download,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';
import { useOnlineStatus } from '@/components/OnlineStatusProvider';
import OfflineNotice from '@/components/OfflineNotice';
import { 
  generateTOTPSecret, 
  verifyTOTPToken, 
  generateBackupCodes,
  enableTOTPForUser,
  validateTOTPToken,
  formatBackupCodes,
  type TOTPSecret,
  type BackupCodes
} from '@/lib/totp';
import QRCode from 'react-native-qrcode-svg';

type SetupStep = 'loading' | 'qr-code' | 'verification' | 'backup-codes' | 'success';

export default function TwoFactorSetupScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { isOnline } = useOnlineStatus();
  const { method, action } = useLocalSearchParams<{ method: string; action?: string }>();
  
  const [currentStep, setCurrentStep] = useState<SetupStep>('loading');
  const [totpSecret, setTotpSecret] = useState<TOTPSecret | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<BackupCodes | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id && isOnline) {
      if (method === 'authenticator') {
        if (action === 'regenerate-backup-codes') {
          handleRegenerateBackupCodes();
        } else {
          initializeTOTPSetup();
        }
      } else if (method === 'email') {
        initializeEmail2FA();
      }
    }
  }, [method, action, session?.user?.id, isOnline]);

  const initializeTOTPSetup = async () => {
    try {
      setError(null);
      const secret = await generateTOTPSecret(session!.user.id);
      setTotpSecret(secret);
      setCurrentStep('qr-code');
    } catch (error) {
      console.error('Error initializing TOTP setup:', error);
      setError('Failed to initialize 2FA setup. Please try again.');
    }
  };

  const initializeEmail2FA = async () => {
    try {
      setError(null);
      // For email 2FA, we just enable it directly since it doesn't require setup
      const { supabase } = await import('@/lib/supabase');
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          two_factor_enabled: true,
          two_factor_method: 'email',
          totp_enabled: false,
          totp_secret: null,
          totp_setup_completed_at: new Date().toISOString()
        })
        .eq('id', session!.user.id);

      if (updateError) throw updateError;
      
      setCurrentStep('success');
    } catch (error) {
      console.error('Error setting up email 2FA:', error);
      setError('Failed to enable email 2FA. Please try again.');
    }
  };

  const handleRegenerateBackupCodes = async () => {
    try {
      setError(null);
      setIsGeneratingBackup(true);
      
      // Generate new backup codes
      const codes = await generateBackupCodes(session!.user.id);
      setBackupCodes(codes);
      setCurrentStep('backup-codes');
    } catch (error) {
      console.error('Error regenerating backup codes:', error);
      setError('Failed to regenerate backup codes. Please try again.');
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const handleVerification = async () => {
    if (!validateTOTPToken(verificationCode)) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const isValid = await verifyTOTPToken(session!.user.id, verificationCode);
      
      if (isValid) {
        // Enable TOTP for the user
        const enabled = await enableTOTPForUser(session!.user.id, verificationCode);
        
        if (enabled) {
          // Generate backup codes
          setIsGeneratingBackup(true);
          const codes = await generateBackupCodes(session!.user.id);
          setBackupCodes(codes);
          setCurrentStep('backup-codes');
        } else {
          setError('Failed to enable 2FA. Please try again.');
        }
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying TOTP:', error);
      setError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
      setIsGeneratingBackup(false);
    }
  };

  const handleCopySecret = async () => {
    if (totpSecret?.manualEntryKey) {
      await Clipboard.setString(totpSecret.manualEntryKey);
      Alert.alert('Copied', 'Secret key copied to clipboard');
    }
  };

  const handleDownloadBackupCodes = async () => {
    if (backupCodes?.codes) {
      const formattedCodes = formatBackupCodes(backupCodes.codes);
      const text = `Planmoni Backup Codes\n\nGenerated: ${backupCodes.generatedAt.toLocaleDateString()}\n\n${formattedCodes.join('\n')}\n\nKeep these codes safe. Each can only be used once.`;
      
      try {
        await Share.share({
          message: text,
          title: 'Planmoni Backup Codes'
        });
      } catch (error) {
        console.error('Error sharing backup codes:', error);
      }
    }
  };

  const handleComplete = () => {
    setCurrentStep('success');
    setTimeout(() => {
      router.replace('/profile');
    }, 2000);
  };

  const renderQRCodeStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.heroSection}>
        <View style={styles.shieldIcon}>
          <QrCode size={32} color="#22C55E" />
        </View>
        <Text style={styles.heroTitle}>Scan QR Code</Text>
        <Text style={styles.heroDescription}>
          Open your authenticator app and scan this QR code to add Planmoni
        </Text>
      </View>

      <View style={styles.qrCodeContainer}>
        {totpSecret?.qrCodeUrl && (
          <QRCode
            value={totpSecret.qrCodeUrl}
            size={200}
            backgroundColor={colors.surface}
            color={colors.text}
          />
        )}
      </View>

      <View style={styles.manualEntrySection}>
        <Text style={styles.manualEntryTitle}>Can't scan the QR code?</Text>
        <Text style={styles.manualEntryDescription}>
          Enter this code manually in your authenticator app:
        </Text>
        
        <View style={styles.secretKeyContainer}>
          <Text style={styles.secretKey}>{totpSecret?.manualEntryKey}</Text>
          <Pressable onPress={handleCopySecret} style={styles.copyButton}>
            <Copy size={20} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.instructionsSection}>
        <Text style={styles.instructionsTitle}>Popular Authenticator Apps:</Text>
        <Text style={styles.instructionsText}>• Google Authenticator</Text>
        <Text style={styles.instructionsText}>• Authy</Text>
        <Text style={styles.instructionsText}>• Microsoft Authenticator</Text>
        <Text style={styles.instructionsText}>• 1Password</Text>
      </View>
    </View>
  );

  const renderVerificationStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.heroSection}>
        <View style={styles.shieldIcon}>
          <ShieldUser size={32} color={colors.backgroundSecondary} />
        </View>
        <Text style={styles.heroTitle}>Verify Setup</Text>
        <Text style={styles.heroDescription}>
          Enter the 6-digit code from your authenticator app to complete setup
        </Text>
      </View>

      <View style={styles.verificationContainer}>
        <TextInput
          style={[styles.verificationInput, { 
            borderColor: colors.border,
            color: colors.text,
            backgroundColor: colors.surface,
            fontSize: 24,
            
          letterSpacing:4
          }]}
          value={verificationCode}
          onChangeText={setVerificationCode}
          placeholder="000000"
          placeholderTextColor={colors.textSecondary}
          keyboardType="numeric"
          maxLength={6}
          textAlign="center"
        />
        
        {error && (
          <View style={styles.errorContainer}>
            <AlertCircle size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      <View style={styles.helpSection}>
        <Text style={styles.helpText}>
          The code refreshes every 30 seconds. If you don't see a code, make sure your device's time is synchronized.
        </Text>
      </View>
    </View>
  );

  const renderBackupCodesStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.heroSection}>
        <View style={styles.shieldIcon}>
          <Shield size={32} color="#22C55E" />
        </View>
        <Text style={styles.heroTitle}>Save Backup Codes</Text>
        <Text style={styles.heroDescription}>
          These codes can be used to access your account if you lose your authenticator app
        </Text>
      </View>

      <View style={styles.backupCodesContainer}>
        <View style={styles.backupCodesHeader}>
          <Text style={styles.backupCodesTitle}>Your Backup Codes</Text>
          <Pressable 
            onPress={() => setShowBackupCodes(!showBackupCodes)}
            style={styles.toggleButton}
          >
            {showBackupCodes ? (
              <EyeOff size={20} color={colors.primary} />
            ) : (
              <Eye size={20} color={colors.primary} />
            )}
          </Pressable>
        </View>

        {showBackupCodes ? (
          <View style={styles.backupCodesList}>
            {backupCodes?.codes.map((code, index) => (
              <Text key={index} style={styles.backupCode}>
                {formatBackupCodes([code])[0]}
              </Text>
            ))}
          </View>
        ) : (
          <View style={styles.hiddenCodes}>
            <Text style={styles.hiddenCodesText}>•••••••• ••••••••</Text>
            <Text style={styles.hiddenCodesText}>•••••••• ••••••••</Text>
            <Text style={styles.hiddenCodesText}>•••••••• ••••••••</Text>
            <Text style={styles.hiddenCodesText}>•••••••• ••••••••</Text>
            <Text style={styles.hiddenCodesText}>•••••••• ••••••••</Text>
          </View>
        )}

        <View style={styles.backupCodesActions}>
          <Pressable onPress={handleDownloadBackupCodes} style={styles.downloadButton}>
            <Download size={20} color={colors.primary} />
            <Text style={[styles.downloadButtonText, { color: colors.primary }]}>
              Download
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.warningSection}>
        <AlertCircle size={20} color="#F59E0B" />
        <Text style={styles.warningText}>
          Store these codes in a safe place. Each code can only be used once.
        </Text>
      </View>
    </View>
  );

  const renderSuccessStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.heroSection}>
        <View style={[styles.shieldIcon, { backgroundColor: '#DCFCE7' }]}>
          <Check size={32} color="#22C55E" />
        </View>
        <Text style={styles.heroTitle}>2FA Enabled Successfully!</Text>
        <Text style={styles.heroDescription}>
          Your account is now protected with {method === 'email' ? 'email' : 'authenticator app'} two-factor authentication
        </Text>
      </View>

      <View style={styles.successInfo}>
        <Text style={styles.successInfoText}>
          {method === 'email' 
            ? 'You\'ll receive a verification code via email each time you sign in from a new device.'
            : 'You\'ll be asked for a verification code from your authenticator app each time you sign in from a new device.'
          }
        </Text>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'loading':
        return (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>
              {method === 'email' ? 'Enabling email 2FA...' : 'Setting up 2FA...'}
            </Text>
          </View>
        );
      case 'qr-code':
        return renderQRCodeStep();
      case 'verification':
        return renderVerificationStep();
      case 'backup-codes':
        return renderBackupCodesStep();
      case 'success':
        return renderSuccessStep();
      default:
        return null;
    }
  };

  const getNextButtonTitle = () => {
    switch (currentStep) {
      case 'qr-code':
        return 'I have Added the Account';
      case 'verification':
        return isVerifying ? 'Verifying...' : 'Verify & Enable 2FA';
      case 'backup-codes':
        return 'Continue';
      case 'success':
        return 'Done';
      default:
        return 'Continue';
    }
  };

  const handleNext = () => {
    switch (currentStep) {
      case 'qr-code':
        setCurrentStep('verification');
        break;
      case 'verification':
        handleVerification();
        break;
      case 'backup-codes':
        handleComplete();
        break;
      case 'success':
        router.replace('/profile');
        break;
    }
  };

  const isNextDisabled = () => {
    switch (currentStep) {
      case 'verification':
        return verificationCode.length !== 6 || isVerifying;
      case 'backup-codes':
        return isGeneratingBackup;
      default:
        return false;
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Setup 2FA</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {!isOnline && (
          <OfflineNotice message="2FA setup requires an internet connection" />
        )}

        {renderCurrentStep()}
      </ScrollView>

      {currentStep !== 'loading' && currentStep !== 'success' && (
        <View style={styles.footer}>
          <Button
            title={getNextButtonTitle()}
            onPress={handleNext}
            style={styles.nextButton}
            disabled={isNextDisabled() || !isOnline}
          />
        </View>
      )}
      
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
  stepContainer: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  shieldIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  heroDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '90%',
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
  qrCodeContainer: {
    alignItems: 'center',
    marginBottom: 32,
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualEntrySection: {
    marginBottom: 32,
  },
  manualEntryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  manualEntryDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  secretKeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secretKey: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'monospace',
    color: colors.text,
    letterSpacing: 2,
  },
  copyButton: {
    padding: 8,
  },
  instructionsSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  verificationContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  verificationInput: {
    width: 200,
    height: 60,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    marginLeft: 8,
    color: '#EF4444',
    fontSize: 14,
  },
  helpSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  backupCodesContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backupCodesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backupCodesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  toggleButton: {
    padding: 8,
  },
  backupCodesList: {
    marginBottom: 16,
  },
  backupCode: {
    fontSize: 16,
    fontFamily: 'monospace',
    color: colors.text,
    marginBottom: 8,
    padding: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
  },
  hiddenCodes: {
    marginBottom: 16,
  },
  hiddenCodesText: {
    fontSize: 16,
    fontFamily: 'monospace',
    color: colors.textSecondary,
    marginBottom: 8,
    padding: 8,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
  },
  backupCodesActions: {
    alignItems: 'center',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  downloadButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  warningSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  warningText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  successInfo: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  successInfoText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  nextButton: {
    backgroundColor: '#1E3A8A',
  },
});
