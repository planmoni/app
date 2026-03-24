import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ScrollView } from 'react-native';
import { TrendingUp, PiggyBank, Calendar, ArrowRight, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useHaptics } from '@/hooks/useHaptics';

interface SuggestedPlan {
  id: string;
  title: string;
  description: string;
  frequency: string;
  duration: number;
  color: string;
  icon: React.ReactNode;
}

interface PlanCreationModalProps {
  isVisible: boolean;
  onClose: () => void;
  depositAmount: number;
}

export default function PlanCreationModal({
  isVisible,
  onClose,
  depositAmount,
}: PlanCreationModalProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const haptics = useHaptics();
  const isSmallScreen = width < 380 || height < 700;

  // Generate suggested plans based on deposit amount
  const generateSuggestions = (): SuggestedPlan[] => {
    const suggestions: SuggestedPlan[] = [];

    // Daily plan - 30 days (only show if depositAmount >= 50000)
    if (depositAmount >= 50000) {
    suggestions.push({
      id: 'daily-30',
      title: 'Daily Plan',
      description: '30 daily payments',
      frequency: 'daily',
      duration: 30,
      color: '#8B5CF6',
      icon: <TrendingUp size={20} color="#8B5CF6" />,
      });
    }

    // Daily plan - 7 days (always available)
    suggestions.push({
      id: 'daily-7',
      title: 'Daily Plan',
      description: '7 daily payments',
      frequency: 'daily',
      duration: 7,
      color: '#7C3AED',
      icon: <TrendingUp size={20} color="#7C3AED" />,
    });

    // Weekly plan - 4 weeks
    suggestions.push({
      id: 'weekly-4',
      title: 'Weekly Plan',
      description: '4 weekly payments',
      frequency: 'weekly_specific',
      duration: 4,
      color: '#10B981',
      icon: <PiggyBank size={20} color="#10B981" />,
    });

    // Monthly plan - 3 months
    suggestions.push({
      id: 'monthly-3',
      title: 'Monthly Plan',
      description: '3 monthly payments',
      frequency: 'end_of_month',
      duration: 3,
      color: '#3B82F6',
      icon: <Calendar size={20} color="#3B82F6" />,
    });

    return suggestions;
  };

  const suggestions = generateSuggestions();
  const payoutAmount = depositAmount / suggestions[0].duration; // Calculate per-payout amount for first suggestion

  const handleSuggestionPress = (suggestion: SuggestedPlan) => {
    haptics.mediumImpact();
    onClose();
    
    // Navigate to frequency-selection page with suggested parameters
    router.push({
      pathname: '/create-payout/frequency-selection',
      params: {
        totalAmount: depositAmount.toString(),
        frequency: suggestion.frequency,
        duration: suggestion.duration.toString(),
      },
    });
  };

  const handleNewPlan = () => {
    haptics.mediumImpact();
    onClose();
    router.push('/create-payout/amount');
  };

  const handleClose = () => {
    haptics.lightImpact();
    onClose();
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalContainer: {
      width: '100%',
      maxWidth: 400,
      maxHeight: '90%',
      borderRadius: 24,
      padding: isSmallScreen ? 24 : 32,
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    },
    title: {
      fontSize: isSmallScreen ? 22 : 26,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    message: {
      fontSize: isSmallScreen ? 14 : 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: isSmallScreen ? 20 : 24,
      marginBottom: 24,
    },
    depositAmount: {
      fontSize: isSmallScreen ? 20 : 24,
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 32,
    },
    suggestionsTitle: {
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    suggestionsContainer: {
      marginBottom: 24,
    },
    suggestionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    suggestionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.backgroundTertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    suggestionContent: {
      flex: 1,
    },
    suggestionTitle: {
      fontSize: isSmallScreen ? 15 : 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    suggestionDescription: {
      fontSize: isSmallScreen ? 13 : 14,
      color: colors.textSecondary,
    },
    suggestionArrow: {
      marginLeft: 8,
    },
    newPlanButton: {
      width: '100%',
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 20,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    newPlanButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <X size={20} color={colors.text} />
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Quick Payout Plans</Text>
            
            <Text style={styles.message}>
              You recently added {formatCurrency(depositAmount)}. Here are some suggested payout plans:
            </Text>

            <Text style={styles.suggestionsTitle}>Suggested Plans</Text>

            <View style={styles.suggestionsContainer}>
              {suggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.id}
                  style={styles.suggestionCard}
                  onPress={() => handleSuggestionPress(suggestion)}
                >
                  
                  <View style={styles.suggestionContent}>
                    <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                    <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
                  </View>
                  <View style={styles.suggestionArrow}>
                    <ArrowRight size={20} color={colors.textSecondary} />
                  </View>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.newPlanButton} onPress={handleNewPlan}>
              <Text style={styles.newPlanButtonText}>Create New Plan</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

