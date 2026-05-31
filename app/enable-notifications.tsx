import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useHaptics } from '@/hooks/useHaptics';
import { areNotificationsEnabled, registerPushToken } from '@/lib/notifications';

export default function EnableNotificationsScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const haptics = useHaptics();
  const params = useLocalSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextRoute = useMemo(() => {
    const next = params.next as string | undefined;
    return next || '/(tabs)';
  }, [params.next]);

  useEffect(() => {
    const checkExistingConsent = async () => {
      const enabled = await areNotificationsEnabled();
      if (enabled) {
        router.replace(nextRoute as any);
      }
    };

    checkExistingConsent();
  }, [nextRoute]);

  const handleEnableNotifications = async () => {
    if (!session?.user?.id || isSubmitting) return;
    setIsSubmitting(true);
    haptics.mediumImpact();
    try {
      await registerPushToken(session.user.id, true);
    } finally {
      setIsSubmitting(false);
      router.replace(nextRoute as any);
    }
  };

  const handleSkip = () => {
    haptics.lightImpact();
    router.replace(nextRoute as any);
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Image
          source={require('@/assets/images/Notification-Design.png')}
          style={styles.illustration}
          resizeMode="contain"
        />

        <Text style={styles.title}>Stay updated on your account activities</Text>
        <Text style={styles.description}>
          Receive alerts about your account deposits, payouts, vaults and other important events.
        </Text>

        <Pressable
          style={[styles.enableButton, isSubmitting && styles.enableButtonDisabled]}
          onPress={handleEnableNotifications}
          disabled={isSubmitting}
        >
          <Text style={styles.enableButtonText}>
            {isSubmitting ? 'Please wait...' : 'Enable Notifications'}
          </Text>
        </Pressable>

        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 24,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    illustration: {
      width: '100%',
      height: '56%',
      maxHeight: 520,
      marginTop: 8,
    },
    title: {
      fontSize: 26,
      lineHeight: 34,
      fontWeight: '700',
      textAlign: 'center',
      color: colors.primary,
      marginTop: 6,
    },
    description: {
      fontSize: 17,
      lineHeight: 25,
      color: colors.text,
      textAlign: 'center',
      marginTop: 6,
      marginBottom: 12,
    },
    enableButton: {
      width: '100%',
      minHeight: 56,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    enableButtonDisabled: {
      opacity: 0.7,
    },
    enableButtonText: {
      fontSize: 22,
      fontWeight: '500',
      color: '#9FD770',
    },
    skipButton: {
      marginTop: 12,
      paddingVertical: 8,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    skipButtonText: {
      color: colors.primary,
      fontSize: 22,
      fontWeight: '600',
    },
  });
