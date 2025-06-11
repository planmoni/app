import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}