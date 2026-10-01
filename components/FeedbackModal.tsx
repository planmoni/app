import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Platform, Linking } from 'react-native';
import { Star, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTextSize } from '@/contexts/TextSizeContext';
import { getScaledFontSize } from '@/lib/textSize';
import { logAnalyticsEvent } from '@/lib/firebase';
import { useHaptics } from '@/hooks/useHaptics';

const iOSStoreURL = 'https://apps.apple.com/app/id6753706776?action=write-review';
const androidStoreURL = 'https://play.google.com/store/apps/details?id=com.planmoni.app';

export type FeedbackSource = 'plan_creation' | 'second_open';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called when user taps "Rate" (caller should persist "don't show again" then close) */
  onRate?: () => void;
  source?: FeedbackSource;
}

export default function FeedbackModal({ visible, onClose, onRate, source }: FeedbackModalProps) {
  const { colors, isDark } = useTheme();
  const { textSizeMultiplier } = useTextSize();
  const haptics = useHaptics();
  const styles = createStyles(colors, isDark, textSizeMultiplier);

  useEffect(() => {
    if (visible && source) {
      logAnalyticsEvent('feedback_modal_shown', { source });
    }
  }, [visible, source]);

  const handleClose = React.useCallback(() => {
    // Defer state update so the touch completes and Modal can run close animation without hanging
    requestAnimationFrame(() => {
      onClose();
    });
  }, [onClose]);

  const handleRate = () => {
    haptics.mediumImpact();
    const url = Platform.OS === 'ios' ? iOSStoreURL : Platform.OS === 'android' ? androidStoreURL : null;
    if (url) {
      Linking.openURL(url).catch((err) => console.error('Failed to open store URL:', err));
      if (source) logAnalyticsEvent('feedback_modal_rated', { source });
    }
    onRate?.();
    handleClose();
  };

  const handleMaybeLater = () => {
    haptics.lightImpact();
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.card}>
          <View style={styles.topRow}>
            <Text style={styles.kicker}>RATING</Text>
            <Pressable style={styles.closeButton} onPress={handleMaybeLater} hitSlop={12} accessibilityLabel="Close">
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.iconCircle}>
            <Star size={28} color="#FFFFFF" fill={colors.accent} />
          </View>
          <Text style={styles.eyebrow}>TELL US WHAT YOU THINK</Text>
          <Text style={styles.title}>Are you enjoying Planmoni?</Text>
          <Text style={styles.subtitle}>Rate us and let us know what you think</Text>
          <View style={styles.starsRow}>
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={28} color={colors.primary} fill={colors.accent} style={styles.starIcon} />
            ))}
          </View>
          <View style={styles.buttonsColumn}>
            {(Platform.OS === 'ios' || Platform.OS === 'android') && (
              <Pressable style={styles.primaryButton} onPress={handleRate}>
                <Text style={styles.primaryButtonText}>
                  {Platform.OS === 'ios' ? 'Rate on App Store' : 'Rate on Play Store'}
                </Text>
              </Pressable>
            )}
            <Pressable style={styles.secondaryButton} onPress={handleMaybeLater}>
              <Text style={styles.secondaryButtonText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
      justifyContent: 'flex-end',
      paddingHorizontal: 12,
      paddingBottom: 16,
    },
    card: {
      width: '100%',
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      borderRadius: 28,
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
    title: {
      fontSize: getScaledFontSize(26, textSizeMultiplier),
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: getScaledFontSize(14, textSizeMultiplier),
      color: colors.textSecondary,
      marginBottom: 16,
      textAlign: 'center',
    },
    starsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      gap: 2,
    },
    starIcon: {
      marginHorizontal: 2,
    },
    buttonsColumn: {
      width: '100%',
      gap: 12,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: getScaledFontSize(15, textSizeMultiplier),
    },
    secondaryButton: {
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontWeight: '500',
      fontSize: getScaledFontSize(14, textSizeMultiplier),
    },
  });
