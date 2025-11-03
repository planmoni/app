import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Smartphone,
  Monitor,
  Tablet,
  MapPin,
  AlertTriangle,
  Calendar,
  Filter,
  Trash2,
  ChevronRight
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Platform } from 'react-native';
import { useHaptics } from '@/hooks/useHaptics';
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

      const accessToken = session?.access_token;
      if (!accessToken) return;

      // Construct API URL - on web, use full URL or relative path depending on environment
      const apiUrl = Platform.OS === 'web' 
        ? (typeof window !== 'undefined' ? `${window.location.origin}/api/login-sessions` : '/api/login-sessions')
        : '/api/login-sessions';

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Check content type before reading body
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      // Read response body once
      const responseText = await response.text();
      
      if (!response.ok) {
        console.error('Error response:', responseText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!isJson) {
        console.error('Expected JSON, got:', responseText);
        throw new Error('Invalid response format');
      }

      // Parse JSON from the text we already read
      const data = JSON.parse(responseText);

      if (data.success && data.sessions) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Error fetching login sessions:', error);
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
    fetchSessions(true);
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

              const accessToken = session?.access_token;
              if (!accessToken) return;

              // Construct API URL - on web, use full URL or relative path depending on environment
              const apiUrl = Platform.OS === 'web'
                ? (typeof window !== 'undefined' ? `${window.location.origin}/api/login-sessions?deleteAll=true` : '/api/login-sessions?deleteAll=true')
                : '/api/login-sessions?deleteAll=true';

              const response = await fetch(apiUrl, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                }
              });

              // Check content type before reading body
              const contentType = response.headers.get('content-type');
              const isJson = contentType && contentType.includes('application/json');
              
              // Read response body once
              const responseText = await response.text();
              
              if (!response.ok) {
                console.error('Error response:', responseText);
                throw new Error(`HTTP error! status: ${response.status}`);
              }

              if (!isJson) {
                console.error('Expected JSON, got:', responseText);
                throw new Error('Invalid response format');
              }

              // Parse JSON from the text we already read
              const data = JSON.parse(responseText);

              if (data.success) {
                setSessions([]);
                Alert.alert('Success', 'All login sessions deleted');
              } else {
                Alert.alert('Error', 'Failed to delete sessions');
              }
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
      return <Smartphone size={24} color="#3B82F6" />;
    } else if (type.includes('tablet')) {
      return <Tablet size={24} color="#3B82F6" />;
    } else {
      return <Monitor size={24} color="#3B82F6" />;
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
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Login History</Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteAll}
          disabled={sessions.length === 0}
        >
          <Trash2 size={20} color={sessions.length === 0 ? colors.textTertiary : '#EF4444'} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <>
          {/* Filter Tabs */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
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
            </TouchableOpacity>

            <TouchableOpacity
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
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#3B82F6"
                colors={['#3B82F6']}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {filteredSessions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Calendar size={48} color={colors.textTertiary} />
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
              <>
                {suspiciousCount > 0 && filterType === 'all' && (
                  <View style={styles.warningBanner}>
                    <AlertTriangle size={20} color="#DC2626" />
                    <Text style={styles.warningText}>
                      {suspiciousCount} suspicious {suspiciousCount === 1 ? 'session' : 'sessions'} detected
                    </Text>
                  </View>
                )}

                {filteredSessions.map((sessionItem, index) => (
                  <TouchableOpacity
                    key={sessionItem.id}
                    style={[
                      styles.sessionCard,
                      sessionItem.is_suspicious && styles.sessionCardSuspicious
                    ]}
                    onPress={() => handleSessionPress(sessionItem.id)}
                    activeOpacity={0.7}
                  >
                    {sessionItem.is_suspicious && (
                      <View style={styles.suspiciousBadge}>
                        <AlertTriangle size={12} color="#DC2626" />
                        <Text style={styles.suspiciousBadgeText}>Suspicious</Text>
                      </View>
                    )}

                    <View style={styles.sessionHeader}>
                      <View style={styles.deviceIconContainer}>
                        {getDeviceIcon(sessionItem.device_type)}
                      </View>
                      <View style={styles.sessionInfo}>
                        <Text style={styles.deviceName} numberOfLines={1}>
                          {sessionItem.device_manufacturer && sessionItem.device_manufacturer !== 'Unknown'
                            ? `${sessionItem.device_manufacturer} ${sessionItem.device_model || ''}`.trim()
                            : sessionItem.device_type || 'Unknown Device'}
                        </Text>
                        <Text style={styles.osInfo} numberOfLines={1}>
                          {sessionItem.os_name}
                          {sessionItem.browser_name && sessionItem.browser_name !== 'Native App'
                            ? ` · ${sessionItem.browser_name}`
                            : ''}
                        </Text>
                      </View>
                      <View style={styles.timeContainer}>
                        <Text style={styles.timeAgo}>{formatTimestamp(sessionItem.login_timestamp)}</Text>
                        <ChevronRight size={16} color={colors.textTertiary} style={styles.chevron} />
                      </View>
                    </View>

                    <View style={styles.sessionDetails}>
                      <View style={styles.locationRow}>
                        <MapPin size={14} color={colors.textSecondary} />
                        <Text style={styles.locationText} numberOfLines={1}>
                          {sessionItem.city && sessionItem.city !== 'Unknown'
                            ? `${sessionItem.city}, ${sessionItem.country || 'Unknown'}`
                            : sessionItem.country || 'Unknown Location'}
                        </Text>
                      </View>
                      <Text style={styles.fullDate}>{formatFullDate(sessionItem.login_timestamp)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Login sessions are automatically deleted after 90 days. IP addresses are anonymized after 30 days for privacy protection.
              </Text>
            </View>
          </ScrollView>
        </>
      )}
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'center'
  },
  deleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.backgroundTertiary,
    gap: 6
  },
  filterTabActive: {
    backgroundColor: colors.primary
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary
  },
  filterTabTextActive: {
    color: '#FFFFFF'
  },
  filterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.background
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)'
  },
  filterBadgeDanger: {
    backgroundColor: '#FEE2E2'
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text
  },
  filterBadgeTextActive: {
    color: '#FFFFFF'
  },
  filterBadgeTextDanger: {
    color: '#DC2626'
  },
  content: {
    flex: 1
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5'
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
    flex: 1
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  sessionCardSuspicious: {
    borderColor: '#FCA5A5',
    borderWidth: 1.5,
    backgroundColor: '#FEF2F2',
    shadowOpacity: 0.08
  },
  suspiciousBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
    gap: 4
  },
  suspiciousBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626'
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  deviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  sessionInfo: {
    flex: 1,
    marginRight: 8,
    minWidth: 0
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2
  },
  osInfo: {
    fontSize: 13,
    color: colors.textSecondary
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  timeAgo: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textTertiary
  },
  chevron: {
    marginLeft: 2
  },
  sessionDetails: {
    gap: 6
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  locationText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1
  },
  fullDate: {
    fontSize: 12,
    color: colors.textTertiary
  },
  footer: {
    marginTop: 24,
    paddingTop: 20,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18
  }
});
