import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  Lightbulb, 
  TrendingUp, 
  Target, 
  PiggyBank, 
  Calendar,
  Sparkles
} from 'lucide-react-native';
import { useHaptics } from '@/hooks/useHaptics';
import { logAnalyticsEvent } from '@/lib/firebase';
import { usePayoutPlansQuery } from '@/hooks/queries/usePayoutPlansQuery';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { router } from 'expo-router';
import { getPurposeLabel } from '@/lib/payout-purposes';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = 200; // Smaller cards
const CARD_SPACING = 12;

interface Suggestion {
  id: string;
  title: string;
  description: string;
  amount: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'end_of_month';
  duration: number;
  icon: React.ReactNode;
  color: string;
  benefits: string[];
  recommended: boolean;
  /** Purpose value from payout-purposes; used for display label and create flow */
  purpose?: string;
}

interface AISuggestionCardProps {
  availableBalance: number;
  onSuggestionPress: (suggestion: Suggestion) => void;
}

function AISuggestionCard({ 
  availableBalance, 
  onSuggestionPress 
}: AISuggestionCardProps) {
  const { colors, isDark } = useTheme();
  const { impact } = useHaptics();
  const { textSizeMultiplier } = useTextSize();
  const { requireAuth, isAuthenticated } = useRequireAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const { payoutPlans } = usePayoutPlansQuery();

  // Analyze user's payout patterns to make intelligent suggestions
  const analyzeUserPatterns = useCallback(() => {
    if (payoutPlans.length === 0) {
      return {
        mostCommonFrequency: 'weekly',
        averageAmount: availableBalance * 0.3,
        totalPlans: 0
      };
    }

    // Count frequency patterns
    const frequencyCount = payoutPlans.reduce((acc, plan) => {
      acc[plan.frequency] = (acc[plan.frequency] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Find most common frequency
    const mostCommonFrequency = Object.keys(frequencyCount).reduce((a, b) => 
      frequencyCount[a] > frequencyCount[b] ? a : b
    );

    // Calculate average amount
    const totalAmount = payoutPlans.reduce((sum, plan) => sum + plan.payout_amount, 0);
    const averageAmount = totalAmount / payoutPlans.length;

    return {
      mostCommonFrequency,
      averageAmount,
      totalPlans: payoutPlans.length
    };
  }, [payoutPlans, availableBalance]);

  // Get duration options based on frequency (matching the schedule page logic)
  const getDurationOptions = (frequency: string) => {
    switch (frequency) {
      case 'daily':
        return [
          { value: 7, label: '1 Week', description: '7 daily payments' },
          { value: 30, label: '1 Month', description: '30 daily payments' },
          { value: 90, label: '3 Months', description: '90 daily payments' }
        ];
      case 'weekly':
        return [
          { value: 4, label: '1 Month', description: '4 weekly payments' },
          { value: 12, label: '3 Months', description: '12 weekly payments' },
          { value: 24, label: '6 Months', description: '24 weekly payments' },
          { value: 52, label: '1 Year', description: '52 weekly payments' }
        ];
      case 'biweekly':
        return [
          { value: 2, label: '1 Month', description: '2 bi-weekly payments' },
          { value: 6, label: '3 Months', description: '6 bi-weekly payments' },
          { value: 12, label: '6 Months', description: '12 bi-weekly payments' },
          { value: 26, label: '1 Year', description: '26 bi-weekly payments' }
        ];
      case 'monthly':
      case 'end_of_month':
        return [
          { value: 1, label: '1 Month', description: '1 monthly payment' },
          { value: 3, label: '3 Months', description: '3 monthly payments' },
          { value: 6, label: '6 Months', description: '6 monthly payments' },
          { value: 12, label: '1 Year', description: '12 monthly payments' }
        ];
      default:
        return [
          { value: 12, label: '1 Year', description: '12 monthly payments' }
        ];
    }
  };

  // Generate AI suggestions based on available balance and user patterns
  const generateSuggestions = useCallback((): Suggestion[] => {
    // Only show suggestions if balance is more than 1,000 (lowered threshold)
    if (availableBalance < 10000) {
      return [];
    }

    const userPatterns = analyzeUserPatterns();
    const suggestions: Suggestion[] = [];

    // Default suggestion structure with fixed payout counts and purpose labels
    const defaultSuggestions = [
      {
        id: 'daily-30-suggestion',
        title: 'Daily Plan',
        description: '30 daily payments',
        frequency: 'daily' as const,
        color: '#8B5CF6',
        icon: <TrendingUp size={20} color="#8B5CF6" />,
        purpose: 'transportation',
      },
      {
        id: 'daily-7-suggestion',
        title: 'Daily Plan',
        description: '7 daily payments',
        frequency: 'daily' as const,
        color: '#7C3AED',
        icon: <TrendingUp size={20} color="#7C3AED" />,
        purpose: 'personal_salary_allowance',
      },
      {
        id: 'weekly-suggestion',
        title: 'Weekly Plan',
        description: 'Regular weekly savings',
        frequency: 'weekly' as const,
        color: '#10B981',
        icon: <PiggyBank size={20} color="#10B981" />,
        purpose: 'groceries_food',
      },
      {
        id: 'weekly-4-suggestion',
        title: 'Weekly Plan',
        description: '4 weekly payments',
        frequency: 'weekly' as const,
        color: '#059669',
        icon: <PiggyBank size={20} color="#059669" />,
        purpose: 'groceries_food',
      },
      {
        id: 'biweekly-suggestion',
        title: 'Bi-weekly Plan',
        description: 'Every two weeks',
        frequency: 'biweekly' as const,
        color: '#3B82F6',
        icon: <Calendar size={20} color="#3B82F6" />,
        purpose: 'family_support',
      },
      {
        id: 'month-end-suggestion',
        title: 'Month-end Plan',
        description: 'End of month payout',
        frequency: 'end_of_month' as const,
        color: '#F59E0B',
        icon: <Target size={20} color="#F59E0B" />,
        purpose: 'rent_service_charge',
      }
    ];

    // Use the full available balance as total amount
    const totalAmount = availableBalance;
    
    defaultSuggestions.forEach((suggestion) => {
      // Filter out daily-30-suggestion if amount is less than 50k
      if (suggestion.id === 'daily-30-suggestion' && availableBalance < 50000) {
        return; // Skip this suggestion
      }
      
      // Get duration options for this frequency
      const durationOptions = getDurationOptions(suggestion.frequency);
      
      // Choose a reasonable duration based on user patterns
      let selectedDuration;
      
      // Special case for weekly-4-suggestion - always use 4 payouts
      if (suggestion.id === 'weekly-4-suggestion') {
        selectedDuration = { value: 4, label: '1 Month', description: '4 weekly payments' };
      } else if (suggestion.id === 'daily-30-suggestion') {
        // Special case for daily-30-suggestion - always use 30 payouts
        selectedDuration = { value: 30, label: '1 Month', description: '30 daily payments' };
      } else if (suggestion.id === 'daily-7-suggestion') {
        // Special case for daily-7-suggestion - always use 7 payouts
        selectedDuration = { value: 7, label: '1 Week', description: '7 daily payments' };
      } else if (userPatterns.totalPlans > 0 && suggestion.frequency === userPatterns.mostCommonFrequency) {
        // For user's preferred frequency, use a longer duration
        selectedDuration = durationOptions[durationOptions.length - 1]; // Use the longest duration
      } else {
        // For other frequencies, use a shorter duration
        selectedDuration = durationOptions[1] || durationOptions[0]; // Use 2nd option or first
      }

      // Calculate payout amount using the same logic as the schedule page
      const payoutAmount = totalAmount / selectedDuration.value;
      
      suggestions.push({
        id: suggestion.id,
        title: suggestion.title,
        description: suggestion.description,
        amount: Math.round(payoutAmount),
        frequency: suggestion.frequency,
        duration: selectedDuration.value,
        icon: suggestion.icon,
        color: suggestion.color,
        benefits: ['Smart savings', 'Automated', 'Flexible'],
        recommended: suggestion.frequency === userPatterns.mostCommonFrequency && userPatterns.totalPlans > 0,
        purpose: suggestion.purpose,
      });
    });

    // Sort by frequency priority (Daily first), then by recommended, then by amount
    return suggestions.sort((a, b) => {
      // Priority order: Daily > Weekly > Bi-weekly > Monthly > Others
      const frequencyPriority = {
        'daily': 1,
        'weekly': 2,
        'biweekly': 3,
        'monthly': 4,
        'end_of_month': 5
      };
      
      const aPriority = frequencyPriority[a.frequency as keyof typeof frequencyPriority] || 6;
      const bPriority = frequencyPriority[b.frequency as keyof typeof frequencyPriority] || 6;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // If same frequency, sort by recommended first
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      
      // Finally sort by amount (highest first)
      return b.amount - a.amount;
    });
  }, [availableBalance, analyzeUserPatterns]);

  const suggestions = useMemo(() => generateSuggestions(), [generateSuggestions]);

  const handleScroll = useCallback((event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / (CARD_WIDTH + CARD_SPACING));
    if (index !== currentIndex && index >= 0 && index < suggestions.length) {
      setCurrentIndex(index);
    }
  }, [currentIndex, suggestions.length]);

  const handleSuggestionPress = useCallback((suggestion: Suggestion) => {
    impact();
    logAnalyticsEvent('ai_suggestion_clicked', {
      suggestion_id: suggestion.id,
      suggestion_title: suggestion.title,
      suggested_amount: suggestion.amount,
      user_balance: availableBalance,
    });
    onSuggestionPress(suggestion);
  }, [availableBalance, impact, onSuggestionPress]);

  const formatAmount = useCallback((amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  const getFrequencyText = useCallback((frequency: string) => {
    switch (frequency) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Bi-weekly';
      case 'monthly': return 'Monthly';
      case 'end_of_month': return 'Month-end';
      default: return frequency;
    }
  }, []);

  const getPayoutCount = useCallback((frequency: string, duration: number) => {
    // Return the actual number of payouts based on duration
    return duration;
  }, []);

  const styles = createStyles(textSizeMultiplier);

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Sparkles size={20} color="#1E3A8A" />
            <Text style={styles.title}>AI Suggestions</Text>
          </View>
        </View>
        <View style={styles.loginPromptCard}>
          <Text style={styles.loginPromptText}>
            Login to get personalized payout plan suggestions powered by AI
          </Text>
          <Pressable
            style={styles.loginPromptButton}
            onPress={() => requireAuth(() => {}, '/(tabs)/index')}
          >
            <Text style={styles.loginPromptButtonText}>Login to Continue</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            Suggested based on your balance
          </Text>
          {/* <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Based on your balance</Text> */}
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {suggestions.map((suggestion, index) => (
          <Pressable
            key={suggestion.id}
            style={[
              styles.suggestionCard,
              { 
                backgroundColor: colors.card,
                borderColor: colors.border,
                width: CARD_WIDTH,
              }
            ]}
            onPress={() => handleSuggestionPress(suggestion)}
          >
            <View style={styles.cardContent}>
              <View style={styles.amountSection}>
                {suggestion.purpose ? (
                  <Text style={[styles.purposeTitle, { color: colors.text }]} numberOfLines={2}>
                    {getPurposeLabel(suggestion.purpose)}
                  </Text>
                ) : null}
                <Text style={[styles.amount, { color: colors.text }]}>
                  {formatAmount(suggestion.amount)}
                </Text>
                <Text style={[styles.frequency, { color: colors.textSecondary }]}>
                  {getFrequencyText(suggestion.frequency)} • {getPayoutCount(suggestion.frequency, suggestion.duration)} payouts
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* {suggestions.length > 1 && (
        <View style={styles.pagination}>
          {suggestions.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                {
                  backgroundColor: index === currentIndex ? colors.primary : colors.border,
                }
              ]}
            />
          ))}
        </View>
      )} */}
    </View>
  );
}

const createStyles = (textSizeMultiplier: number) => StyleSheet.create({
  container: {
    marginTop: 5,
    marginBottom: 15,
  },
  header: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 13 : 12, textSizeMultiplier),
    fontWeight: '500',
  },
  subtitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    fontWeight: '400',
  },
  scrollContent: {
    paddingHorizontal: 5,
  },
  suggestionCard: {
    marginRight: CARD_SPACING,
    borderRadius: 12,
    padding: 10,
    borderWidth: 0.5,
    borderColor: '#000',
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 1},
    shadowOpacity: 0.03,
    shadowRadius: 6,
  
    position: 'relative',
  },
  cardContent: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    flex: 1,
  },
  amountSection: {
    alignItems: 'flex-start',
  },
  purposeTitle: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 11 : 10, textSizeMultiplier),
    fontWeight: '500',
    marginBottom: 6,
    textAlign: 'left',
  },
  amount: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 16 : 14, textSizeMultiplier),
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'left',
  },
  frequency: {
    fontSize: getScaledFontSize(12, textSizeMultiplier),
    fontWeight: '500',
    textAlign: 'left',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loginPromptCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  loginPromptText: {
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  loginPromptButton: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginPromptButtonText: {
    color: '#FFFFFF',
    fontSize: getScaledFontSize(Platform.OS === 'ios' ? 14 : 12, textSizeMultiplier),
    fontWeight: '600',
  },
});

export default React.memo(AISuggestionCard);
