import { View } from 'react-native';
import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { clearPayoutSetupDraft, savePayoutSetupDraft } from '@/lib/payout-setup-draft';

export default function CreatePayoutLayout() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const serializedParams = JSON.stringify(params);

  useEffect(() => {
    if (!pathname.startsWith('/create-payout')) return;
    if (pathname.includes('/success')) {
      void clearPayoutSetupDraft();
      return;
    }
    void savePayoutSetupDraft(
      pathname,
      params as Record<string, string | string[] | undefined>
    );
  }, [pathname, serializedParams]);

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