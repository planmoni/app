import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  TextInput,
  FlatList,
  Keyboard,
  ListRenderItemInfo,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  X,
  Check,
  Wallet,
  Car,
  UtensilsCrossed,
  UsersRound,
  Briefcase,
  HeartHandshake,
  Sparkles,
  Home,
  Zap,
  Wifi,
  Tv,
  CreditCard,
  PiggyBank,
  MoreHorizontal,
} from 'lucide-react-native';
import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import FloatingButton from '@/components/FloatingButton';
import { PURPOSE_OPTIONS } from '@/lib/payout-purposes';

type PurposeOption = (typeof PURPOSE_OPTIONS)[number];

const PURPOSE_ICONS: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  personal_salary_allowance: Wallet,
  transportation: Car,
  groceries_food: UtensilsCrossed,
  family_support: UsersRound,
  mini_salary_payroll: Briefcase,
  commitments: HeartHandshake,
  personal_care: Sparkles,
  rent_service_charge: Home,
  utility_bills: Zap,
  internet_data: Wifi,
  online_subscriptions: Tv,
  loan_repayments: CreditCard,
  contributions: PiggyBank,
  others: MoreHorizontal,
};

type PurposeOptionRowProps = {
  value: string;
  label: string;
  description: string;
  isSelected: boolean;
  primary: string;
  border: string;
  surface: string;
  backgroundTertiary: string;
  text: string;
  textSecondary: string;
  onSelect: (value: string) => void;
};

const PurposeOptionRow = memo(function PurposeOptionRow({
  value,
  label,
  description,
  isSelected,
  primary,
  border,
  surface,
  backgroundTertiary,
  text,
  textSecondary,
  onSelect,
}: PurposeOptionRowProps) {
  const IconComponent = PURPOSE_ICONS[value];

  return (
    <Pressable
      style={[
        styles.optionCard,
        {
          borderColor: isSelected ? primary : border,
          backgroundColor: isSelected ? primary + '08' : surface,
        },
      ]}
      onPress={() => onSelect(value)}
      // Prefer press over scroll start only after a short delay (Android)
      delayPressIn={50}
    >
      {IconComponent ? (
        <View
          style={[
            styles.optionIconWrap,
            {
              backgroundColor: isSelected ? primary + '20' : backgroundTertiary,
            },
          ]}
        >
          <IconComponent size={22} color={isSelected ? primary : textSecondary} />
        </View>
      ) : null}
      <View style={styles.optionContent}>
        <Text style={[styles.optionLabel, { color: text }]}>{label}</Text>
        <Text style={[styles.optionDescription, { color: textSecondary }]} numberOfLines={2}>
          {description}
        </Text>
      </View>
      <View
        style={[
          styles.checkWrap,
          {
            backgroundColor: isSelected ? primary : 'transparent',
            borderColor: isSelected ? primary : border,
          },
        ]}
      >
        {isSelected ? <Check size={16} color="#FFFFFF" /> : null}
      </View>
    </Pressable>
  );
});

export default function PurposeScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<Record<string, string>>();
  const haptics = useHaptics();
  const [selectedPurpose, setSelectedPurpose] = useState<string | null>(
    'personal_salary_allowance'
  );
  const [purposeOtherText, setPurposeOtherText] = useState('');

  useEffect(() => {
    if (params.purpose) setSelectedPurpose(params.purpose);
    if (params.purposeOther) setPurposeOtherText(params.purposeOther);
  }, [params.purpose, params.purposeOther]);

  const handleSelect = useCallback(
    (value: string) => {
      if (Platform.OS !== 'web') haptics.selection();
      setSelectedPurpose(value);
      if (value !== 'others') {
        Keyboard.dismiss();
      }
    },
    [haptics]
  );

  const handleContinue = useCallback(() => {
    if (!selectedPurpose) return;
    haptics.mediumImpact();
    router.push({
      pathname: '/create-payout/frequency-selection',
      params: {
        totalAmount: params.totalAmount || '',
        frequency: params.frequency || '',
        payoutAmount: params.payoutAmount || '',
        duration: params.duration || '',
        startDate: params.startDate || '',
        bankName: params.bankName || '',
        accountNumber: params.accountNumber || '',
        accountName: params.accountName || '',
        bankAccountId: params.bankAccountId || '',
        payoutAccountId: params.payoutAccountId || '',
        emergencyWithdrawal: params.emergencyWithdrawal || 'false',
        customDates: params.customDates || '',
        customDateAmounts: params.customDateAmounts || '',
        customDateTimes: params.customDateTimes || '',
        dayOfWeek: params.dayOfWeek || '',
        payoutHour: params.payoutHour || '',
        payoutMinute: params.payoutMinute || '',
        purpose: selectedPurpose,
        purposeOther: selectedPurpose === 'others' ? purposeOtherText : '',
      },
    });
  }, [selectedPurpose, purposeOtherText, params, haptics]);

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <Text style={[styles.title, { color: colors.text }]}>What is this plan for?</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Choose a purpose that best describes this payout plan.
        </Text>
      </View>
    ),
    [colors.text, colors.textSecondary]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PurposeOption>) => {
      const isSelected = selectedPurpose === item.value;
      const isOthers = item.value === 'others';

      return (
        <View>
          <PurposeOptionRow
            value={item.value}
            label={item.label}
            description={item.description}
            isSelected={isSelected}
            primary={colors.primary}
            border={colors.border}
            surface={colors.surface}
            backgroundTertiary={colors.backgroundTertiary}
            text={colors.text}
            textSecondary={colors.textSecondary}
            onSelect={handleSelect}
          />
          {isOthers && isSelected ? (
            <View style={styles.otherInputWrap}>
              <TextInput
                style={[
                  styles.otherInput,
                  {
                    backgroundColor: colors.backgroundTertiary,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Describe your purpose (optional)"
                placeholderTextColor={colors.textTertiary}
                value={purposeOtherText}
                onChangeText={setPurposeOtherText}
              />
            </View>
          ) : null}
        </View>
      );
    },
    [
      selectedPurpose,
      purposeOtherText,
      handleSelect,
      colors.primary,
      colors.border,
      colors.surface,
      colors.backgroundTertiary,
      colors.text,
      colors.textSecondary,
      colors.textTertiary,
    ]
  );

  const keyExtractor = useCallback((item: PurposeOption) => item.value, []);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
      edges={['bottom']}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') haptics.lightImpact();
            router.back();
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New Payout plan</Text>
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'web') haptics.lightImpact();
            router.push('/(tabs)');
          }}
          style={styles.cancelButton}
        >
          <X size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={[styles.progressContainer, { backgroundColor: colors.surface }]}>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View style={styles.progressFill} />
        </View>
        <Text style={[styles.stepText, { color: colors.textSecondary }]}>Step 2 of 5</Text>
      </View>

      <FlatList
        data={PURPOSE_OPTIONS}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        extraData={selectedPurpose}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        bounces={false}
        overScrollMode="never"
        // Clipping can cause Android scroll hitching with bordered rows
        removeClippedSubviews={false}
        initialNumToRender={PURPOSE_OPTIONS.length}
        windowSize={PURPOSE_OPTIONS.length + 1}
        maxToRenderPerBatch={PURPOSE_OPTIONS.length}
        scrollEventThrottle={16}
      />

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={!selectedPurpose}
        hapticType="medium"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
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
  },
  progressBar: {
    height: 2,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    width: '40%',
    backgroundColor: '#1E3A8A',
    borderRadius: 2,
  },
  stepText: {
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  listHeader: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 10,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  checkWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otherInputWrap: {
    marginBottom: 10,
    marginLeft: 8,
    marginRight: 8,
  },
  otherInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
});
