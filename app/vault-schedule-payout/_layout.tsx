import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function VaultSchedulePayoutLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.backgroundSecondary },
      }}
    >
      <Stack.Screen name="amount" />
      <Stack.Screen name="destination" />
      <Stack.Screen name="review" />
      <Stack.Screen name="success" />
    </Stack>
  );
}
