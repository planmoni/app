import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function ExpensePlanDetailLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.backgroundSecondary },
        presentation: 'card',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="withdraw" />
      <Stack.Screen name="schedule-withdrawal" />
    </Stack>
  );
}

