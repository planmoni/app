import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePayoutPlanShare, PlanByShareCodeResult } from '@/hooks/usePayoutPlanShare';
import { formatPayoutFrequency } from '@/lib/formatters';
import Button from '@/components/Button';
import { Calendar, ArrowRight, Wallet } from 'lucide-react-native';

const PENDING_PLAN_CODE_KEY = 'planmoni_pending_plan_share_code';

export default function PlanShareAcceptScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { colors, isDark } = useTheme();
  const { session, isLoading: authLoading } = useAuth();
  const { getPlanByShareCode, pairToPlan, isLoading: shareLoading } = usePayoutPlanShare();
  const [plan, setPlan] = useState<PlanByShareCodeResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!code || typeof code !== 'string') {
      setFetchError('Invalid link');
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await getPlanByShareCode(code);
      if (!cancelled) {
        if (result.found) setPlan(result);
        else setFetchError(result.error || 'Plan not found');
      }
    })();
    return () => { cancelled = true; };
  }, [code, getPlanByShareCode]);

  const handleAddToMyPlans = async () => {
    if (!plan?.id) return;
    const success = await pairToPlan(plan.id);
    if (success) {
      router.replace({ pathname: '/view-payout', params: { id: plan.id } });
    }
  };

  const handleViewPlan = () => {
    if (plan?.id) router.replace({ pathname: '/view-payout', params: { id: plan.id } });
  };

  const handleSignIn = () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    AsyncStorage.setItem(PENDING_PLAN_CODE_KEY, code ?? '');
    router.replace('/(auth)/login/index');
  };

  if (authLoading || (session === null && !fetchError)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session?.user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Payout plan shared with you</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Sign in or create an account to add this plan and track payouts.
            </Text>
            <Button title="Sign in" onPress={handleSignIn} style={styles.button} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (fetchError && !plan?.found) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Invalid or expired link</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{fetchError}</Text>
            <Button title="Go to Home" onPress={() => router.replace('/(tabs)')} style={styles.button} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!plan?.found) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = plan.is_owner;
  const isAlreadyPaired = plan.is_paired;
  const nextDate = plan.next_payout_date
    ? new Date(plan.next_payout_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {isOwner ? (
            <>
              <Text style={[styles.title, { color: colors.text }]}>You created this plan</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                This link is for sharing with others. Open the plan below.
              </Text>
            </>
          ) : isAlreadyPaired ? (
            <>
              <Text style={[styles.title, { color: colors.text }]}>You're already following this plan</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Open the plan below to view progress and details.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text }]}>Payout plan shared with you</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {plan.creator_first_name ?? 'Someone'} invited you to follow this plan.
              </Text>
            </>
          )}

          <View style={[styles.planBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Text style={[styles.planName, { color: colors.text }]} numberOfLines={1}>{plan.name}</Text>
            <View style={styles.planRow}>
              <Wallet size={18} color={colors.textSecondary} />
              <Text style={[styles.planDetail, { color: colors.textSecondary }]}>
                ₦{Number(plan.payout_amount ?? 0).toLocaleString()} per payout
              </Text>
            </View>
            <View style={styles.planRow}>
              <Calendar size={18} color={colors.textSecondary} />
              <Text style={[styles.planDetail, { color: colors.textSecondary }]}>
                {formatPayoutFrequency(plan.frequency ?? '')}
              </Text>
            </View>
            {nextDate && (
              <View style={styles.planRow}>
                <Calendar size={18} color={colors.textSecondary} />
                <Text style={[styles.planDetail, { color: colors.textSecondary }]}>Next: {nextDate}</Text>
              </View>
            )}
          </View>

          {isOwner || isAlreadyPaired ? (
            <Button
              title="View plan"
              onPress={handleViewPlan}
              style={styles.button}
              icon={ArrowRight}
            />
          ) : (
            <Button
              title="Add to my plans"
              onPress={handleAddToMyPlans}
              style={styles.button}
              isLoading={shareLoading}
              icon={ArrowRight}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center', minHeight: '100%' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 16, lineHeight: 22, marginBottom: 24 },
  planBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  planName: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  planDetail: { fontSize: 15 },
  button: { marginTop: 0 },
});
