import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function OnboardingLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="first-name" />
      <Stack.Screen name="last-name" />
      <Stack.Screen name="email" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="create-password" />
      <Stack.Screen name="confirm-password" />
      <Stack.Screen name="bvn" />
      <Stack.Screen name="app-lock" />
      <Stack.Screen name="confirm-pin" />
      <Stack.Screen name="success" />
    </Stack>
  );
}