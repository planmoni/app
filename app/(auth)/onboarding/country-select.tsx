import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useState, useCallback, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import FloatingButton from '@/components/FloatingButton';
import { useHaptics } from '@/hooks/useHaptics';

type CountryOption = {
  code: string;
  name: string;
  flag: string;
  /** Only countries where we operate can be selected */
  available: boolean;
};

const COUNTRIES: CountryOption[] = [
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', available: true },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', available: false },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', available: false },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', available: false },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', available: false },
  { code: 'US', name: 'United States', flag: '🇺🇸', available: false },
];

export default function CountrySelectScreen() {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<CountryOption>(
    () => COUNTRIES.find((c) => c.available) ?? COUNTRIES[0],
  );

  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleSelectCountry = useCallback(
    (country: CountryOption) => {
      if (!country.available) {
        haptics.warning();
        return;
      }
      haptics.selection();
      setSelected(country);
      setPickerOpen(false);
    },
    [haptics],
  );

  const handleContinue = () => {
    if (!selected.available) return;
    haptics.mediumImpact();
    router.push('/(auth)/onboarding/first-name');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push('/login')} style={styles.signInButton}>
          <Text style={styles.signInText}>Sign in instead</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>Where are you from?</Text>
        <Text style={styles.subtitle}>
          Select your country to continue.
        </Text>

        <Text style={styles.fieldLabel}>Country</Text>
        <Pressable
          style={styles.dropdown}
          onPress={() => {
            haptics.selection();
            setPickerOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Choose country"
        >
          <Text style={styles.flag}>{selected.flag}</Text>
          <Text style={styles.dropdownValue} numberOfLines={1}>
            {selected.name}
          </Text>
          <ChevronDown size={22} color={colors.textSecondary} style={styles.chevron} />
        </Pressable>
      </View>

      <FloatingButton
        title="Continue"
        onPress={handleContinue}
        disabled={!selected.available}
      />

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPickerOpen(false)}
            accessibilityLabel="Dismiss"
          />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select country</Text>
              <ScrollView
                style={styles.modalList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {COUNTRIES.map((country) => {
                  const isSelected = country.code === selected.code;
                  const disabled = !country.available;
                  return (
                    <Pressable
                      key={country.code}
                      style={({ pressed }) => [
                        styles.countryRow,
                        disabled && styles.countryRowDisabled,
                        pressed && !disabled && styles.countryRowPressed,
                      ]}
                      onPress={() => handleSelectCountry(country)}
                      accessibilityState={{ disabled, selected: isSelected }}
                    >
                      <Text style={[styles.rowFlag, disabled && styles.mutedText]}>{country.flag}</Text>
                      <Text
                        style={[styles.rowName, disabled && styles.mutedText]}
                        numberOfLines={1}
                      >
                        {country.name}
                      </Text>
                      {!disabled && isSelected ? (
                        <Check size={20} color={colors.primary} style={styles.rowCheck} />
                      ) : null}
                      {disabled ? (
                        <Text style={styles.comingSoon}>Coming soon</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable style={styles.modalClose} onPress={() => setPickerOpen(false)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
    },
    signInButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: colors.backgroundTertiary,
    },
    signInText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    body: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'left',
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 32,
    },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 10,
    },
    dropdown: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.accent || colors.primary,
      borderRadius: 12,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      minHeight: 56,
    },
    flag: {
      fontSize: 28,
      marginRight: 12,
    },
    dropdownValue: {
      flex: 1,
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    chevron: {
      marginLeft: 8,
    },
    modalRoot: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    modalCenter: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    modalCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      paddingVertical: 16,
      maxHeight: '72%',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 16,
        },
        android: { elevation: 8 },
      }),
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      paddingHorizontal: 20,
      marginBottom: 8,
    },
    modalList: {
      maxHeight: 320,
    },
    countryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    countryRowPressed: {
      backgroundColor: colors.backgroundTertiary,
    },
    countryRowDisabled: {
      opacity: 0.42,
    },
    rowFlag: {
      fontSize: 26,
      marginRight: 12,
    },
    rowName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    mutedText: {
      color: colors.textTertiary,
    },
    rowCheck: {
      marginLeft: 8,
    },
    comingSoon: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textTertiary,
      marginLeft: 8,
    },
    modalClose: {
      marginTop: 4,
      paddingVertical: 14,
      alignItems: 'center',
    },
    modalCloseText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
  });
