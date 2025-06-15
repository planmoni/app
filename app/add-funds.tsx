import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Animated, Dimensions, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Copy, Info, ChevronRight, CreditCard, Smartphone, Building2 } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Clipboard from 'expo-clipboard';
import Button from '@/components/Button';

const { width } = Dimensions.get('window');

export default function AddFundsScreen() {
  const { colors, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const haptics = useHaptics();
  
  const [activeTab, setActiveTab] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Determine if we're on a small screen
  const isSmallScreen = screenWidth < 380;

  const handleCopyAccountNumber = async () => {
    haptics.selection();
    try {
      await Clipboard.setStringAsync("9002893892");
      showToast('Account number copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy to clipboard', 'error');
    }
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

  const handleTabPress = (index: number) => {
    haptics.selection();
    setActiveTab(index);
    scrollViewRef.current?.scrollTo({ x: index * screenWidth, animated: true });
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const handleScrollEnd = (event: any) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    if (newIndex !== activeTab) {
      setActiveTab(newIndex);
    }
  };

  const styles = createStyles(colors, isDark, isSmallScreen);

  // Calculate footer height including safe area
  const footerHeight = 80 + insets.bottom;

  // Calculate tab indicator position and width
  const tabWidth = screenWidth / 2;
  const indicatorTranslateX = Animated.multiply(
    Animated.divide(scrollX, screenWidth),
    tabWidth
  );

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
          style={[styles.tab, activeTab === 0 && styles.activeTab]} 
          onPress={() => handleTabPress(0)}
        >
          <Text style={[styles.tabText, activeTab === 0 && styles.activeTabText]}>
            Bank Transfer
          </Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, activeTab === 1 && styles.activeTab]} 
          onPress={() => handleTabPress(1)}
        >
          <Text style={[styles.tabText, activeTab === 1 && styles.activeTabText]}>
            Cards/Bank/USSD
          </Text>
        </Pressable>
        <Animated.View 
          style={[
            styles.tabIndicator, 
            { 
              transform: [{ translateX: indicatorTranslateX }] 
            }
          ]} 
        />
      </View>

      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: footerHeight }
        ]}
      >
        {/* Bank Transfer Tab */}
        <View style={[styles.tabContent, { width: screenWidth }]}>
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
        </View>

        {/* Cards/Bank/USSD Tab */}
        <View style={[styles.tabContent, { width: screenWidth }]}>
          <View style={styles.content}>
            <Text style={styles.title}>Choose a <Text style={styles.highlight}>Payment Method</Text></Text>
            <Text style={styles.description}>
              Select your preferred payment option to add funds to your wallet.
            </Text>

            <View style={styles.paymentMethodsContainer}>
              <Pressable 
                style={styles.paymentMethod}
                onPress={() => router.push('/add-card')}
              >
                <View style={styles.paymentMethodIcon}>
                  <CreditCard size={24} color={colors.primary} />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Debit/Credit Card</Text>
                  <Text style={styles.paymentMethodDescription}>Add funds using your card</Text>
                </View>
                <ChevronRight size={20} color={colors.textSecondary} />
              </Pressable>

              <Pressable 
                style={styles.paymentMethod}
                onPress={() => router.push('/add-ussd')}
              >
                <View style={styles.paymentMethodIcon}>
                  <Smartphone size={24} color={colors.primary} />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>USSD Transfer</Text>
                  <Text style={styles.paymentMethodDescription}>Add funds using USSD code</Text>
                </View>
                <ChevronRight size={20} color={colors.textSecondary} />
              </Pressable>

              <Pressable 
                style={styles.paymentMethod}
                onPress={() => router.push('/linked-accounts')}
              >
                <View style={styles.paymentMethodIcon}>
                  <Building2 size={24} color={colors.primary} />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodTitle}>Bank Account</Text>
                  <Text style={styles.paymentMethodDescription}>Add funds from your bank account</Text>
                </View>
                <ChevronRight size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.ScrollView>

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

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean) => StyleSheet.create({
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    position: 'relative',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: '25%', // 50% of tab width (which is 50% of screen)
    backgroundColor: colors.primary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    left: '12.5%', // Center in first tab by default
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  tabContent: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: isSmallScreen ? 16 : 20,
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
    gap: 16,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
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