import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';

const FIRST_LAUNCH_OK_KEY = 'planmoni_first_launch_ok';

export default function OtaUpdateModal() {
  const { isUpdatePending } = Updates.useUpdates();
  const { colors } = useTheme();
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
    const retry = setTimeout(() => {
      void check();
    }, 16000);

    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, [isUpdatePending]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setSnoozed(false);
    });
    return () => subscription.remove();
  }, []);

  const visible = !__DEV__ && Updates.isEnabled && isUpdatePending && firstLaunchOk && !snoozed;

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

  const styles = createStyles(colors);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setSnoozed(true)}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>App updated</Text>
          <Text style={styles.message}>Refresh to apply changes.</Text>
          <Button
            title="Refresh"
            onPress={handleRefresh}
            isLoading={refreshing}
            disabled={refreshing}
            style={styles.refreshButton}
          />
          <Pressable
            style={styles.laterButton}
            onPress={() => setSnoozed(true)}
            disabled={refreshing}
          >
            <Text style={styles.laterText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: { surface: string; text: string; textSecondary: string }) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContainer: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      alignItems: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      marginTop: 8,
      textAlign: 'center',
    },
    message: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    refreshButton: {
      width: '100%',
    },
    laterButton: {
      marginTop: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    laterText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
