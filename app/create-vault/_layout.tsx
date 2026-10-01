import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { clearVaultSetupDraft, saveVaultSetupDraft } from '@/lib/vault-setup-draft';

export default function CreateExpensePlanLayout() {
  const { colors, isDark } = useTheme();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const serializedParams = JSON.stringify(params);
  const sheetBackground = isDark ? colors.backgroundSecondary : colors.background;

  useEffect(() => {
    if (!pathname.startsWith('/create-vault')) return;
    if (
      pathname.includes('/success') ||
      pathname.includes('/fund-plan') ||
      pathname.includes('/fund-amount')
    ) {
      void clearVaultSetupDraft();
      return;
    }
    void saveVaultSetupDraft(
      pathname,
      params as Record<string, string | string[] | undefined>
    );
  }, [pathname, serializedParams]);

  return (
    <View style={{ flex: 1, backgroundColor: sheetBackground }}>
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { flex: 1, backgroundColor: sheetBackground },
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

