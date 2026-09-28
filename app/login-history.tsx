import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Pressable
} from 'react-native';
import { router } from 'expo-router';
import { 
  ArrowLeft, 
  Smartphone, 
  Monitor, 
  Tablet, 
  MapPin, 
  TriangleAlert as AlertTriangle, 
  Calendar, 
  Trash2, 
  ChevronRight,
  Clock
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Platform } from 'react-native';
import { useHaptics } from '@/hooks/useHaptics';
import { recoverPullToRefresh } from '@/lib/supabase-recover';
import { SafeAreaView } from 'react-native-safe-area-context';
import SafeFooter from '@/components/SafeFooter';

interface LoginSession {
  id: string;
  device_type: string;
  device_model: string;
  device_manufacturer: string;
  os_name: string;
  browser_name: string;
  city: string;
  region: string;
  country: string;
  country_code: string;
  ip_address: string;
  is_suspicious: boolean;
  login_timestamp: string;
}

export default function LoginHistoryScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const haptics = useHaptics();
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'suspicious'>('all');

  useEffect(() => {
    if (session?.user?.id) {
      fetchSessions();
    }
  }, [session?.user?.id]);

  const fetchSessions = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) {
        setLoading(true);
      }

      const userId = session?.user?.id;
      console.log('[LoginHistory] Fetching sessions for user:', userId);

      if (!userId) {
        console.log('[LoginHistory] No user ID, returning');
        return;
      }

      // Fetch directly from Supabase
      const { supabase } = await import('@/lib/supabase');
      console.log('[LoginHistory] Querying login_sessions table...');

      const { data, error } = await supabase
        .from('login_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('login_timestamp', { ascending: false });

      console.log('[LoginHistory] Result - Error:', error);
      console.log('[LoginHistory] Result - Data count:', data?.length || 0);

      if (error) {
        console.error('[LoginHistory] Supabase error:', error);
        Alert.alert('Error', `Failed to load sessions: ${error.message}`);
        return;
      }

      if (data) {
        console.log('[LoginHistory] Setting', data.length, 'sessions');
        setSessions(data);
      }
    } catch (error) {
      console.error('[LoginHistory] Exception:', error);
      Alert.alert('Error', 'Failed to load login sessions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    setRefreshing(true);
    void recoverPullToRefresh().finally(() => {
      fetchSessions(true);
    });
  };

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete All Sessions',
      'Are you sure you want to delete all login session records? This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
          }
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              if (Platform.OS !== 'web') {
                haptics.heavyImpact();
              }

              const userId = session?.user?.id;
              if (!userId) return;

              // Delete directly from Supabase
              const { supabase } = await import('@/lib/supabase');
              const { error } = await supabase
                .from('login_sessions')
                .delete()
                .eq('user_id', userId);

              if (error) {
                console.error('Error deleting sessions:', error);
                Alert.alert('Error', 'Failed to delete sessions');
                return;
              }

              setSessions([]);
              Alert.alert('Success', 'All login sessions deleted');
            } catch (error) {
              console.error('Error deleting sessions:', error);
              Alert.alert('Error', 'Failed to delete sessions');
            }
          }
        }
      ]
    );
  };

  const handleSessionPress = (sessionId: string) => {
    if (Platform.OS !== 'web') {
      haptics.lightImpact();
    }
    router.push(`/login-session-detail?id=${sessionId}`);
  };

  const getDeviceIcon = (deviceType: string) => {
    const type = deviceType?.toLowerCase() || '';
    if (type.includes('mobile') || type.includes('phone')) {
      return <Smartphone size={20} color={colors.iconColor} />;
    } else if (type.includes('tablet')) {
      return <Tablet size={20} color={colors.iconColor} />;
    } else {
      return <Monitor size={20} color={colors.iconColor} />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) {
      return 'Just now';
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const formatFullDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredSessions = filterType === 'suspicious'
    ? sessions.filter(s => s.is_suspicious)
    : sessions;

  const suspiciousCount = sessions.filter(s => s.is_suspicious).length;

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (Platform.OS !== 'web') {
              haptics.lightImpact();
            }
            router.back();
          }}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Login History</Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteAll}
          disabled={sessions.length === 0}
        >
          <Trash2 size={20} color={sessions.length === 0 ? colors.textTertiary : colors.error} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Filter Tabs */}
          <View style={styles.filterContainer}>
            <Pressable
              style={[
                styles.filterTab,
                filterType === 'all' && styles.filterTabActive
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                setFilterType('all');
              }}
            >
              <Text style={[
                styles.filterTabText,
                filterType === 'all' && styles.filterTabTextActive
              ]}>
                All Sessions
              </Text>
              <View style={[
                styles.filterBadge,
                filterType === 'all' && styles.filterBadgeActive
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  filterType === 'all' && styles.filterBadgeTextActive
                ]}>
                  {sessions.length}
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.filterTab,
                filterType === 'suspicious' && styles.filterTabActive
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  haptics.selection();
                }
                setFilterType('suspicious');
              }}
            >
              <Text style={[
                styles.filterTabText,
                filterType === 'suspicious' && styles.filterTabTextActive
              ]}>
                Suspicious
              </Text>
              {suspiciousCount > 0 && (
                <View style={[
                  styles.filterBadge,
                  styles.filterBadgeDanger,
                  filterType === 'suspicious' && styles.filterBadgeActive
                ]}>
                  <Text style={[
                    styles.filterBadgeText,
                    styles.filterBadgeTextDanger,
                    filterType === 'suspicious' && styles.filterBadgeTextActive
                  ]}>
                    {suspiciousCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {filteredSessions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Calendar size={48} color={colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>
                {filterType === 'suspicious' ? 'No Suspicious Sessions' : 'No Login Sessions'}
              </Text>
              <Text style={styles.emptyText}>
                {filterType === 'suspicious'
                  ? 'All your login sessions appear normal'
                  : 'Your login history will appear here'}
              </Text>
            </View>
          ) : (
            <View style={styles.section}>
              {suspiciousCount > 0 && filterType === 'all' && (
                <View style={styles.warningBanner}>
                  <View style={styles.warningIconContainer}>
                    <AlertTriangle size={18} color={colors.error} />
                  </View>
                  <Text style={styles.warningText}>
                    {suspiciousCount} suspicious {suspiciousCount === 1 ? 'session' : 'sessions'} detected
                  </Text>
                </View>
              )}

              <View style={styles.card}>
                {filteredSessions.map((sessionItem, index) => (
                  <React.Fragment key={sessionItem.id}>
                    {index > 0 && <View style={styles.divider} />}
                    <Pressable
                      style={styles.sessionItem}
                      onPress={() => handleSessionPress(sessionItem.id)}
                    >
                      <View style={styles.sessionContent}>
                        <View style={[
                          styles.deviceIconContainer,
                          { backgroundColor: colors.backgroundTertiary }
                        ]}>
                          {getDeviceIcon(sessionItem.device_type)}
                        </View>
                        <View style={styles.sessionInfo}>
                          <View style={styles.sessionHeader}>
                            <Text style={styles.deviceName} numberOfLines={1}>
                              {sessionItem.device_manufacturer && sessionItem.device_manufacturer !== 'Unknown'
                                ? `${sessionItem.device_manufacturer} ${sessionItem.device_model || ''}`.trim()
                                : sessionItem.device_type || 'Unknown Device'}
                            </Text>
                            {sessionItem.is_suspicious && (
                              <View style={styles.suspiciousBadge}>
                                <AlertTriangle size={10} color={colors.error} />
                                <Text style={styles.suspiciousBadgeText}>Suspicious</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.osInfo} numberOfLines={1}>
                            {sessionItem.os_name}
                            {sessionItem.browser_name && sessionItem.browser_name !== 'Native App'
                              ? ` · ${sessionItem.browser_name}`
                              : ''}
                          </Text>
                          <View style={styles.sessionMeta}>
                            <View style={styles.locationRow}>
                              <MapPin size={12} color={colors.textSecondary} />
                              <Text style={styles.locationText} numberOfLines={1}>
                                {sessionItem.city && sessionItem.city !== 'Unknown'
                                  ? `${sessionItem.city}, ${sessionItem.country || 'Unknown'}`
                                  : sessionItem.country || 'Unknown Location'}
                              </Text>
                            </View>
                            <View style={styles.timeRow}>
                              <Clock size={12} color={colors.textTertiary} />
                              <Text style={styles.timeAgo}>{formatTimestamp(sessionItem.login_timestamp)}</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      <ChevronRight size={20} color={colors.textTertiary} />
                    </Pressable>
                  </React.Fragment>
                ))}
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Login sessions are automatically deleted after 90 days. IP addresses are anonymized after 30 days for privacy protection.
            </Text>
          </View>
        </ScrollView>
      )}
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Platform.OS === 'ios' ? 24 : 20,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  deleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Platform.OS === 'ios' ? 24 : 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.backgroundTertiary,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: Platform.OS === 'ios' ? 14 : 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterBadgeDanger: {
    backgroundColor: colors.errorLight,
  },
  filterBadgeText: {
    fontSize: Platform.OS === 'ios' ? 12 : 11,
    fontWeight: '600',
    color: colors.text,
  },
  filterBadgeTextActive: {
    color: '#FFFFFF',
  },
  filterBadgeTextDanger: {
    color: colors.error,
  },
  section: {
    marginBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: Platform.OS === 'ios' ? 18 : 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: Platform.OS === 'ios' ? 14 : 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    borderRadius: 12,
    padding: Platform.OS === 'ios' ? 14 : 12,
    marginBottom: Platform.OS === 'ios' ? 20 : 16,
    gap: 10,
  },
  warningIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.error,
    opacity: 0.1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningText: {
    fontSize: Platform.OS === 'ios' ? 14 : 13,
    fontWeight: '600',
    color: colors.error,
    flex: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Platform.OS === 'ios' ? 16 : 14,
    justifyContent: 'space-between',
  },
  sessionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  deviceIconContainer: {
    width: Platform.OS === 'ios' ? 40 : 36,
    height: Platform.OS === 'ios' ? 40 : 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Platform.OS === 'ios' ? 16 : 12,
  },
  sessionInfo: {
    flex: 1,
    minWidth: 0,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  deviceName: {
    fontSize: Platform.OS === 'ios' ? 16 : 15,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
  },
  suspiciousBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  suspiciousBadgeText: {
    fontSize: Platform.OS === 'ios' ? 11 : 10,
    fontWeight: '600',
    color: colors.error,
  },
  osInfo: {
    fontSize: Platform.OS === 'ios' ? 13 : 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  locationText: {
    fontSize: Platform.OS === 'ios' ? 12 : 11,
    color: colors.textSecondary,
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeAgo: {
    fontSize: Platform.OS === 'ios' ? 12 : 11,
    fontWeight: '500',
    color: colors.textTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: Platform.OS === 'ios' ? 16 : 14,
  },
  footer: {
    marginTop: Platform.OS === 'ios' ? 32 : 24,
    paddingTop: Platform.OS === 'ios' ? 24 : 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: Platform.OS === 'ios' ? 12 : 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
