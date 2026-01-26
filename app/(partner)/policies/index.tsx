/**
 * Partner Policies Management
 * 
 * View and manage wallet policies.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { Shield, Plus, Edit } from 'lucide-react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabase = createClient<Database>(supabaseUrl);

export default function PartnerPolicies() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPolicies();
  }, [session]);

  const loadPolicies = async () => {
    if (!session?.user?.id) return;

    try {
      const { data: partnerUser } = await supabase
        .from('partner_users')
        .select('partner_id')
        .eq('user_id', session.user.id)
        .single();

      if (!partnerUser) return;

      const { data: policiesData, error } = await supabase
        .from('wallet_policies')
        .select('*')
        .eq('partner_id', partnerUser.partner_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPolicies(policiesData || []);
    } catch (error) {
      console.error('Error loading policies:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPolicies();
  };

  const styles = createStyles(colors, isDark);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Policies</Text>
        <Pressable
          style={styles.createButton}
          onPress={() => {
            router.push('/(partner)/policies/create');
          }}
        >
          <Plus size={20} color="#fff" />
          <Text style={styles.createButtonText}>Create Policy</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {policies.length === 0 ? (
          <View style={styles.emptyState}>
            <Shield size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No policies yet</Text>
            <Text style={styles.emptySubtext}>Create your first wallet policy</Text>
          </View>
        ) : (
          policies.map((policy) => (
            <Pressable
              key={policy.id}
              style={styles.policyCard}
              onPress={() => {
                router.push(`/(partner)/policies/${policy.id}`);
              }}
            >
              <View style={styles.policyHeader}>
                <View style={styles.policyIcon}>
                  <Shield size={24} color={colors.primary} />
                </View>
                <View style={styles.policyInfo}>
                  <Text style={styles.policyName}>{policy.name}</Text>
                  {policy.description && (
                    <Text style={styles.policyDescription}>{policy.description}</Text>
                  )}
                </View>
                {policy.is_default && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultText}>Default</Text>
                  </View>
                )}
                <Edit size={20} color={colors.textSecondary} />
              </View>

              <View style={styles.policyRules}>
                <Text style={styles.rulesLabel}>
                  {Array.isArray(policy.policy_rules?.rules)
                    ? `${policy.policy_rules.rules.length} Rules`
                    : 'No rules'}
                </Text>
              </View>
            </Pressable>
          ))
        )}
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
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      gap: 8,
    },
    createButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
    scrollView: {
      flex: 1,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
    },
    policyCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      margin: 16,
      marginBottom: 0,
      borderWidth: 1,
      borderColor: colors.border,
    },
    policyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    policyIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    policyInfo: {
      flex: 1,
    },
    policyName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    policyDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    defaultBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.primary + '20',
      borderRadius: 4,
      marginRight: 8,
    },
    defaultText: {
      fontSize: 10,
      color: colors.primary,
      fontWeight: '600',
    },
    policyRules: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    rulesLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  });
}
