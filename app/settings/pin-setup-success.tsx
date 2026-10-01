import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

export default function PinSetupSuccess() {
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/settings/security-center');
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <View style={[styles.icon, { backgroundColor: colors.accent }]}>
          <Check size={36} color={colors.primary} strokeWidth={2.5} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>App PIN is ready</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          You’ll use this PIN to unlock Planmoni and protect your account.
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          Returning to Security Center…
        </Text>
      </View>

      <Pressable
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={() => router.replace('/settings/security-center')}
      >
        <Text style={styles.buttonText}>Done</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  hint: {
    marginTop: 20,
    fontSize: 13,
  },
  button: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
