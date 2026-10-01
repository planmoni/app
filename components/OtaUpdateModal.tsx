import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { RefreshCw, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';

const FIRST_LAUNCH_OK_KEY = 'planmoni_first_launch_ok';

export default function OtaUpdateModal() {
  const { isUpdatePending } = Updates.useUpdates();
  const { colors, isDark } = useTheme();
  const [firstLaunchOk, setFirstLaunchOk] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled || !isUpdatePending) {
      setFirstLaunchOk(false);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const value = await AsyncStorage.getItem(FIRST_LAUNCH_OK_KEY);
        if (!cancelled) setFirstLaunchOk(value === '1');
      } catch {
        if (!cancelled) setFirstLaunchOk(false);
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [isUpdatePending]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setSnoozed(false);
    });
    return () => subscription.remove();
  }, []);

  const visible = !__DEV__ && Updates.isEnabled && isUpdatePending && firstLaunchOk && !snoozed;
  const dismiss = () => setSnoozed(true);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.warn('Failed to apply OTA update:', error);
      setRefreshing(false);
    }
  };

  const styles = createStyles(colors, isDark);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        <View style={styles.sheet}>
          <View style={styles.topRow}>
            <Text style={styles.kicker}>UPDATE</Text>
            <Pressable onPress={dismiss} style={styles.closeButton} hitSlop={8}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.iconCircle}>
            <RefreshCw size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.eyebrow}>APP UPDATED</Text>
          <Text style={styles.headline}>Refresh to apply changes</Text>
          <Text style={styles.body}>A new version of Planmoni is ready. Refresh to start using it.</Text>
          <Button title="Refresh" onPress={handleRefresh} isLoading={refreshing} disabled={refreshing} style={styles.button} />
          <Pressable onPress={dismiss} style={styles.laterButton} disabled={refreshing}>
            <Text style={styles.laterText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (
  colors: { surface: string; text: string; textSecondary: string; primary: string; backgroundTertiary: string },
  isDark: boolean
) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
    },
    sheet: {
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 24,
      paddingTop: 18,
      paddingBottom: 28,
      alignItems: 'center',
    },
    topRow: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 28,
      marginBottom: 12,
    },
    kicker: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.4,
      color: colors.textSecondary,
    },
    closeButton: {
      position: 'absolute',
      right: 0,
      top: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.backgroundTertiary,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.2,
      marginBottom: 8,
    },
    headline: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 8,
    },
    body: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: 20,
    },
    button: {
      width: '100%',
      borderRadius: 16,
    },
    laterButton: {
      paddingVertical: 14,
    },
    laterText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
