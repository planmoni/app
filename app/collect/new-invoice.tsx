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
import { Calendar } from 'react-native-calendars';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Plus, Trash2, ChevronDown, X, Calendar as CalendarIcon } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { invokeCollectEdgeFunction } from '@/lib/collectEdge';
import {
  STRIPE_INVOICE_CURRENCIES,
  stripeCurrencyDecimals,
} from '@/lib/stripeInvoiceCurrencies';

type LineRow = { id: string; description: string; quantity: string; unitAmount: string };

function newLine(): LineRow {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, description: '', quantity: '1', unitAmount: '' };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function defaultDueDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setHours(23, 59, 59, 999);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function NewCollectInvoiceScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [dueDate, setDueDate] = useState<Date>(() => defaultDueDate());
  const [duePickerOpen, setDuePickerOpen] = useState(false);
  const [lines, setLines] = useState<LineRow[]>(() => [newLine()]);
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

  const totalMajor = useMemo(() => {
    let sum = 0;
    for (const line of lines) {
      const q = parseFloat(line.quantity.replace(/,/g, ''));
      const u = parseFloat(line.unitAmount.replace(/,/g, ''));
      if (Number.isFinite(q) && Number.isFinite(u) && q > 0 && u > 0) {
        sum += q * u;
      }
    }
    return sum;
  }, [lines]);

  const totalFormatted = useMemo(() => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency.toUpperCase(),
        maximumFractionDigits: stripeCurrencyDecimals(currency) === 0 ? 0 : 2,
      }).format(totalMajor);
    } catch {
      return `${currency.toUpperCase()} ${totalMajor.toFixed(2)}`;
    }
  }, [totalMajor, currency]);

  const updateLine = useCallback((id: string, patch: Partial<LineRow>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, newLine()]);
  }, []);

  const openDuePicker = useCallback(() => {
    setDuePickerOpen(true);
  }, []);

  const submit = async () => {
    if (!clientEmail.trim().includes('@')) {
      setError('Enter a valid client email');
      return;
    }
    const payloadLines: { description: string; quantity: number; unit_amount: number }[] = [];
    for (const line of lines) {
      const description = line.description.trim();
      const quantity = Math.floor(parseFloat(line.quantity.replace(/,/g, '')));
      const unit_amount = parseFloat(line.unitAmount.replace(/,/g, ''));
      if (!description) {
        setError('Each line needs a description');
        return;
      }
      if (!Number.isFinite(quantity) || quantity < 1) {
        setError('Each line needs a valid quantity (≥ 1)');
        return;
      }
      if (!Number.isFinite(unit_amount) || unit_amount <= 0) {
        setError('Each line needs a positive unit amount');
        return;
      }
      payloadLines.push({ description, quantity, unit_amount });
    }
    if (payloadLines.length === 0) {
      setError('Add at least one line item');
      return;
    }
    if (dueDate.getTime() < startOfToday().getTime()) {
      setError('Due date must be today or later');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await invokeCollectEdgeFunction<{ hosted_invoice_url?: string }>(
        'stripe-collect-create-invoice',
        {
          client_email: clientEmail.trim(),
          client_name: clientName.trim() || undefined,
          currency,
          due_at: dueDate.toISOString(),
          line_items: payloadLines,
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

  const border = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
  const surface = isDark ? 'rgba(255,255,255,0.06)' : '#fff';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.screenHeader}>
        <Pressable onPress={() => router.back()} style={styles.screenHeaderBack} hitSlop={8}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.screenHeaderTitle, { color: colors.text }]}>New invoice</Text>
        <View style={styles.screenHeaderSpacer} />
      </View>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Bill to</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Client email</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: border, backgroundColor: surface }]}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="client@example.com"
          placeholderTextColor={colors.textSecondary}
          value={clientEmail}
          onChangeText={setClientEmail}
        />
        <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Client name (optional)</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: border, backgroundColor: surface }]}
          placeholder="Company or contact name"
          placeholderTextColor={colors.textSecondary}
          value={clientName}
          onChangeText={setClientName}
        />

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 22 }]}>Invoice details</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Currency</Text>
        <Pressable
          onPress={() => {
            setCurrencySearch('');
            setCurrencyModalOpen(true);
          }}
          style={[styles.currencyBtn, { borderColor: border, backgroundColor: surface }]}
        >
          <Text style={[styles.currencyBtnText, { color: colors.text }]} numberOfLines={1}>
            {currencyLabel}
          </Text>
          <ChevronDown size={20} color={colors.textSecondary} />
        </Pressable>

        <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Due date</Text>
        <Pressable
          onPress={openDuePicker}
          style={[styles.currencyBtn, { borderColor: border, backgroundColor: surface }]}
        >
          <View style={{ marginRight: 10 }}>
            <CalendarIcon size={20} color={colors.textSecondary} />
          </View>
          <Text style={[styles.currencyBtnText, { color: colors.text }]} numberOfLines={1}>
            {dueDate.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          <ChevronDown size={20} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Invoice due by end of day in your timezone
        </Text>

        <View style={styles.lineHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 0 }]}>Line items</Text>
          <Pressable onPress={addLine} style={({ pressed }) => [styles.addChip, { opacity: pressed ? 0.7 : 1 }]}>
            <Plus size={18} color={colors.primary} />
            <Text style={[styles.addChipText, { color: colors.primary }]}>Add line</Text>
          </Pressable>
        </View>

        {lines.map((line, index) => (
          <View
            key={line.id}
            style={[styles.lineCard, { borderColor: border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa' }]}
          >
            <View style={styles.lineTop}>
              <Text style={[styles.lineIndex, { color: colors.textSecondary }]}>Item {index + 1}</Text>
              {lines.length > 1 ? (
                <Pressable onPress={() => removeLine(line.id)} hitSlop={8}>
                  <Trash2 size={18} color="#dc2626" />
                </Pressable>
              ) : null}
            </View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: border, backgroundColor: surface }]}
              placeholder="e.g. Design sprint, Hosting"
              placeholderTextColor={colors.textSecondary}
              value={line.description}
              onChangeText={(t) => updateLine(line.id, { description: t })}
            />
            <View style={styles.lineGrid}>
              <View style={styles.lineGridCell}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Qty</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: border, backgroundColor: surface }]}
                  keyboardType="number-pad"
                  value={line.quantity}
                  onChangeText={(t) => updateLine(line.id, { quantity: t })}
                />
              </View>
              <View style={[styles.lineGridCell, { flex: 1.4 }]}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Unit price</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: border, backgroundColor: surface }]}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  value={line.unitAmount}
                  onChangeText={(t) => updateLine(line.id, { unitAmount: t })}
                />
              </View>
            </View>
          </View>
        ))}

        <View style={[styles.totalBar, { borderColor: border, backgroundColor: surface }]}>
          <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total</Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>{totalFormatted}</Text>
        </View>

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
      </ScrollView>

      <Modal
        visible={duePickerOpen}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
        onRequestClose={() => setDuePickerOpen(false)}
      >
        <View style={[styles.modalRoot, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Due date</Text>
            <Pressable onPress={() => setDuePickerOpen(false)} hitSlop={12}>
              <Text style={{ color: colors.primary, fontSize: 17, fontWeight: '600' }}>Done</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
            showsVerticalScrollIndicator={false}
          >
            <Calendar
              current={toYmd(dueDate)}
              minDate={toYmd(startOfToday())}
              onDayPress={(day) => {
                const picked = new Date(`${day.dateString}T12:00:00`);
                setDueDate(endOfDay(picked));
                setDuePickerOpen(false);
              }}
              markedDates={{
                [toYmd(dueDate)]: {
                  selected: true,
                  selectedColor: colors.primary,
                },
              }}
              theme={{
                backgroundColor: colors.background,
                calendarBackground: colors.background,
                textSectionTitleColor: colors.textSecondary,
                monthTextColor: colors.text,
                textMonthFontWeight: '600',
                dayTextColor: colors.text,
                textDisabledColor: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)',
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: '#ffffff',
                todayTextColor: colors.primary,
                arrowColor: colors.primary,
              }}
            />
          </ScrollView>
        </View>
      </Modal>

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
            placeholder="Search code or country"
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
                style={[styles.currencyRow, item.code === currency && { backgroundColor: `${colors.primary}18` }]}
                onPress={() => {
                  setCurrency(item.code);
                  setCurrencyModalOpen(false);
                }}
              >
                <Text style={[styles.currencyRowText, { color: colors.text }]}>{item.label}</Text>
                {item.code === currency ? <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text> : null}
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 24 }}>No matches</Text>
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
  scroll: { paddingHorizontal: 20, paddingTop: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  label: { fontSize: 13, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  hint: { fontSize: 12, marginTop: 6 },
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
  lineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
  },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addChipText: { fontWeight: '600', fontSize: 15 },
  lineCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  lineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  lineIndex: { fontSize: 12, fontWeight: '600' },
  lineGrid: { flexDirection: 'row', gap: 12, marginTop: 4 },
  lineGridCell: { flex: 1 },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  totalLabel: { fontSize: 15, fontWeight: '600' },
  totalValue: { fontSize: 20, fontWeight: '700' },
  err: { color: '#dc2626', marginTop: 8, marginBottom: 8 },
  btn: { marginTop: 16, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
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
