import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, ChevronRight, ChevronDown, ArrowLeft, X, CalendarDays } from 'lucide-react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import KeyboardAvoidingWrapper from '@/components/KeyboardAvoidingWrapper';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';
import { useWindowDimensions } from 'react-native';

type FrequencyOption = {
  value: string;
  label: string;
};

const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly_specific', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly(Every 2 weeks)' },
  { value: 'end_of_month', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly(Every 3 months)' },
  { value: 'biannual', label: 'Bi-annually(Every 6 months)' },
  { value: 'annually', label: 'Annually' },
];

export default function FrequencySelectionScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const haptics = useHaptics();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 380;

  const [selectedFrequency, setSelectedFrequency] = useState<string | null>('daily');
  const [showFrequencyDropdown, setShowFrequencyDropdown] = useState(false);
  const [selectionType, setSelectionType] = useState<'custom' | 'automated' | null>('automated');

  const handleSelectDates = () => {
    if (Platform.OS !== 'web') {
      haptics.mediumImpact();
    }
    
    // Immediately navigate to schedule page with custom frequency
    router.push({
      pathname: '/create-payout/schedule',
      params: {
        totalAmount: params.totalAmount || '',
        frequency: 'custom',
        payoutAmount: params.payoutAmount || '',
        duration: params.duration || '',
        startDate: params.startDate || '',
        bankName: params.bankName || '',
        accountNumber: params.accountNumber || '',
        accountName: params.accountName || '',
        bankAccountId: params.bankAccountId || '',
        payoutAccountId: params.payoutAccountId || '',
        emergencyWithdrawal: 'true', // Always enabled
        customDates: params.customDates || '',
        dayOfWeek: params.dayOfWeek || '',
        payoutHour: params.payoutHour || '',
        payoutMinute: params.payoutMinute || '',
      }
    });
  };

  const handleFrequencySelect = (frequency: string) => {
    if (Platform.OS !== 'web') {
      haptics.selection();
    }
    setSelectionType('automated');
    setSelectedFrequency(frequency);
    setShowFrequencyDropdown(false);
  };

  const handleContinue = () => {
    if (!selectedFrequency) {
      return;
    }

    if (Platform.OS !== 'web') {
      haptics.mediumImpact();
    }

    router.push({
      pathname: '/create-payout/schedule',
      params: {
        totalAmount: params.totalAmount || '',
        frequency: selectedFrequency,
        payoutAmount: params.payoutAmount || '',
        duration: params.duration || '',
        startDate: params.startDate || '',
        bankName: params.bankName || '',
        accountNumber: params.accountNumber || '',
        accountName: params.accountName || '',
        bankAccountId: params.bankAccountId || '',
        payoutAccountId: params.payoutAccountId || '',
        emergencyWithdrawal: 'true', // Always enabled
        customDates: params.customDates || '',
        dayOfWeek: params.dayOfWeek || '',
        payoutHour: params.payoutHour || '',
        payoutMinute: params.payoutMinute || '',
      }
    });
  };

  const getSelectedFrequencyLabel = () => {
    if (selectedFrequency === 'custom') {
      return 'Select dates';
    }
    const option = FREQUENCY_OPTIONS.find(opt => opt.value === selectedFrequency);
    return option?.label || 'Select payment frequency';
  };

  const styles = createStyles(colors, isSmallScreen);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            router.back();
          }} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Payout plan</Text>
        <Pressable 
          onPress={() => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            router.push('/(tabs)');
          }} 
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '50%' }]} />
        </View>
        <Text style={styles.stepText}>Step 2 of 4</Text>
      </View>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Choose a payment schedule</Text>

          {/* Select payment frequency section */}
          <View style={styles.section}>
            <Text style={styles.sectionDescription}>
              Select how often you want to get paid
            </Text>
            <Pressable
              style={[
                styles.selectButton,
                selectionType === 'automated' && styles.selectButtonSelected
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                setShowFrequencyDropdown(!showFrequencyDropdown);
              }}
            >
              <Text style={[
                styles.selectButtonText,
                selectionType === 'automated' && styles.selectButtonTextSelected
              ]}>
                {getSelectedFrequencyLabel()}
              </Text>
              <ChevronDown size={20} color={selectionType === 'automated' ? '#1E3A8A' : colors.textSecondary} />
            </Pressable>

            {/* Frequency dropdown */}
            {showFrequencyDropdown && (
              <View style={styles.dropdownContainer}>
                {FREQUENCY_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.dropdownOption,
                      selectedFrequency === option.value && styles.dropdownOptionSelected
                    ]}
                    onPress={() => handleFrequencySelect(option.value)}
                  >
                    <Text style={[
                      styles.dropdownOptionText,
                      selectedFrequency === option.value && styles.dropdownOptionTextSelected
                    ]}>
                      {option.label}
                    </Text>
                    {selectedFrequency === option.value && (
                      <View style={styles.checkmark}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Or divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Select specific dates section */}
          <View style={styles.section}>
            <Text style={styles.sectionDescription}>
              Select the dates you want to get paid
            </Text>
            <Pressable
              style={[
                styles.selectButton,
                selectionType === 'custom' && styles.selectButtonSelected
              ]}
              onPress={handleSelectDates}
            >
              <CalendarDays size={20} color={selectionType === 'custom' ? '#1E3A8A' : colors.text} />
              <Text style={[
                styles.selectButtonText,
                selectionType === 'custom' && styles.selectButtonTextSelected
              ]}>
                Select dates
              </Text>
              <ChevronRight size={20} color={selectionType === 'custom' ? '#1E3A8A' : colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingWrapper>

      <FloatingButton 
        title="Continue"
        onPress={handleContinue}
        disabled={!selectedFrequency}
        hapticType="medium"
      />
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
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  cancelButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  progressContainer: {
    padding: 20,
    paddingBottom: 0,
    backgroundColor: colors.surface,
  },
  progressBar: {
    height: 2,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1E3A8A',
    borderRadius: 2,
  },
  stepText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  content: {
    padding: 20,
    paddingTop: 0,
  },
  title: {
    fontSize: isSmallScreen ? 18 : 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 25,
    gap: 12,
  },
  selectButtonSelected: {
    backgroundColor: colors.accentBackground,
    borderColor: '#1E3A8A',
  },
  selectButtonText: {
    flex: 1,
    fontSize: 20,
    color: colors.text,
    fontWeight: '500',
  },
  selectButtonTextSelected: {
    color: '#1E3A8A',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 14,
    color: colors.textSecondary,
    paddingHorizontal: 16,
    fontWeight: '500',
  },
  dropdownContainer: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownOptionSelected: {
    backgroundColor: colors.backgroundTertiary,
  },
  dropdownOptionText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  dropdownOptionTextSelected: {
    color: '#1E3A8A',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

