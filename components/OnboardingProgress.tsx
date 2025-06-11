import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

type OnboardingProgressProps = {
  currentStep: number;
  totalSteps: number;
};

export default function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  const { colors } = useTheme();
  
  const progress = (currentStep / totalSteps) * 100;
  
  const styles = createStyles(colors);
  
  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill,
            { width: `${progress}%` }
          ]}
        />
      </View>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
});