import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function CreateExpensePlanLayout() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundSecondary }}>
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { flex: 1, backgroundColor: colors.backgroundSecondary },
      }}
    >
      <Stack.Screen name="plan-details" />
      <Stack.Screen name="plan-name" />
      <Stack.Screen name="target-amount" />
      <Stack.Screen name="dates" />
      {/* Legacy/basic combined screen kept for backward compatibility */}
      <Stack.Screen name="basic-setup" />
      <Stack.Screen name="funding-source" />
      <Stack.Screen name="auto-topup-config" />
      <Stack.Screen name="start-action" />
      <Stack.Screen name="buckets" />
      <Stack.Screen name="review" />
      <Stack.Screen name="funding-choice" />
      <Stack.Screen name="fund-budget" />
      <Stack.Screen name="name-expense" />
      <Stack.Screen name="success" />
    </Stack>
    </View>
  );
}

