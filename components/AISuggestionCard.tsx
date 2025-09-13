import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
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
import { useRealtimePayoutPlans } from '@/hooks/useRealtimePayoutPlans';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = 200; // Smaller cards
const CARD_SPACING = 12;

interface Suggestion {
  id: string;
  title: string;
  description: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'end_of_month';
  duration: number;
  icon: React.ReactNode;
  color: string;
  benefits: string[];
  recommended: boolean;
}

interface AISuggestionCardProps {
  availableBalance: number;
  onSuggestionPress: (suggestion: Suggestion) => void;
}

export default function AISuggestionCard({ 
  availableBalance, 
  onSuggestionPress 
}: AISuggestionCardProps) {
  const { colors, isDark } = useTheme();
  const { impact } = useHaptics();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const { payoutPlans } = useRealtimePayoutPlans();

  // Analyze user's payout patterns to make intelligent suggestions
  const analyzeUserPatterns = () => {
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
  };

  // Get duration options based on frequency (matching the schedule page logic)
  const getDurationOptions = (frequency: string) => {
    switch (frequency) {
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
  const generateSuggestions = (): Suggestion[] => {
    // Only show suggestions if balance is more than 10,000
    if (availableBalance < 10000) {
      return [];
    }

    const userPatterns = analyzeUserPatterns();
    const suggestions: Suggestion[] = [];

    // Default suggestion structure with fixed payout counts
    const defaultSuggestions = [
      {
        id: 'weekly-suggestion',
        title: 'Weekly Plan',
        description: 'Regular weekly savings',
        frequency: 'weekly' as const,
        color: '#10B981',
        icon: <PiggyBank size={20} color="#10B981" />,
      },
      {
        id: 'weekly-4-suggestion',
        title: 'Weekly Plan',
        description: '4 weekly payments',
        frequency: 'weekly' as const,
        color: '#059669',
        icon: <PiggyBank size={20} color="#059669" />,
      },
      {
        id: 'biweekly-suggestion',
        title: 'Bi-weekly Plan',
        description: 'Every two weeks',
        frequency: 'biweekly' as const,
        color: '#3B82F6',
        icon: <Calendar size={20} color="#3B82F6" />,
      },
      {
        id: 'month-end-suggestion',
        title: 'Month-end Plan',
        description: 'End of month payout',
        frequency: 'end_of_month' as const,
        color: '#F59E0B',
        icon: <Target size={20} color="#F59E0B" />,
      }
    ];

    // Use the full available balance as total amount
    const totalAmount = availableBalance;
    
    defaultSuggestions.forEach((suggestion) => {
      // Get duration options for this frequency
      const durationOptions = getDurationOptions(suggestion.frequency);
      
      // Choose a reasonable duration based on user patterns
      let selectedDuration;
      
      // Special case for weekly-4-suggestion - always use 4 payouts
      if (suggestion.id === 'weekly-4-suggestion') {
        selectedDuration = { value: 4, label: '1 Month', description: '4 weekly payments' };
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
      });
    });

    // Sort by recommended first, then by amount
    return suggestions.sort((a, b) => {
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      return b.amount - a.amount;
    });
  };

  const suggestions = generateSuggestions();

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / (CARD_WIDTH + CARD_SPACING));
    if (index !== currentIndex && index >= 0 && index < suggestions.length) {
      setCurrentIndex(index);
    }
  };

  const handleSuggestionPress = (suggestion: Suggestion) => {
    impact();
    logAnalyticsEvent('ai_suggestion_clicked', {
      suggestion_id: suggestion.id,
      suggestion_title: suggestion.title,
      suggested_amount: suggestion.amount,
      user_balance: availableBalance,
    });
    onSuggestionPress(suggestion);
  };

  const formatAmount = (amount: number) => {
    return `₦${amount.toLocaleString()}`;
  };

  const getFrequencyText = (frequency: string) => {
    switch (frequency) {
      case 'weekly': return 'Weekly';
      case 'biweekly': return 'Bi-weekly';
      case 'monthly': return 'Monthly';
      case 'end_of_month': return 'Month-end';
      default: return frequency;
    }
  };

  const getPayoutCount = (frequency: string, duration: number) => {
    // Return the actual number of payouts based on duration
    return duration;
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          {/* <Sparkles size={14} color={colors.primary} /> */}
          <Text style={[styles.title, { color: colors.text }]}>
            Plan Suggestions
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Based on your balance</Text>
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

const styles = StyleSheet.create({
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
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  suggestionCard: {
    marginRight: CARD_SPACING,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
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
  amount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'left',
  },
  frequency: {
    fontSize: 12,
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
});
