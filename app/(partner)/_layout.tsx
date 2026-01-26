/**
 * Partner Dashboard Layout
 * 
 * Layout for partner dashboard with navigation and context.
 */

import { Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabase = createClient<Database>(supabaseUrl);

export default function PartnerLayout() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const [partner, setPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPartner = async () => {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Get partner for this user
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
      }
    };

    loadPartner();
  }, [session]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  if (!partner) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Partner access required</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'default',
      }}
    >
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="wallets" options={{ headerShown: false }} />
      <Stack.Screen name="policies" options={{ headerShown: false }} />
      <Stack.Screen name="approvals" options={{ headerShown: false }} />
      <Stack.Screen name="disbursements" options={{ headerShown: false }} />
      <Stack.Screen name="audit" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="analytics" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
