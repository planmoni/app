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
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { useAuth } from '@/contexts/AuthContext';
import { useHaptics } from '@/hooks/useHaptics';
import { supabase } from '@/lib/supabase';
import Button from '@/components/Button';

const OCCUPATIONS = ['Student', 'Employed', 'Business Owner', 'Freelancer', 'Others'] as const;
const INCOME_RANGES = [
  '10,000 – 50,000',
  '50,001 – 250,000',
  '250,001 – 500,000',
  '500,001 and above',
] as const;
const GOALS = [
  'Plan for my daily or weekly expenses',
  'Help me save better',
  'Control my spending',
  'Delay access to my money',
  'Build better money habits',
  'Automate funds to family & friends',
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
  const { width, height } = useWindowDimensions();
  const isSmallScreen = width < 380 || height < 700;

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

  const styles = createStyles(colors, isDark, isSmallScreen, textSizeMultiplier);

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
              <>
                <Text style={styles.title}>Welcome, Let&apos;s get to know you better.</Text>
                <View style={styles.spacer} />
                <Button
                  title="Continue"
                  onPress={handleNext}
                  style={styles.primaryButton}
                  hapticType="medium"
                />
              </>
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
                <View style={styles.spacer} />
                <Button
                  title="Next"
                  onPress={handleNext}
                  style={styles.primaryButton}
                  hapticType="medium"
                />
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
                <View style={styles.spacer} />
                <Button
                  title="Next"
                  onPress={handleNext}
                  style={styles.primaryButton}
                  hapticType="medium"
                />
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.question}>How can Planmoni help you?</Text>
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
                <View style={styles.spacer} />
                <Button
                  title="Next"
                  onPress={handleNext}
                  style={styles.primaryButton}
                  hapticType="medium"
                />
              </>
            )}

            {step === 4 && (
              <>
                <Text style={styles.title}>Welcome to Planmoni</Text>
                <Text style={styles.body}>
                  Based on your response you can set aside funds for your daily, weekly or monthly
                  expenses and Planmoni will release payments based on your schedules and ensure you
                  don&apos;t over spend.
                </Text>
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
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean, isSmallScreen: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
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
      maxHeight: 480,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 24,
    },
    title: {
      fontSize: getScaledFontSize(isSmallScreen ? 20 : 24, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    question: {
      fontSize: getScaledFontSize(isSmallScreen ? 18 : 20, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    hint: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 20,
    },
    optionCard: {
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    optionCardSelected: {
      borderColor: colors.primary,
      backgroundColor: isDark ? `${colors.primary}20` : `${colors.primary}12`,
    },
    optionText: {
      fontSize: getScaledFontSize(15, textSizeMultiplier),
      color: colors.text,
      fontWeight: '500',
    },
    optionTextSelected: {
      color: colors.primary,
      fontWeight: '600',
    },
    spacer: {
      height: 24,
    },
    primaryButton: {
      marginTop: 8,
    },
    body: {
      fontSize: getScaledFontSize(isSmallScreen ? 15 : 16, textSizeMultiplier),
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 28,
    },
    finalButtons: {
      gap: 12,
    },
    addFundsButton: {},
    doLaterButton: {
      borderColor: colors.border,
    },
  });
