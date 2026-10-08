import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function Tier3KYCLayout() {
  const { colors, isDark } = useTheme();
  const sheetBackground = isDark ? colors.backgroundSecondary : colors.background;

  return (
    <View style={{ flex: 1, backgroundColor: sheetBackground }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { flex: 1, backgroundColor: sheetBackground },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="success"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
      </Stack>
    </View>
  );
}
