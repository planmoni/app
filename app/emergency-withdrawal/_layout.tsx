import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function EmergencyWithdrawalLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.backgroundSecondary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="confirmation" />
    </Stack>
  );
}