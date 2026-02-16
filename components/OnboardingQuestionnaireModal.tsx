import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useAuth } from '@/contexts/AuthContext';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/lib/supabase';
import Button from '@/components/Button';

const OCCUPATIONS = ['Student', 'Employed', 'Business Owner', 'Freelancer', 'Others'] as const;
const INCOME_RANGES = [
  '₦10,000 - ₦50,000',
  '₦50,001 - ₦250,000',
  '₦250,001 - ₦500,000',
  '₦500,001 and above',
] as const;
const GOALS = [
  'To plan for my daily or weekly expenses',
  'To place myself on salary plan',
  'To control my spending',
  'To gain structured access to my money',
  'To build better money habits',
  'To automate funds to family & friends',
] as const;

interface OnboardingQuestionnaireModalProps {
  visible: boolean;
  onClose: () => void;
  onAddFunds: () => void;
  onDoLater: () => void;
}

export default function OnboardingQuestionnaireModal({
  visible,
  onClose,
  onAddFunds,
  onDoLater,
}: OnboardingQuestionnaireModalProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const { session } = useAuth();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Responsive breakpoints (portrait: width < height; use shortEdge for consistency)
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  const isSmallScreen = shortEdge < 380 || longEdge < 700;
  const isVerySmallScreen = shortEdge < 340;

  const [step, setStep] = useState(0);
  const [occupation, setOccupation] = useState<string | null>(null);
  const [incomeRange, setIncomeRange] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleGoal = (goal: string) => {
    haptics.selection();
    setGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const saveResponses = async () => {
    if (!session?.user?.id) return;
    setIsSubmitting(true);
    try {
      await supabase.from('onboarding_questionnaire').upsert(
        {
          user_id: session.user.id,
          occupation: occupation ?? undefined,
          income_range: incomeRange ?? undefined,
          goals,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    } catch (e) {
      console.warn('Failed to save onboarding questionnaire:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    haptics.mediumImpact();
    if (step < 4) setStep((s) => s + 1);
  };

  const handleBack = () => {
    haptics.lightImpact();
    if (step > 0) setStep((s) => s - 1);
  };

  const handleAddFunds = async () => {
    await saveResponses();
    onAddFunds();
    onClose();
  };

  const handleDoLater = async () => {
    await saveResponses();
    onDoLater();
    onClose();
  };

  // Modal uses 90% of screen height, with a min height so it stays usable on short/landscape screens
  const modalHeight = Math.max(height * 0.7, 400);
  const styles = createStyles(
    colors,
    isDark,
    isSmallScreen,
    isVerySmallScreen,
    textSizeMultiplier,
    modalHeight,
    width,
    insets.bottom
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {step < 4 && (
            <View style={styles.header}>
              {step > 0 ? (
                <Pressable onPress={handleBack} style={styles.backButton} hitSlop={12}>
                  <ChevronLeft size={24} color={colors.text} />
                </Pressable>
              ) : (
                <View style={styles.backButton} />
              )}
              <View style={styles.stepDots}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i === step && styles.dotActive,
                      i < step && styles.dotDone,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.backButton} />
            </View>
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 0 && (
              <View style={styles.step0Center}>
                <Text style={styles.title}>Welcome, Let&apos;s personalize your Planmoni experience.</Text>
              </View>
            )}

            {step === 1 && (
              <>
                <Text style={styles.question}>What&apos;s your occupation?</Text>
                <Text style={styles.hint}>Select one option</Text>
                {OCCUPATIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    style={[styles.optionCard, occupation === opt && styles.optionCardSelected]}
                    onPress={() => {
                      haptics.selection();
                      setOccupation(opt);
                    }}
                  >
                    <Text style={[styles.optionText, occupation === opt && styles.optionTextSelected]}>
                      {opt}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.question}>What&apos;s your estimated monthly Income?</Text>
                <Text style={styles.hint}>Select one option</Text>
                {INCOME_RANGES.map((opt) => (
                  <Pressable
                    key={opt}
                    style={[styles.optionCard, incomeRange === opt && styles.optionCardSelected]}
                    onPress={() => {
                      haptics.selection();
                      setIncomeRange(opt);
                    }}
                  >
                    <Text style={[styles.optionText, incomeRange === opt && styles.optionTextSelected]}>
                      {opt}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.question}>How would you use Planmoni?</Text>
                <Text style={styles.hint}>Select all that apply</Text>
                {GOALS.map((opt) => (
                  <Pressable
                    key={opt}
                    style={[styles.optionCard, goals.includes(opt) && styles.optionCardSelected]}
                    onPress={() => toggleGoal(opt)}
                  >
                    <Text style={[styles.optionText, goals.includes(opt) && styles.optionTextSelected]}>
                      {opt}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}

            {step === 4 && (
              <View style={styles.step0Center}>
                <Text style={styles.title}>Get started with Planmoni</Text>
                <Text style={styles.body}>
                  Set aside funds and select a daily, weekly,  monthly or custom schedules, and Planmoni will handle automation and release of payouts.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {step < 4 ? (
              <Button
                title={step === 0 ? 'Continue' : 'Next'}
                onPress={handleNext}
                style={styles.primaryButton}
                hapticType="medium"
                disabled={
                  step === 1 ? !occupation :
                  step === 2 ? !incomeRange :
                  step === 3 ? goals.length === 0 : false
                }
              />
            ) : (
              <View style={styles.finalButtons}>
                <Button
                  title="Add funds now"
                  onPress={handleAddFunds}
                  style={styles.addFundsButton}
                  hapticType="medium"
                  disabled={isSubmitting}
                />
                <Button
                  title="Do this later"
                  onPress={handleDoLater}
                  variant="outline"
                  style={styles.doLaterButton}
                  hapticType="light"
                  disabled={isSubmitting}
                />
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (
  colors: any,
  isDark: boolean,
  isSmallScreen: boolean,
  isVerySmallScreen: boolean,
  textSizeMultiplier: number,
  modalHeight: number,
  width: number,
  safeBottom: number
) => {
  const horizontalPadding = Math.min(24, Math.max(16, width * 0.06));
  const cardPadding = isVerySmallScreen ? 12 : Math.min(20, width * 0.05);
  const spacing = isVerySmallScreen ? 12 : isSmallScreen ? 16 : 20;
  const bottomPadding = Math.max(24, safeBottom || (Platform.OS === 'ios' ? 34 : 24));

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      height: modalHeight,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: bottomPadding,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: horizontalPadding,
      paddingTop: spacing,
      paddingBottom: 8,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepDots: {
      flexDirection: 'row',
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      backgroundColor: colors.primary,
      width: 24,
    },
    dotDone: {
      backgroundColor: colors.primary,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: horizontalPadding,
      paddingTop: 8,
      paddingBottom: spacing * 1.5,
      flexGrow: 1,
    },
    step0Center: {
      flex: 1,
      justifyContent: 'center',
    },
    footer: {
      paddingHorizontal: horizontalPadding,
      paddingTop: 16,
      paddingBottom: 0,
      borderTopWidth: 0,
    },
    title: {
      fontSize: getScaledFontSize(isVerySmallScreen ? 18 : isSmallScreen ? 24 : 26, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing,
    },
    question: {
      fontSize: getScaledFontSize(isVerySmallScreen ? 16 : isSmallScreen ? 18 : 20, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    hint: {
      fontSize: getScaledFontSize(isVerySmallScreen ? 12 : 14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: spacing,
    },
    optionCard: {
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: isVerySmallScreen ? 12 : 16,
      paddingHorizontal: cardPadding,
      marginBottom: isVerySmallScreen ? 8 : 12,
    },
    optionCardSelected: {
      borderColor: colors.primary,
      backgroundColor: isDark ? `${colors.primary}20` : `${colors.primary}12`,
    },
    optionText: {
      fontSize: getScaledFontSize(isVerySmallScreen ? 14 : 15, textSizeMultiplier),
      color: colors.text,
      fontWeight: '500',
    },
    optionTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    spacer: {
      height: isVerySmallScreen ? 16 : 24,
    },
    primaryButton: {
      marginTop: 8,
    },
    body: {
      fontSize: getScaledFontSize(isVerySmallScreen ? 14 : isSmallScreen ? 15 : 16, textSizeMultiplier),
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: spacing * 2,
    },
    finalButtons: {
      gap: 12,
    },
    addFundsButton: {},
    doLaterButton: {
      borderColor: colors.border,
    },
  });
};
