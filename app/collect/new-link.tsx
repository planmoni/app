import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { invokeCollectEdgeFunction } from '@/lib/collectEdge';

export default function NewCollectLinkScreen() {
  const { colors, isDark } = useTheme();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const n = parseFloat(amount.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 1) {
      setError('Enter a valid USD amount (min $1)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await invokeCollectEdgeFunction<{ checkout_url?: string }>('stripe-collect-create-link', {
        amount_usd: n,
        description: description.trim() || 'Payment',
      });
      if (res.checkout_url) {
        await Linking.openURL(res.checkout_url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={[styles.label, { color: colors.textSecondary }]}>Amount (USD)</Text>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
          },
        ]}
        keyboardType="decimal-pad"
        placeholder="100"
        placeholderTextColor={colors.textSecondary}
        value={amount}
        onChangeText={setAmount}
      />
      <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Description</Text>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
          },
        ]}
        placeholder="Payment for…"
        placeholderTextColor={colors.textSecondary}
        value={description}
        onChangeText={setDescription}
      />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={() => void submit()}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Create link & pay</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  label: { fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  err: { color: '#dc2626', marginTop: 12 },
  btn: { marginTop: 28, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
