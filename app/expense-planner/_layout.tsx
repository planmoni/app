import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function ExpensePlannerLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.backgroundSecondary },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="log-expense" />
    </Stack>
  );
}

