import { Stack } from 'expo-router';

export default function CollectLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="new-link" options={{ title: 'New payment link' }} />
      <Stack.Screen name="new-invoice" options={{ title: 'New invoice' }} />
    </Stack>
  );
}
