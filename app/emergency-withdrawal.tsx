import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Clock, Zap, Check, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useBalance } from '@/contexts/BalanceContext';
import Button from '@/components/Button';
import SafeFooter from '@/components/SafeFooter';
import { useHaptics } from '@/hooks/useHaptics';

export default function EmergencyWithdrawalScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams();
  const planId = params.id as string;
  const planName = params.name as string;
  const planAmount = params.amount as string;
  const haptics = useHaptics();
  
  const [selectedOption, setSelectedOption] = useState<'instant' | '24h' | '72h' | null>(null);
  
  // Calculate fees based on the selected option
  const getFeeAmount = () => {
    if (!planAmount || !selectedOption) return 0;
    
    const amount = parseFloat(planAmount.replace(/[^0-9.]/g, ''));
    
    switch (selectedOption) {
      case 'instant':
        return amount * 0.12; // 12% fee
      case '24h':
        return amount * 0.06; // 6% fee
      case '72h':
        return 0; // 0% fee
      default:
        return 0;
    }
  };
  
  // Calculate the net amount after fees
  const getNetAmount = () => {
    if (!planAmount || !selectedOption) return 0;
    
    const amount = parseFloat(planAmount.replace(/[^0-9.]/g, ''));
    return amount - getFeeAmount();
  };
  
  const handleOptionSelect = (option: 'instant' | '24h' | '72h') => {
    haptics.selection();
    setSelectedOption(option);
  };
  
  const handleConfirm = () => {
    if (!selectedOption) return;
    
    haptics.mediumImpact();
    
    // In a real app, this would call an API to process the emergency withdrawal
    router.replace({
      pathname: '/emergency-withdrawal/confirmation',
      params: {
        planId,
        planName,
        planAmount,
        option: selectedOption,
        feeAmount: getFeeAmount().toString(),
        netAmount: getNetAmount().toString()
      }
    });
  };
  
  const styles = createStyles(colors, isDark);
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable 
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }} 
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Emergency Withdrawal</Text>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.warningCard}>
          <AlertTriangle size={24} color="#F97316" />
          <Text style={styles.warningText}>
            Emergency withdrawals allow you to access your funds before the scheduled payout date, but may incur fees depending on the option you choose.
          </Text>
        </View>
        
        <Text style={styles.sectionTitle}>Select Withdrawal Option</Text>
        
        <View style={styles.optionsContainer}>
          <Pressable 
            style={[
              styles.optionCard,
              selectedOption === 'instant' && styles.selectedOption
            ]}
            onPress={() => handleOptionSelect('instant')}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.optionIcon, { backgroundColor: '#FEE2E2' }]}>
                <Zap size={24} color="#EF4444" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Instant Withdrawal</Text>
                <Text style={styles.optionFee}>12% processing fee</Text>
              </View>
              {selectedOption === 'instant' && (
                <View style={styles.checkIcon}>
                  <Check size={20} color="#FFFFFF" />
                </View>
              )}
            </View>
            <Text style={styles.optionDescription}>
              Get your funds immediately with the highest processing fee.
            </Text>
          </Pressable>
          
          <Pressable 
            style={[
              styles.optionCard,
              selectedOption === '24h' && styles.selectedOption
            ]}
            onPress={() => handleOptionSelect('24h')}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.optionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Clock size={24} color="#F59E0B" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>24-Hour Withdrawal</Text>
                <Text style={styles.optionFee}>6% processing fee</Text>
              </View>
              {selectedOption === '24h' && (
                <View style={styles.checkIcon}>
                  <Check size={20} color="#FFFFFF" />
                </View>
              )}
            </View>
            <Text style={styles.optionDescription}>
              Receive your funds within 24 hours with a reduced processing fee.
            </Text>
          </Pressable>
          
          <Pressable 
            style={[
              styles.optionCard,
              selectedOption === '72h' && styles.selectedOption
            ]}
            onPress={() => handleOptionSelect('72h')}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.optionIcon, { backgroundColor: '#DCFCE7' }]}>
                <Clock size={24} color="#22C55E" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>72-Hour Withdrawal</Text>
                <Text style={styles.optionFee}>No processing fee</Text>
              </View>
              {selectedOption === '72h' && (
                <View style={styles.checkIcon}>
                  <Check size={20} color="#FFFFFF" />
                </View>
              )}
            </View>
            <Text style={styles.optionDescription}>
              Wait 72 hours for your funds with no processing fee.
            </Text>
          </Pressable>
        </View>
        
        {selectedOption && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Withdrawal Summary</Text>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Withdrawal Amount</Text>
              <Text style={styles.summaryValue}>{planAmount}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Processing Fee</Text>
              <Text style={styles.summaryValue}>₦{getFeeAmount().toLocaleString()}</Text>
            </View>
            
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>You'll Receive</Text>
              <Text style={styles.totalValue}>₦{getNetAmount().toLocaleString()}</Text>
            </View>
          </View>
        )}
      </ScrollView>
      
      <View style={styles.footer}>
        <Button
          title="Confirm Withdrawal"
          onPress={handleConfirm}
          style={styles.confirmButton}
          disabled={!selectedOption}
          hapticType="medium"
        />
        <Button
          title="Cancel"
          onPress={() => {
            haptics.lightImpact();
            router.back();
          }}
          variant="outline"
          style={styles.cancelButton}
          hapticType="light"
        />
      </View>
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
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
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFF7ED',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderLeftWidth: 4,
    borderLeftColor: '#F97316',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: isDark ? '#FFEDD5' : '#9A3412',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  optionFee: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  footer: {
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  cancelButton: {
    borderColor: colors.border,
  },
});