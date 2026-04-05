import React, { useCallback, useMemo, useState } from 'react';
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
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, ChevronDown, Link2, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { invokeCollectEdgeFunction } from '@/lib/collectEdge';
import {
  STRIPE_INVOICE_CURRENCIES,
  stripeCurrencyDecimals,
} from '@/lib/stripeInvoiceCurrencies';

export default function NewCollectLinkScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');

  const currencyLabel = useMemo(() => {
    const found = STRIPE_INVOICE_CURRENCIES.find((c) => c.code === currency);
    return found?.label ?? currency.toUpperCase();
  }, [currency]);

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toLowerCase();
    if (!q) return STRIPE_INVOICE_CURRENCIES;
    return STRIPE_INVOICE_CURRENCIES.filter(
      (c) => c.code.includes(q) || c.label.toLowerCase().includes(q),
    );
  }, [currencySearch]);

  const amountPreview = useMemo(() => {
    const n = parseFloat(amount.replace(/,/g, ''));
    if (!Number.isFinite(n) || n <= 0) return null;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency.toUpperCase(),
        maximumFractionDigits: stripeCurrencyDecimals(currency) === 0 ? 0 : 2,
      }).format(n);
    } catch {
      return `${currency.toUpperCase()} ${n}`;
    }
  }, [amount, currency]);

  const submit = async () => {
    const raw = parseFloat(amount.replace(/,/g, ''));
    const dec = stripeCurrencyDecimals(currency);
    if (!Number.isFinite(raw) || raw <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (dec === 0 && !Number.isInteger(raw)) {
      setError('Use whole numbers for this currency (e.g. 1000 JPY)');
      return;
    }
    if (raw < 1) {
      setError('Minimum amount is 1 in the selected currency');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await invokeCollectEdgeFunction<{ checkout_url?: string }>('stripe-collect-create-link', {
        amount_usd: raw,
        currency,
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

  const border = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
  const surface = isDark ? 'rgba(255,255,255,0.06)' : '#fff';

  const openCurrencyModal = useCallback(() => {
    setCurrencySearch('');
    setCurrencyModalOpen(true);
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.screenHeader}>
        <Pressable onPress={() => router.back()} style={styles.screenHeaderBack} hitSlop={8}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.screenHeaderTitle, { color: colors.text }]}>New payment link</Text>
        <View style={styles.screenHeaderSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingBottom: 28 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={[colors.primary, '#1e3a5f']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroIconWrap}>
              <Link2 size={28} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>One-time payment link</Text>
            <Text style={styles.heroSubtitle}>
              Customers pay in the currency you choose. You’ll receive settlement in your wallet as usual.
            </Text>
          </LinearGradient>

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Payment</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Currency</Text>
          <Pressable
            onPress={openCurrencyModal}
            style={[styles.currencyBtn, { borderColor: border, backgroundColor: surface }]}
          >
            <Text style={[styles.currencyBtnText, { color: colors.text }]} numberOfLines={1}>
              {currencyLabel}
            </Text>
            <ChevronDown size={20} color={colors.textSecondary} />
          </Pressable>

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>Amount</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: border,
                backgroundColor: surface,
                fontSize: 22,
                fontWeight: '700',
              },
            ]}
            keyboardType="decimal-pad"
            placeholder={stripeCurrencyDecimals(currency) === 0 ? '1000' : '99.00'}
            placeholderTextColor={colors.textSecondary}
            value={amount}
            onChangeText={setAmount}
          />
          {amountPreview ? (
            <Text style={[styles.preview, { color: colors.textSecondary }]}>≈ {amountPreview}</Text>
          ) : null}

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Description</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: border, backgroundColor: surface }]}
            placeholder="What is this payment for?"
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Shown on the checkout page and your Collect list.
          </Text>

          {error ? <Text style={styles.err}>{error}</Text> : null}

          <Pressable
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={() => void submit()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Create link & open checkout</Text>
            )}
          </Pressable>
        </ScrollView>

        <Modal visible={currencyModalOpen} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modalRoot, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Currency</Text>
              <Pressable onPress={() => setCurrencyModalOpen(false)} hitSlop={12}>
                <X size={24} color={colors.text} />
              </Pressable>
            </View>
            <TextInput
              style={[styles.search, { color: colors.text, borderColor: border, backgroundColor: surface }]}
              placeholder="Search code or name"
              placeholderTextColor={colors.textSecondary}
              value={currencySearch}
              onChangeText={setCurrencySearch}
              autoCapitalize="none"
            />
            <FlatList
              style={{ flex: 1 }}
              data={filteredCurrencies}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.currencyRow,
                    item.code === currency && { backgroundColor: `${colors.primary}18` },
                  ]}
                  onPress={() => {
                    setCurrency(item.code);
                    setCurrencyModalOpen(false);
                  }}
                >
                  <Text style={[styles.currencyRowText, { color: colors.text }]}>{item.label}</Text>
                  {item.code === currency ? (
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text>
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 24 }}>
                  No matches
                </Text>
              }
            />
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  screenHeaderBack: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
  },
  screenHeaderSpacer: { width: 40 },
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  hero: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 22,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  label: { fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  preview: { fontSize: 14, marginTop: 8, fontWeight: '500' },
  hint: { fontSize: 12, marginTop: 8 },
  currencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  currencyBtnText: { fontSize: 16, flex: 1, marginRight: 8 },
  err: { color: '#dc2626', marginTop: 12, marginBottom: 4 },
  btn: { marginTop: 22, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalRoot: { flex: 1, paddingHorizontal: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  currencyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  currencyRowText: { fontSize: 16, flex: 1 },
});
