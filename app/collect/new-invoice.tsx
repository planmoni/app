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

export default function NewCollectInvoiceScreen() {
  const { colors, isDark } = useTheme();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const n = parseFloat(amount.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 1) {
      setError('Enter a valid USD amount (min $1)');
      return;
    }
    if (!clientEmail.trim().includes('@')) {
      setError('Enter client email');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await invokeCollectEdgeFunction<{ hosted_invoice_url?: string }>(
        'stripe-collect-create-invoice',
        {
          amount_usd: n,
          description: description.trim() || 'Invoice',
          client_email: clientEmail.trim(),
          client_name: clientName.trim() || undefined,
        },
      );
      if (res.hosted_invoice_url) {
        await Linking.openURL(res.hosted_invoice_url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={[styles.label, { color: colors.textSecondary }]}>Client email</Text>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
          },
        ]}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="client@example.com"
        placeholderTextColor={colors.textSecondary}
        value={clientEmail}
        onChangeText={setClientEmail}
      />
      <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Client name (optional)</Text>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
          },
        ]}
        placeholder="Jane Doe"
        placeholderTextColor={colors.textSecondary}
        value={clientName}
        onChangeText={setClientName}
      />
      <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Amount (USD)</Text>
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
        placeholder="1000"
        placeholderTextColor={colors.textSecondary}
        value={amount}
        onChangeText={setAmount}
      />
      <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Description</Text>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
          },
        ]}
        placeholder="Invoice for…"
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
          <Text style={styles.btnText}>Create & send invoice</Text>
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
