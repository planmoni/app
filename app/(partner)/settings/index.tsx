/**
 * Partner Settings
 * 
 * Manage partner settings, API keys, webhooks, and team members.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { Settings, Key, Webhook, Users } from 'lucide-react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabase = createClient<Database>(supabaseUrl);

export default function PartnerSettings() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const [partner, setPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPartner();
  }, [session]);

  const loadPartner = async () => {
    if (!session?.user?.id) return;

    try {
      const { data: partnerUser } = await supabase
        .from('partner_users')
        .select('*, partners(*)')
        .eq('user_id', session.user.id)
        .single();

      if (partnerUser?.partners) {
        setPartner(partnerUser.partners);
      }
    } catch (error) {
      console.error('Error loading partner:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPartner();
  };

  const styles = createStyles(colors, isDark);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ color: colors.text }}>Loading settings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Partner Info */}
        {partner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Partner Information</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{partner.name}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Type</Text>
              <Text style={styles.infoValue}>{partner.partner_type}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>{partner.status}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Subscription Tier</Text>
              <Text style={styles.infoValue}>{partner.subscription_tier}</Text>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <Pressable
            style={styles.actionCard}
            onPress={() => {
              router.push('/(partner)/settings/api-keys');
            }}
          >
            <Key size={24} color={colors.primary} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>API Keys</Text>
              <Text style={styles.actionSubtitle}>Manage your API keys</Text>
            </View>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => {
              router.push('/(partner)/settings/webhooks');
            }}
          >
            <Webhook size={24} color={colors.primary} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Webhooks</Text>
              <Text style={styles.actionSubtitle}>Configure webhook endpoints</Text>
            </View>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => {
              router.push('/(partner)/settings/team');
            }}
          >
            <Users size={24} color={colors.primary} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Team Members</Text>
              <Text style={styles.actionSubtitle}>Manage team access</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    infoValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      textTransform: 'capitalize',
    },
    actionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionContent: {
      flex: 1,
      marginLeft: 12,
    },
    actionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    actionSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
  });
}
