import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function CreateExpensePlanLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.backgroundSecondary },
      }}
    >
      <Stack.Screen name="plan-type" />
      <Stack.Screen name="plan-name" />
      <Stack.Screen name="target-amount" />
      <Stack.Screen name="dates" />
      {/* Legacy/basic combined screen kept for backward compatibility */}
      <Stack.Screen name="basic-setup" />
      <Stack.Screen name="contribution-calculation" />
      <Stack.Screen name="funding-source" />
      <Stack.Screen name="start-action" />
      <Stack.Screen name="buckets" />
      <Stack.Screen name="review" />
      <Stack.Screen name="funding-choice" />
      <Stack.Screen name="fund-budget" />
      <Stack.Screen name="name-expense" />
      <Stack.Screen name="success" />
    </Stack>
  );
}

