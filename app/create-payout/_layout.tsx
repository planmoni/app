import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function CreatePayoutLayout() {
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
      <Stack.Screen name="amount" />
      <Stack.Screen name="frequency-selection" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="destination" />
      <Stack.Screen name="review" />
      <Stack.Screen name="success" />
    </Stack>
    </View>
  );
}