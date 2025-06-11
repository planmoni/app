import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { ArrowLeft, Shield, Smartphone, Mail, QrCode, Lock } from 'lucide-react-native';
import { router } from 'expo-router';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

type AuthMethod = 'authenticator' | 'sms' | 'email';

export default function TwoFactorAuthScreen() {
  const { colors } = useTheme();
  const [selectedMethod, setSelectedMethod] = useState<AuthMethod | null>(null);

  const handleMethodSelect = (method: AuthMethod) => {
    setSelectedMethod(method);
    // Navigate to setup flow for selected method
    router.push({
      pathname: '/two-factor-setup',
      params: { method }
    });
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Two-Factor Authentication</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.heroSection}>
          <View style={styles.shieldIcon}>
            <Shield size={32} color="#22C55E" />
          </View>
          <Text style={styles.heroTitle}>Secure Your Account</Text>
          <Text style={styles.heroDescription}>
            Add an extra layer of security to your account by enabling two-factor authentication
          </Text>
        </View>

        <View style={styles.methodsSection}>
          <Text style={styles.sectionTitle}>Choose Authentication Method</Text>
          
          <Pressable
            style={[
              styles.methodCard,
              selectedMethod === 'authenticator' && styles.selectedMethod
            ]}
            onPress={() => handleMethodSelect('authenticator')}
          >
            <View style={[styles.methodIcon, { backgroundColor: '#F0FDF4' }]}>
              <QrCode size={24} color="#22C55E" />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodTitle}>Authenticator App</Text>
              <Text style={styles.methodDescription}>
                Use an authenticator app like Google Authenticator or Authy
              </Text>
            </View>
            <View style={styles.recommendedTag}>
              <Text style={styles.recommendedText}>Recommended</Text>
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.methodCard,
              selectedMethod === 'sms' && styles.selectedMethod
            ]}
            onPress={() => handleMethodSelect('sms')}
          >
            <View style={[styles.methodIcon, { backgroundColor: '#EFF6FF' }]}>
              <Smartphone size={24} color="#3B82F6" />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodTitle}>SMS Authentication</Text>
              <Text style={styles.methodDescription}>
                Receive verification codes via text message
              </Text>
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.methodCard,
              selectedMethod === 'email' && styles.selectedMethod
            ]}
            onPress={() => handleMethodSelect('email')}
          >
            <View style={[styles.methodIcon, { backgroundColor: '#F0F9FF' }]}>
              <Mail size={24} color="#0EA5E9" />
            </View>
            <View style={styles.methodInfo}>
              <Text style={styles.methodTitle}>Email Authentication</Text>
              <Text style={styles.methodDescription}>
                Receive verification codes via email
              </Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <Lock size={20} color="#3B82F6" />
              </View>
              <Text style={styles.infoTitle}>Why use 2FA?</Text>
            </View>
            <Text style={styles.infoDescription}>
              Two-factor authentication adds an extra security layer to your account. Even if someone knows your password, they won't be able to access your account without the second factor.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Continue Setup"
          onPress={() => handleMethodSelect(selectedMethod || 'authenticator')}
          style={styles.continueButton}
          disabled={!selectedMethod}
        />
      </View>
      
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
    maxWidth: '80%',
  },
  methodsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  selectedMethod: {
    borderColor: colors.primary,
    backgroundColor: colors.backgroundTertiary,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  methodDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  recommendedTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 12,
  },
  recommendedText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#22C55E',
  },
  infoSection: {
    marginBottom: 32,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
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
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  continueButton: {
    backgroundColor: '#1E3A8A',
  },
});