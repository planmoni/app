import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { Bell, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/Button';

const BULLETS = [
  'Know instantly when you get paid or send money',
  'Get alerted about important account activity',
  'You’re in control — change this anytime in Settings',
];

type NotificationPrePromptModalProps = {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
  enabling?: boolean;
};

export default function NotificationPrePromptModal({
  visible,
  onEnable,
  onDismiss,
  enabling = false,
}: NotificationPrePromptModalProps) {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View style={styles.sheet}>
          <View style={styles.topRow}>
            <Text style={styles.kicker}>NOTIFICATIONS</Text>
            <Pressable
              onPress={onDismiss}
              hitSlop={8}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.iconWrap}>
            <View style={styles.iconRing} />
            <View style={styles.iconCircle}>
              <Bell size={28} color="#FFFFFF" />
            </View>
            <View style={styles.iconDot} />
          </View>

          <Text style={styles.eyebrow}>STAY IN THE LOOP</Text>
          <Text style={styles.headline}>Never miss a payout</Text>
          <Text style={styles.body}>
            Planmoni can alert you when money moves — so you’re never left guessing.
          </Text>

          <View style={styles.bullets}>
            {BULLETS.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>

          <Button
            title="Enable notifications"
            onPress={onEnable}
            isLoading={enabling}
            disabled={enabling}
            style={styles.enableButton}
          />
          <Pressable onPress={onDismiss} style={styles.laterButton} disabled={enabling}>
            <Text style={styles.laterText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (
  colors: { surface: string; text: string; textSecondary: string; primary: string; accent: string; backgroundTertiary: string },
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
    },
    topRow: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 28,
      marginBottom: 8,
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
    iconWrap: {
      alignSelf: 'center',
      width: 88,
      height: 88,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      marginBottom: 18,
    },
    iconRing: {
      position: 'absolute',
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: isDark ? 'rgba(195,245,126,0.16)' : 'rgba(30,58,138,0.08)',
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconDot: {
      position: 'absolute',
      top: 10,
      right: 14,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.accent,
      borderWidth: 2,
      borderColor: isDark ? colors.surface : '#FFFFFF',
    },
    eyebrow: {
      textAlign: 'center',
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1.2,
      marginBottom: 8,
    },
    headline: {
      textAlign: 'center',
      color: colors.text,
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginBottom: 10,
    },
    body: {
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 18,
    },
    bullets: {
      gap: 12,
      marginBottom: 22,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    bullet: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginTop: 7,
      backgroundColor: colors.primary,
    },
    bulletText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 21,
      color: colors.text,
    },
    enableButton: {
      width: '100%',
      borderRadius: 16,
    },
    laterButton: {
      alignItems: 'center',
      paddingVertical: 14,
    },
    laterText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
