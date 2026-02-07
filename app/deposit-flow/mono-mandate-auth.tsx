/**
 * Mandate authorization screen – open Mono URL so user can authorize withdrawals.
 * Shown after linking a bank account so they can add funds anytime without logging in again.
 */

import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import Button from '@/components/Button';

export default function MonoMandateAuthScreen() {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const params = useLocalSearchParams<{ monoUrl: string; bankName?: string }>();
  const monoUrl = params.monoUrl ?? '';
  const bankName = params.bankName ?? 'your bank';
  const [loading, setLoading] = useState(true);

  const handleBack = () => {
    haptics.lightImpact();
    router.back();
  };

  const handleDone = () => {
    haptics.mediumImpact();
    router.back();
  };

  const styles = createStyles(colors);

  if (!monoUrl) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Authorize account</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Missing authorization link. Please try linking again.</Text>
          <Button title="Go back" onPress={handleBack} style={styles.button} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Authorize withdrawals</Text>
      </View>
      <View style={styles.instruction}>
        <Text style={styles.instructionText}>
          Complete the authorization in the screen below. When done, tap "I've finished" to continue.
        </Text>
      </View>
      <View style={styles.webViewContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
        <WebView
          source={{ uri: monoUrl }}
          style={styles.webView}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => setLoading(false)}
        />
      </View>
      <View style={styles.footer}>
        <Button
          title="I've finished authorizing"
          onPress={handleDone}
          style={styles.doneButton}
          icon={Check}
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    instruction: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.accentBackground,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    instructionText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    webViewContainer: {
      flex: 1,
      position: 'relative',
    },
    webView: {
      flex: 1,
      backgroundColor: colors.backgroundSecondary,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    footer: {
      padding: 16,
      paddingBottom: 24,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    doneButton: {
      width: '100%',
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    button: {
      minWidth: 160,
    },
  });
