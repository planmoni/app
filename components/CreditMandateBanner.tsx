import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ShieldCheck, AlertTriangle, ExternalLink, Clock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';

export default function CreditMandateBanner() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.banner}>
      <View style={styles.row}>
        <ShieldCheck size={18} color={colors.text} />
        <Text style={styles.title}>Mandate required for credit</Text>
      </View>
      <View style={styles.row}>
        <AlertTriangle size={16} color="#f59e0b" />
        <Text style={styles.text}>BVN-based: can debit any linked account after authorization.</Text>
      </View>
      <View style={styles.row}>
        <Clock size={16} color={colors.textSecondary} />
        <Text style={styles.text}>E-mandate may need ₦50 funding and ~24h to be ready-to-debit.</Text>
      </View>
      <Pressable style={styles.linkRow} onPress={() => router.push('/linked-accounts')}>
        <ExternalLink size={16} color={colors.primary} />
        <Text style={styles.linkText}>Manage mandate</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    banner: {
      backgroundColor: colors.accentBackground,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.primary,
      gap: 8,
    },
    row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    title: { fontSize: 14, fontWeight: '700', color: colors.text },
    text: { flex: 1, fontSize: 13, color: colors.text },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    linkText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  });
