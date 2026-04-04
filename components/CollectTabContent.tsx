import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link2, FileText, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { CollectDataSnapshot } from '@/hooks/useCollectData';

type CollectTabContentProps = {
  screenWidth: number;
  styles: any;
  colors: any;
  router: any;
  formatBalance: (amount: number) => string;
  collect: CollectDataSnapshot;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
  onRequireAuth?: () => boolean;
};

function formatUsd(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function CollectTabContent({
  screenWidth,
  styles: tabStyles,
  colors,
  router,
  formatBalance,
  collect,
  isRefreshing,
  onRefresh,
  onRequireAuth,
}: CollectTabContentProps) {
  const { isDark } = useTheme();
  const haptics = useHaptics();
  const { summary, settlements, links, invoices, fxRate, refresh, loading } = collect;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const activeLinks = links.filter((l) => l.status === 'active' || l.status === 'pending');
  const openInvoices = invoices.filter((i) => i.status === 'open' || i.status === 'draft');
  const recentSettlements = settlements.slice(0, 6);

  const onNewLink = () => {
    if (onRequireAuth && !onRequireAuth()) return;
    haptics.impact();
    router.push('/collect/new-link');
  };

  const onNewInvoice = () => {
    if (onRequireAuth && !onRequireAuth()) return;
    haptics.impact();
    router.push('/collect/new-invoice');
  };

  const localStyles = StyleSheet.create({
    card: {
      borderRadius: 16,
      padding: 20,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
    },
    cardTitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginBottom: 8 },
    ngnAmt: { color: '#fff', fontSize: 28, fontWeight: '700' },
    usdAmt: { color: 'rgba(255,255,255,0.9)', fontSize: 16, marginTop: 4 },
    rateHint: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 8, alignSelf: 'flex-end' },
    rowBtn: { flexDirection: 'row', gap: 12, marginTop: 18 },
    outlineBtn: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.9)',
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    solidBtn: {
      flex: 1,
      backgroundColor: '#fff',
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    outlineBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    solidBtnText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
    sectionHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginTop: 20,
      marginBottom: 8,
    },
    sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
    seeAll: { fontSize: 14, color: colors.primary, fontWeight: '500' },
    miniCard: {
      width: 260,
      padding: 14,
      borderRadius: 14,
      marginRight: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: 'rgba(34,197,94,0.2)',
    },
    badgeText: { fontSize: 11, color: '#16a34a', fontWeight: '600' },
    hint: { paddingHorizontal: 16, color: colors.textSecondary, fontSize: 13, marginBottom: 8 },
  });

  return (
    <View style={[tabStyles.tabPage, { width: screenWidth }]}>
      <ScrollView
        style={tabStyles.tabScrollView}
        contentContainerStyle={tabStyles.tabScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing || loading} onRefresh={() => void onRefresh()} />
        }
      >
        <LinearGradient
          colors={[colors.primary, '#1e3a5f']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={localStyles.card}
        >
          <Text style={localStyles.cardTitle}>All payments (Collect)</Text>
          <Text style={localStyles.ngnAmt}>{formatBalance(summary.totalNgn)}</Text>
          <Text style={localStyles.usdAmt}>{formatUsd(summary.totalUsd)}</Text>
          {fxRate != null && (
            <Text style={localStyles.rateHint}>
              $1/₦{fxRate.toLocaleString('en-NG', { maximumFractionDigits: 2 })} (reference rate)
            </Text>
          )}
          <View style={localStyles.rowBtn}>
            <Pressable style={localStyles.outlineBtn} onPress={onNewLink}>
              <Text style={localStyles.outlineBtnText}>Link</Text>
            </Pressable>
            <Pressable style={localStyles.solidBtn} onPress={onNewInvoice}>
              <Text style={localStyles.solidBtnText}>New Invoice</Text>
            </Pressable>
          </View>
        </LinearGradient>

        <View style={localStyles.sectionHead}>
          <Text style={localStyles.sectionTitle}>Recent</Text>
        </View>
        {recentSettlements.length === 0 ? (
          <Text style={localStyles.hint}>No Collect payments yet. Share a link or send an invoice.</Text>
        ) : (
          recentSettlements.map((s) => (
            <View
              key={s.id}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
                {formatBalance(s.ngn_credited)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                {formatUsd(s.usd_gross)} · {new Date(s.created_at).toLocaleString()}
              </Text>
            </View>
          ))
        )}

        <View style={localStyles.sectionHead}>
          <Text style={localStyles.sectionTitle}>Active Links</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16, paddingBottom: 8 }}>
          {activeLinks.length === 0 ? (
            <Text style={[localStyles.hint, { marginLeft: 0 }]}>No active payment links.</Text>
          ) : (
            activeLinks.map((l) => (
              <View key={l.id} style={localStyles.miniCard}>
                <View style={localStyles.badge}>
                  <Text style={localStyles.badgeText}>{l.status}</Text>
                </View>
                <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={2}>
                  {l.description || 'Payment link'}
                </Text>
                <Text style={{ color: colors.primary, marginTop: 8, fontSize: 18, fontWeight: '700' }}>
                  {formatUsd(l.amount_usd)}
                </Text>
                {l.checkout_url ? (
                  <Pressable
                    onPress={async () => {
                      haptics.selection();
                      const ok = await Linking.canOpenURL(l.checkout_url!);
                      if (ok) await Linking.openURL(l.checkout_url!);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}
                  >
                    <Link2 size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, marginLeft: 6, fontWeight: '500' }}>Open link</Text>
                    <ChevronRight size={16} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>

        <View style={localStyles.sectionHead}>
          <Text style={localStyles.sectionTitle}>Your invoices</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16, paddingBottom: 24 }}>
          {openInvoices.length === 0 && invoices.filter((i) => i.status === 'paid').length === 0 ? (
            <Text style={[localStyles.hint, { marginLeft: 0 }]}>No invoices yet.</Text>
          ) : (
            [...openInvoices, ...invoices.filter((i) => i.status === 'paid').slice(0, 5)].map((inv) => (
              <View key={inv.id} style={localStyles.miniCard}>
                <View style={[localStyles.badge, { backgroundColor: 'rgba(100,100,100,0.15)' }]}>
                  <Text style={[localStyles.badgeText, { color: colors.textSecondary }]}>{inv.status}</Text>
                </View>
                <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={2}>
                  {inv.description}
                </Text>
                <Text style={{ color: colors.primary, marginTop: 8, fontSize: 18, fontWeight: '700' }}>
                  {formatUsd(inv.amount_usd)}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>{inv.client_email}</Text>
                {inv.hosted_invoice_url ? (
                  <Pressable
                    onPress={async () => {
                      haptics.selection();
                      const ok = await Linking.canOpenURL(inv.hosted_invoice_url!);
                      if (ok) await Linking.openURL(inv.hosted_invoice_url!);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}
                  >
                    <FileText size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, marginLeft: 6, fontWeight: '500' }}>View</Text>
                    <ChevronRight size={16} color={colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>

        <View style={tabStyles.bottomPadding} />
      </ScrollView>
    </View>
  );
}
