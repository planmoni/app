import Button from '@/components/Button';
import { router } from 'expo-router';
import { ArrowLeft, Copy, CreditCard, Bank } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, ToastAndroid } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import { useHaptics } from '@/hooks/useHaptics';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';

export default function AddFundsScreen() {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  const [activeTab, setActiveTab] = useState<'bankTransfer' | 'otherMethods'>('bankTransfer');
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;

  const handleCopyAccountNumber = () => {
    haptics.selection();
    // Implement copy functionality
    Clipboard.setStringAsync("muhammed@gmail.com");
    ToastAndroid.show('Account number copied to clipboard', ToastAndroid.SHORT);
  };

  const handleMoreDepositMethods = () => {
    haptics.mediumImpact();
    router.push('/deposit-flow/payment-methods');
  };

  const handleBack = () => {
    haptics.lightImpact();
    router.back();
  };

  const handleDone = () => {
    haptics.mediumImpact();
    router.back();
  };

  const handleTabChange = (tab: 'bankTransfer' | 'otherMethods') => {
    haptics.selection();
    setActiveTab(tab);
  };

  const styles = createStyles(colors, isSmallScreen);

  // Calculate footer height including safe area
  const footerHeight = 80 + insets.bottom;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Funds</Text>
      </View>

      <View style={styles.tabContainer}>
        <Pressable 
          style={[
            styles.tab, 
            activeTab === 'bankTransfer' && styles.activeTab
          ]}
          onPress={() => handleTabChange('bankTransfer')}
        >
          <Bank 
            size={isSmallScreen ? 18 : 20} 
            color={activeTab === 'bankTransfer' ? colors.primary : colors.textSecondary} 
          />
          <Text 
            style={[
              styles.tabText, 
              activeTab === 'bankTransfer' && styles.activeTabText
            ]}
          >
            Bank Transfer
          </Text>
        </Pressable>
        
        <Pressable 
          style={[
            styles.tab, 
            activeTab === 'otherMethods' && styles.activeTab
          ]}
          onPress={() => handleTabChange('otherMethods')}
        >
          <CreditCard 
            size={isSmallScreen ? 18 : 20} 
            color={activeTab === 'otherMethods' ? colors.primary : colors.textSecondary} 
          />
          <Text 
            style={[
              styles.tabText, 
              activeTab === 'otherMethods' && styles.activeTabText
            ]}
          >
            Cards/Bank/USSD
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingWrapper 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: footerHeight } // Add padding to account for fixed footer
        ]}
      >
        {activeTab === 'bankTransfer' ? (
          <View style={styles.content}>
            <Text style={styles.title}>Add funds via <Text style={styles.highlight}>Bank Transfer</Text></Text>
            <Text style={styles.description}>
              Money Transfers sent to this bank account number will automatically top up your Planmoni available wallet.
            </Text>

            <View style={styles.accountDetailsCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>9PBS Account Details</Text>
                <Text style={styles.cardDescription}>Use these details to receive funds directly</Text>
              </View>

              <View style={styles.fieldsContainer}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Account Number</Text>
                  <View style={styles.accountNumberContainer}>
                    <Text style={styles.accountNumber}>9002893892</Text>
                    <Pressable onPress={handleCopyAccountNumber} style={styles.copyButton}>
                      <Copy size={20} color={colors.primary} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Bank Name</Text>
                  <View style={styles.fieldValueContainer}>
                    <Text style={styles.fieldValue}>9Payment Service Bank (9PSB)</Text>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Account Name</Text>
                  <View style={styles.fieldValueContainer}>
                    <Text style={styles.fieldValue}>John Doe Planmoni</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.content}>
            <Text style={styles.title}>Choose a <Text style={styles.highlight}>Payment Method</Text></Text>
            <Text style={styles.description}>
              Select your preferred method to add funds to your Planmoni wallet.
            </Text>
            
            <View style={styles.paymentMethodsContainer}>
              <Pressable 
                style={styles.paymentMethodCard}
                onPress={handleMoreDepositMethods}
              >
                <View style={styles.paymentMethodIcon}>
                  <CreditCard size={24} color={colors.primary} />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Debit/Credit Card</Text>
                  <Text style={styles.paymentMethodDescription}>Add funds instantly using your card</Text>
                </View>
                <View style={styles.arrowContainer}>
                  <ArrowRight size={20} color={colors.textSecondary} />
                </View>
              </Pressable>
              
              <Pressable 
                style={styles.paymentMethodCard}
                onPress={handleMoreDepositMethods}
              >
                <View style={styles.paymentMethodIcon}>
                  <Bank size={24} color={colors.primary} />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Bank Account</Text>
                  <Text style={styles.paymentMethodDescription}>Link your bank account for transfers</Text>
                </View>
                <View style={styles.arrowContainer}>
                  <ArrowRight size={20} color={colors.textSecondary} />
                </View>
              </Pressable>
              
              <Pressable 
                style={styles.paymentMethodCard}
                onPress={handleMoreDepositMethods}
              >
                <View style={styles.paymentMethodIcon}>
                  <Smartphone size={24} color={colors.primary} />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>USSD</Text>
                  <Text style={styles.paymentMethodDescription}>Use USSD code to add funds</Text>
                </View>
                <View style={styles.arrowContainer}>
                  <ArrowRight size={20} color={colors.textSecondary} />
                </View>
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingWrapper>

      {/* Fixed footer with safe area padding */}
      <View style={[
        styles.footer, 
        { paddingBottom: Math.max(16, insets.bottom) }
      ]}>
        <Button 
          title="Done"
          onPress={handleDone}
          style={styles.doneButton}
          hapticType="medium"
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isSmallScreen: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isSmallScreen ? 12 : 16,
    paddingVertical: isSmallScreen ? 12 : 16,
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
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
    backgroundColor: colors.backgroundTertiary,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: isSmallScreen ? 13 : 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  scrollContent: {
    padding: isSmallScreen ? 16 : 20,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: isSmallScreen ? 20 : 24,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  highlight: {
    color: colors.primary,
  },
  description: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
    marginBottom: isSmallScreen ? 20 : 24,
    lineHeight: 20,
  },
  accountDetailsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: isSmallScreen ? 20 : 24,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: isSmallScreen ? 16 : 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.backgroundTertiary,
  },
  cardTitle: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: isSmallScreen ? 13 : 14,
    color: colors.textSecondary,
  },
  fieldsContainer: {
    padding: isSmallScreen ? 16 : 20,
    gap: isSmallScreen ? 16 : 20,
  },
  field: {
    marginBottom: 0, // Using gap in fieldsContainer instead
  },
  fieldLabel: {
    fontSize: isSmallScreen ? 13 : 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  accountNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 12,
  },
  accountNumber: {
    fontSize: isSmallScreen ? 16 : 18,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 1,
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldValueContainer: {
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    padding: isSmallScreen ? 12 : 16,
    borderRadius: 12,
  },
  fieldValue: {
    fontSize: isSmallScreen ? 14 : 16,
    fontWeight: '500',
    color: colors.text,
  },
  paymentMethodsContainer: {
    gap: 12,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    gap: 16,
    alignItems: 'center',
  },
  doneButton: {
    width: '100%',
    backgroundColor: colors.primary,
  },
});