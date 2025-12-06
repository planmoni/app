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
      <Stack.Screen name="plan-details" />
      <Stack.Screen name="buckets" />
      <Stack.Screen name="review" />
      <Stack.Screen name="dates" />
    </Stack>
  );
}

