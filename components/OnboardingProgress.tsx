import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

type OnboardingProgressProps = {
  step: number;
  totalSteps: number;
};

export default function OnboardingProgress({ step, totalSteps }: OnboardingProgressProps) {
  const { colors } = useTheme();
  
  const styles = createStyles(colors);
  
  // Calculate progress percentage
  const progressPercentage = (step / totalSteps) * 100;
  
  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill, 
            { width: `${progressPercentage}%` }
          ]} 
        />
      </View>
      <Text style={styles.stepText}>Step {step} of {totalSteps}</Text>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  stepText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});