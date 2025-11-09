import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  Smartphone,
  Monitor,
  Tablet,
  MapPin,
  Globe,
  Clock,
  Wifi,
  AlertTriangle,
  Trash2,
  ExternalLink,
  Info,
  Shield,
  ShieldCheck,
  Calendar
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import SafeFooter from '@/components/SafeFooter';

interface LoginSessionDetail {
  id: string;
  session_id: string;
  device_type: string;
  device_model: string;
  device_manufacturer: string;
  os_name: string;
  os_version: string;
  browser_name: string;
  browser_version: string;
  engine_name: string;
  screen_resolution: string;
  user_agent_raw: string;
  ip_address: string;
  country: string;
  country_code: string;
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  isp: string;
  is_suspicious: boolean;
  login_timestamp: string;
  created_at: string;
}

export default function LoginSessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const [sessionDetail, setSessionDetail] = useState<LoginSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && session?.user?.id) {
      fetchSessionDetail();
    }
  }, [id, session?.user?.id]);

  const fetchSessionDetail = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('login_sessions')
        .select('*')
        .eq('id', id)
        .eq('user_id', session?.user?.id)
        .single();

      if (error) {
        console.error('Error fetching session detail:', error);
        Alert.alert('Error', 'Failed to load session details');
        router.back();
        return;
      }

      setSessionDetail(data);
    } catch (error) {
      console.error('Error fetching session detail:', error);
      Alert.alert('Error', 'Failed to load session details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleFlagSuspicious = async () => {
    if (!sessionDetail) return;

    const action = sessionDetail.is_suspicious ? 'unflag' : 'flag';
    Alert.alert(
      `${action === 'flag' ? 'Flag' : 'Unflag'} Session`,
      `Are you sure you want to ${action} this session as suspicious?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'flag' ? 'Flag' : 'Unflag',
          style: action === 'flag' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const accessToken = session?.access_token;
              if (!accessToken) return;

              // Construct API URL - on web, use full URL or relative path depending on environment
              const apiUrl = Platform.OS === 'web'
                ? (typeof window !== 'undefined' ? `${window.location.origin}/api/login-sessions` : '/api/login-sessions')
                : '/api/login-sessions';

              const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  sessionId: sessionDetail.id,
                  isSuspicious: !sessionDetail.is_suspicious
                })
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
                setSessionDetail(prev =>
                  prev ? { ...prev, is_suspicious: !prev.is_suspicious } : null
                );
                Alert.alert('Success', `Session ${action}ged successfully`);
              } else {
                Alert.alert('Error', 'Failed to update session');
              }
            } catch (error) {
              console.error('Error flagging session:', error);
              Alert.alert('Error', 'Failed to update session');
            }
          }
        }
      ]
    );
  };

  const handleDeleteSession = () => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this login session record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const accessToken = session?.access_token;
              if (!accessToken) return;

              // Construct API URL - on web, use full URL or relative path depending on environment
              const apiUrl = Platform.OS === 'web'
                ? (typeof window !== 'undefined' ? `${window.location.origin}/api/login-sessions?sessionId=${id}` : `/api/login-sessions?sessionId=${id}`)
                : `/api/login-sessions?sessionId=${id}`;

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
                Alert.alert('Success', 'Session deleted successfully');
                router.back();
              } else {
                Alert.alert('Error', 'Failed to delete session');
              }
            } catch (error) {
              console.error('Error deleting session:', error);
              Alert.alert('Error', 'Failed to delete session');
            }
          }
        }
      ]
    );
  };

  const handleOpenMap = () => {
    if (!sessionDetail?.latitude || !sessionDetail?.longitude) {
      Alert.alert('Location unavailable', 'GPS coordinates not available for this session');
      return;
    }

    const url = `https://www.google.com/maps?q=${sessionDetail.latitude},${sessionDetail.longitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Failed to open map');
    });
  };

  const getDeviceIcon = (deviceType: string) => {
    const type = deviceType?.toLowerCase() || '';
    if (type.includes('mobile') || type.includes('phone')) {
      return <Smartphone size={32} color="#3B82F6" />;
    } else if (type.includes('tablet')) {
      return <Tablet size={32} color="#3B82F6" />;
    } else {
      return <Monitor size={32} color="#3B82F6" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  };

  const styles = createStyles(colors);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Session Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
        <SafeFooter />
      </SafeAreaView>
    );
  }

  if (!sessionDetail) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Session Details</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Session not found</Text>
        </View>
        <SafeFooter />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section with Device Info */}

        {/* Status Banner */}
        {sessionDetail.is_suspicious && (
          <View style={styles.warningBanner}>
            <AlertTriangle size={20} color="#DC2626" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Suspicious Activity Detected</Text>
              <Text style={styles.warningText}>
                This session has been flagged due to unusual patterns. Review the details below.
              </Text>
            </View>
          </View>
        )}

        {/* Device Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: colors.backgroundTertiary }]}>
              <Smartphone size={20} color={colors.iconColor} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Device Information</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Device Type</Text>
              <Text style={styles.infoValue}>{sessionDetail.device_type || 'Unknown'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Manufacturer</Text>
              <Text style={styles.infoValue}>{sessionDetail.device_manufacturer || 'Unknown'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Model</Text>
              <Text style={styles.infoValue}>{sessionDetail.device_model || 'Unknown'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Operating System</Text>
              <Text style={styles.infoValue}>
                {sessionDetail.os_name} {sessionDetail.os_version}
              </Text>
            </View>
            {sessionDetail.browser_name && sessionDetail.browser_name !== 'Native App' && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Browser</Text>
                  <Text style={styles.infoValue}>
                    {sessionDetail.browser_name} {sessionDetail.browser_version}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Rendering Engine</Text>
                  <Text style={styles.infoValue}>{sessionDetail.engine_name}</Text>
                </View>
              </>
            )}
            {sessionDetail.screen_resolution && sessionDetail.screen_resolution !== 'Unknown' && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Screen Resolution</Text>
                  <Text style={styles.infoValue}>{sessionDetail.screen_resolution}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: colors.backgroundTertiary }]}>
              <MapPin size={20} color={colors.iconColor} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Location</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>City</Text>
              <Text style={styles.infoValue}>{sessionDetail.city || 'Unknown'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Region</Text>
              <Text style={styles.infoValue}>{sessionDetail.region || 'Unknown'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Country</Text>
              <Text style={styles.infoValue}>
                {sessionDetail.country || 'Unknown'} {sessionDetail.country_code ? `(${sessionDetail.country_code})` : ''}
              </Text>
            </View>
            {sessionDetail.timezone && sessionDetail.timezone !== 'Unknown' && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Timezone</Text>
                  <Text style={styles.infoValue}>{sessionDetail.timezone}</Text>
                </View>
              </>
            )}
            {sessionDetail.latitude && sessionDetail.longitude && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Coordinates</Text>
                  <Text style={styles.infoValue}>
                    {sessionDetail.latitude.toFixed(4)}, {sessionDetail.longitude.toFixed(4)}
                  </Text>
                </View>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.mapButton}
                  onPress={handleOpenMap}
                >
                  <MapPin size={16} color="#3B82F6" />
                  <Text style={styles.mapButtonText}>View on Map</Text>
                  <ExternalLink size={16} color="#3B82F6" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Network Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: colors.backgroundTertiary }]}>
              <Wifi size={20} color={colors.iconColor} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Network</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>IP Address</Text>
              <Text style={[styles.infoValue, styles.monospace]}>
                {sessionDetail.ip_address || 'Unknown'}
              </Text>
            </View>
            {sessionDetail.isp && sessionDetail.isp !== 'Unknown' && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Internet Provider</Text>
                  <Text style={styles.infoValue}>{sessionDetail.isp}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Session Details Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.iconContainer, { backgroundColor: colors.backgroundTertiary }]}>
              <Calendar size={20} color={colors.iconColor} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Session Details</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Login Time</Text>
              <Text style={styles.infoValue}>{formatTimestamp(sessionDetail.login_timestamp)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Session ID</Text>
              <Text style={[styles.infoValue, styles.monospace]} numberOfLines={1}>
                {sessionDetail.session_id || 'N/A'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={[
                styles.statusBadge,
                sessionDetail.is_suspicious ? styles.statusBadgeDanger : styles.statusBadgeSuccess
              ]}>
                <Text style={[
                  styles.statusText,
                  sessionDetail.is_suspicious ? styles.statusTextDanger : styles.statusTextSuccess
                ]}>
                  {sessionDetail.is_suspicious ? 'Suspicious' : 'Normal'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Technical Details */}
        {sessionDetail.user_agent_raw && sessionDetail.user_agent_raw !== 'Unknown' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.iconContainer, { backgroundColor: colors.backgroundTertiary }]}>
                <Info size={20} color={colors.iconColor} />
              </View>
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Technical Details</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={[styles.technicalText, { color: colors.textSecondary }]}>
                {sessionDetail.user_agent_raw}
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              sessionDetail.is_suspicious ? styles.actionButtonSuccess : styles.actionButtonWarning
            ]}
            onPress={handleFlagSuspicious}
          >
            <Shield
              size={20}
              color={sessionDetail.is_suspicious ? colors.success : colors.error}
            />
            <Text style={[
              styles.actionButtonText,
              sessionDetail.is_suspicious ? styles.actionButtonTextSuccess : styles.actionButtonTextError
            ]}>
              {sessionDetail.is_suspicious ? 'Mark as Safe' : 'Flag as Suspicious'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={handleDeleteSession}
          >
            <Trash2 size={20} color={colors.error} />
            <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
              Delete Session
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Info size={16} color={colors.textSecondary} />
          <Text style={styles.infoBoxText}>
            Login sessions are automatically deleted after 90 days. IP addresses are anonymized after 30 days for privacy.
          </Text>
        </View>
      </ScrollView>
      
      <SafeFooter />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
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
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  heroContent: {
    flex: 1
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textSecondary
  },
  suspiciousBadgeHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6
  },
  suspiciousBadgeTextHero: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary
  },
  content: {
    flex: 1
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 12
  },
  warningContent: {
    flex: 1
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 4
  },
  warningText: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18
  },
  section: {
    marginBottom: 20
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  sectionHeaderText: {
    flex: 1
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    minHeight: 44
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    flex: 1
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    flex: 1.5,
    textAlign: 'right'
  },
  monospace: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginTop: 4,
    gap: 8
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6'
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusBadgeSuccess: {
    backgroundColor: '#D1FAE5'
  },
  statusBadgeDanger: {
    backgroundColor: '#FEE2E2'
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600'
  },
  statusTextSuccess: {
    color: '#047857'
  },
  statusTextDanger: {
    color: '#DC2626'
  },
  technicalText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  actionsContainer: {
    gap: 12,
    marginTop: 8,
    marginBottom: 20
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 100,
    gap: 8,
    borderWidth: 1.5
  },
  actionButtonWarning: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error
  },
  actionButtonSuccess: {
    backgroundColor: colors.successLight,
    borderColor: colors.success
  },
  actionButtonDanger: {
    backgroundColor: colors.errorLight,
    borderColor: colors.error
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600'
  },
  actionButtonTextWarning: {
    color: colors.error
  },
  actionButtonTextSuccess: {
    color: colors.success
  },
  actionButtonTextError: {
    color: colors.error
  },
  actionButtonTextDanger: {
    color: colors.error
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100
  }
});
