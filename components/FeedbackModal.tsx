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
  source?: FeedbackSource;
}

export default function FeedbackModal({ visible, onClose, source }: FeedbackModalProps) {
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
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Pressable style={styles.closeButton} onPress={handleMaybeLater} hitSlop={12}>
            <X size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.title}>Are you enjoying Planmoni?</Text>
          <Text style={styles.subtitle}>Rate us and let us know what you think</Text>
          <View style={styles.starsRow}>
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={28} color={colors.text} fill={colors.backgroundTertiary} style={styles.starIcon} />
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
              <Text style={styles.secondaryButtonText}>Maybe later</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean, textSizeMultiplier: number) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: Platform.OS === 'ios' ? 28 : 24,
      borderWidth: 0.5,
      borderColor: colors.border,
      alignItems: 'center',
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      padding: 4,
    },
    title: {
      fontSize: getScaledFontSize(18, textSizeMultiplier),
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
      textAlign: 'center',
      paddingHorizontal: 8,
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
      paddingVertical: 14,
      borderRadius: 20,
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
