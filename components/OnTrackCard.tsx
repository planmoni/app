import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { Lightbulb, Target, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PayoutPlan } from '@/hooks/useRealtimePayoutPlans';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { supabase } from '@/lib/supabase';

interface OnTrackCardProps {
  payoutPlans: PayoutPlan[];
}

const ON_TRACK_CALCULATION_KEY = 'on_track_calculation_hash';
const ON_TRACK_CARD_DISMISSED_KEY = 'on_track_card_dismissed';

function OnTrackCard({ payoutPlans }: OnTrackCardProps) {
  const { colors, isDark } = useTheme();
  const { lightImpact } = useHaptics();
  const { textSizeMultiplier } = useTextSize();
  const [isDismissed, setIsDismissed] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [customAmountsByPlan, setCustomAmountsByPlan] = useState<Record<string, Record<string, number>>>({});
  const [customDatesByPlan, setCustomDatesByPlan] = useState<Record<string, string[]>>({});
  const [calculation, setCalculation] = useState<{
    totalPayout: number;
    timeValue: number;
    timeUnit: 'day' | 'year';
    calculationHash: string;
  } | null>(null);

  // Fetch custom payout dates and amounts for custom plans
  useEffect(() => {
    const fetchCustomData = async () => {
      const customPlans = payoutPlans.filter(plan => plan.status === 'active' && plan.frequency === 'custom');
      if (customPlans.length === 0) {
        setCustomAmountsByPlan({});
        setCustomDatesByPlan({});
        return;
      }

      try {
        const planIds = customPlans.map(plan => plan.id);
        const { data, error } = await supabase
          .from('custom_payout_dates')
          .select('payout_plan_id, payout_date, amount')
          .in('payout_plan_id', planIds)
          .order('payout_date', { ascending: true });

        if (error) throw error;

        // Group by plan_id: { planId: { date: amount } }
        const amountsByPlan: Record<string, Record<string, number>> = {};
        const datesByPlan: Record<string, string[]> = {};
        
        data?.forEach((item: any) => {
          if (!amountsByPlan[item.payout_plan_id]) {
            amountsByPlan[item.payout_plan_id] = {};
            datesByPlan[item.payout_plan_id] = [];
          }
          const amount = item.amount !== null && item.amount !== undefined 
            ? parseFloat(item.amount.toString()) 
            : 0;
          amountsByPlan[item.payout_plan_id][item.payout_date] = amount > 0 ? amount : 0;
          datesByPlan[item.payout_plan_id].push(item.payout_date);
        });

        setCustomAmountsByPlan(amountsByPlan);
        setCustomDatesByPlan(datesByPlan);
      } catch (error) {
        console.error('Error fetching custom payout data:', error);
        setCustomAmountsByPlan({});
        setCustomDatesByPlan({});
      }
    };

    fetchCustomData();
  }, [payoutPlans]);

  // Calculate total payout and longest duration
  useEffect(() => {
    const activePlans = payoutPlans.filter(plan => plan.status === 'active');
    
    if (activePlans.length === 0) {
      setCalculation(null);
      return;
    }

    // Calculate total scheduled payout amount
    let totalPayout = 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    activePlans.forEach(plan => {
      const remainingPayouts = plan.duration - plan.completed_payouts;
      
      if (remainingPayouts <= 0) return; // Skip completed plans

      if (plan.frequency === 'custom') {
        // For custom plans, use actual custom amounts and dates
        const customDates = customDatesByPlan[plan.id] || [];
        const customAmounts = customAmountsByPlan[plan.id] || {};
        
        // Filter to only future dates
        const futureDates = customDates.filter(date => {
          const dateObj = new Date(date);
          dateObj.setHours(0, 0, 0, 0);
          return dateObj >= now;
        });

        // Sum the amounts for future dates
        futureDates.forEach(date => {
          const amount = customAmounts[date] || plan.payout_amount;
          totalPayout += amount;
        });
      } else {
        // For regular plans, use payout_amount * remaining payouts
        totalPayout += remainingPayouts * plan.payout_amount;
      }
    });

    // Find the plan with the longest duration (last payout date)
    let lastPayoutDate: Date | null = null;
    
    activePlans.forEach(plan => {
      if (!plan.start_date) return;
      
      const startDate = new Date(plan.start_date);
      let planLastDate: Date | null = null;
      const remainingPayouts = plan.duration - plan.completed_payouts;
      
      if (remainingPayouts <= 0) return; // Skip completed plans
      
      if (plan.frequency === 'custom') {
        // For custom plans, use the actual last date from custom dates
        const customDates = customDatesByPlan[plan.id] || [];
        if (customDates.length > 0) {
          // Filter to only future dates and get the last one
          const futureDates = customDates
            .filter(date => {
              const dateObj = new Date(date);
              dateObj.setHours(0, 0, 0, 0);
              return dateObj >= now;
            })
            .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
          
          if (futureDates.length > 0) {
            planLastDate = new Date(futureDates[futureDates.length - 1]);
          }
        }
      } else {
      // Calculate last payout date based on frequency and remaining payouts
        planLastDate = new Date(startDate);
        
      switch (plan.frequency) {
        case 'daily':
          // For daily, use next_payout_date if available, otherwise calculate from start date
          if (plan.next_payout_date) {
            const nextDate = new Date(plan.next_payout_date);
            // Last payout date = next date + (remaining payouts - 1) days
            planLastDate = new Date(nextDate);
            planLastDate.setDate(nextDate.getDate() + (remainingPayouts - 1));
          } else {
            // Calculate from start date: start + completed payouts + (remaining - 1) days
            planLastDate.setDate(startDate.getDate() + plan.completed_payouts + (remainingPayouts - 1));
          }
          break;
        case 'weekly':
          // Add remaining payouts * 7 days
          planLastDate.setDate(startDate.getDate() + (plan.completed_payouts * 7) + ((remainingPayouts - 1) * 7));
          break;
        case 'biweekly':
          // Add remaining payouts * 14 days
          planLastDate.setDate(startDate.getDate() + (plan.completed_payouts * 14) + ((remainingPayouts - 1) * 14));
          break;
        case 'monthly':
          // Add remaining payouts months
          planLastDate.setMonth(startDate.getMonth() + plan.completed_payouts + (remainingPayouts - 1));
          break;
        }
      }
      
      if (planLastDate && (!lastPayoutDate || planLastDate > lastPayoutDate)) {
        lastPayoutDate = planLastDate;
      }
    });

    if (!lastPayoutDate || totalPayout === 0) {
      setCalculation(null);
      return;
    }

    // Calculate time until last payout in days
    const finalLastPayoutDate: Date = lastPayoutDate;
    const lastPayoutTime: number = finalLastPayoutDate.getTime();
    const daysDiff = Math.ceil(
      (lastPayoutTime - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Convert to the most appropriate unit (days or years)
    let timeValue: number;
    let timeUnit: 'day' | 'year';
    
    if (daysDiff < 0) {
      // Past date, use minimum
      timeValue = 1;
      timeUnit = 'day';
    } else if (daysDiff < 365) {
      // Less than 1 year - show in days
      timeValue = Math.max(1, daysDiff);
      timeUnit = 'day';
    } else {
      // 1 year or more - show in years
      timeValue = Math.max(1, Math.ceil(daysDiff / 365));
      timeUnit = 'year';
    }

    setCalculation({
      totalPayout,
      timeValue,
      timeUnit,
      calculationHash: `${totalPayout}-${lastPayoutTime}`,
    });
  }, [payoutPlans, customAmountsByPlan, customDatesByPlan]);

  // Check if we should show the card (new calculation)
  useEffect(() => {
    const checkShouldShow = async () => {
      if (!calculation) {
        setShouldShow(false);
        return;
      }

      try {
        // Check if card was dismissed
        const dismissed = await AsyncStorage.getItem(ON_TRACK_CARD_DISMISSED_KEY);
        if (dismissed === calculation.calculationHash) {
          setIsDismissed(true);
          setShouldShow(false);
          return;
        }

        // Check if this is a new calculation
        const lastHash = await AsyncStorage.getItem(ON_TRACK_CALCULATION_KEY);
        if (lastHash !== calculation.calculationHash) {
          // New calculation - show the card
          setShouldShow(true);
          setIsDismissed(false);
          // Save the new hash
          await AsyncStorage.setItem(ON_TRACK_CALCULATION_KEY, calculation.calculationHash);
        } else {
          // Same calculation - don't show if previously dismissed
          setShouldShow(!isDismissed);
        }
      } catch (error) {
        console.error('Error checking on track card state:', error);
        setShouldShow(true);
      }
    };

    checkShouldShow();
  }, [calculation, isDismissed]);

  const handleClose = useCallback(async () => {
    lightImpact();
    setIsDismissed(true);
    setShouldShow(false);
    
    if (calculation) {
      try {
        await AsyncStorage.setItem(ON_TRACK_CARD_DISMISSED_KEY, calculation.calculationHash);
      } catch (error) {
        console.error('Error saving dismissed state:', error);
      }
    }
  }, [calculation, lightImpact]);

  const formatAmount = useCallback((amount: number) => {
    if (amount >= 1000000) {
      return `₦${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `₦${(amount / 1000).toFixed(1)}K`;
    }
    return `₦${amount.toLocaleString()}`;
  }, []);

  if (!calculation || !shouldShow) {
    return null;
  }

  const styles = createStyles(colors, isDark, textSizeMultiplier);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            {/* <Lightbulb size={16} color={colors.text} /> */}
          </View>
          
        </View>
        <Text style={styles.message}>
        🎯 You're on track to receive{' '}
          <Text style={styles.bold}>{formatAmount(calculation.totalPayout)}</Text>
          {' '}to your bank account over the next{' '}
          <Text style={styles.bold}>{calculation.timeValue}</Text>
          {' '}{calculation.timeUnit}{calculation.timeValue !== 1 ? 's' : ''}.
        </Text>
        <Pressable style={styles.closeButton} onPress={handleClose}>
          <X size={16} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) => StyleSheet.create({
  container: {
    marginBottom: 15,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 12,
    flexDirection: 'row',
    paddingVertical: 16,
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    gap: 12,
    marginRight: 12,
  },
  closeButton: {
    justifyContent: 'flex-end',
    paddingRight: 16,
    // alignItems: 'flex-end',
    marginLeft: 'auto',
    alignSelf: 'flex-start',
  },
  message: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 15 : 14, textSizeMultiplier),
    lineHeight: getScaledFontSize(Platform.OS === 'ios' ? 17 : 14, textSizeMultiplier),
    color: colors.text,
    maxWidth: '85%',
  },
  bold: {
    fontWeight: '700',
    color: colors.text,
  },
});

export default React.memo(OnTrackCard);

