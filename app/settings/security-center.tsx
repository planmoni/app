import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { usePin } from '@/contexts/PinContext';
import { useAutoLogout } from '@/contexts/AutoLogoutContext';
import { BiometricService } from '@/lib/biometrics';

import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

export default function SecurityCenter() {
  const router = useRouter();
  const { 
    hasAppLockPin, 
    biometricEnabled, 
    payoutBiometricEnabled,
    emergencyBiometricEnabled,
    enableBiometric, 
    disableBiometric 
  } = usePin();
  const { autoLogoutDuration, setAutoLogoutDuration, lockApp, isAppLocked } = useAutoLogout();
  const { isDark, colors } = useTheme();
  
  const [payoutBiometrics, setPayoutBiometrics] = useState(false);
  const [emergencyBiometrics, setEmergencyBiometrics] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [biometricSupport, setBiometricSupport] = useState<any>(null);

  const styles = getStyles(isDark, colors);

  // Load biometric support on mount
  useEffect(() => {
    loadBiometricSupport();
  }, []);

  const loadBiometricSupport = async () => {
    try {
      const support = await BiometricService.checkBiometricSupport();
      setBiometricSupport(support);
    } catch (error) {
      console.error('Error loading biometric support:', error);
    }
  };

  const getBiometricText = (type: 'app' | 'payout' | 'emergency') => {
    if (!biometricSupport) return 'Biometric Authentication';
    
    const label = BiometricService.getBiometricTypeLabel(biometricSupport.supportedTypes);
    const icon = BiometricService.getBiometricIcon(biometricSupport.supportedTypes);
    
    if (type === 'app') {
      return `Login with ${label}`;
    } else if (type === 'payout') {
      return `Confirm Payout with ${label}`;
    } else {
      return `Confirm with ${label}`;
    }
  };

  const getBiometricSubtitle = (type: 'app' | 'payout' | 'emergency') => {
    if (!biometricSupport) return 'Biometric authentication not available';
    
    if (type === 'app') {
      return 'Use biometric authentication to unlock app';
    } else if (type === 'payout') {
      return 'Use biometric authentication for payouts';
    } else {
      return 'Use biometric authentication for emergency withdrawals';
    }
  };

  const getBiometricIcon = () => {
    if (!biometricSupport) return 'finger-print-outline';
    
    const iconName = BiometricService.getBiometricIcon(biometricSupport.supportedTypes);
    
    // Map to valid Ionicons names
    if (iconName === 'face-recognition') return 'person';
    if (iconName === 'finger-print') return 'finger-print-outline';
    if (iconName === 'eye') return 'eye-outline';
    
    return 'shield-checkmark-outline';
  };

  const handlePinSetup = () => {
    if (hasAppLockPin) {
      router.push('/settings/update-pin');
    } else {
      router.push('/settings/setup-pin');
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    console.log('SecurityCenter - Manual refresh triggered');
  };

  const handleBiometricToggle = async (type: 'app' | 'payout' | 'emergency') => {
    try {
      console.log(`SecurityCenter - handleBiometricToggle called for type: ${type}`);
      
      if (type === 'app') {
        if (biometricEnabled) {
          console.log('SecurityCenter - Disabling app biometric');
          const result = await disableBiometric('app');
          console.log('SecurityCenter - Disable app biometric result:', result);
          if (!result) {
            Alert.alert('Error', 'Failed to disable biometric authentication');
          }
        } else {
          console.log('SecurityCenter - Enabling app biometric');
          const result = await enableBiometric('app');
          console.log('SecurityCenter - Enable app biometric result:', result);
          if (!result) {
            Alert.alert('Error', 'Failed to enable biometric authentication. Please check if biometrics are available on your device.');
          }
        }
      } else if (type === 'payout') {
        if (payoutBiometricEnabled) {
          console.log('SecurityCenter - Disabling payout biometric');
          const result = await disableBiometric('payout');
          console.log('SecurityCenter - Disable payout biometric result:', result);
          if (!result) {
            Alert.alert('Error', 'Failed to disable payout biometric authentication');
          }
        } else {
          console.log('SecurityCenter - Enabling payout biometric');
          const result = await enableBiometric('payout');
          console.log('SecurityCenter - Enable payout biometric result:', result);
          if (!result) {
            Alert.alert('Error', 'Failed to enable payout biometric authentication. Please check if biometrics are available on your device.');
          }
        }
      } else if (type === 'emergency') {
        if (emergencyBiometricEnabled) {
          console.log('SecurityCenter - Disabling emergency biometric');
          const result = await disableBiometric('emergency');
          console.log('SecurityCenter - Disable emergency biometric result:', result);
          if (!result) {
            Alert.alert('Error', 'Failed to disable emergency biometric authentication');
          }
        } else {
          console.log('SecurityCenter - Enabling emergency biometric');
          const result = await enableBiometric('emergency');
          console.log('SecurityCenter - Enable emergency biometric result:', result);
          if (!result) {
            Alert.alert('Error', 'Failed to enable emergency biometric authentication. Please check if biometrics are available on your device.');
          }
        }
      }
    } catch (error) {
      console.error('SecurityCenter - Error in handleBiometricToggle:', error);
      Alert.alert('Error', `Failed to update biometric settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );

  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    rightElement?: React.ReactNode
  ) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon as any} size={20} color={colors.text} />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement || (onPress && (
        <Ionicons name="chevron-forward-outline" size={20} color={colors.textSecondary} />
      ))}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="arrow-back-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Security Center</Text>
        </View>
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={handleRefresh}
        >
          <Ionicons name="refresh-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* App Lock Settings */}
      {renderSection('App Lock Settings', (
        <>
          {renderSettingItem(
            'lock-closed-outline',
            hasAppLockPin ? 'Update PIN' : 'Set Up PIN',
            hasAppLockPin ? 'Change your app lock PIN' : 'Create a PIN to lock your app',
            handlePinSetup
          )}
          
          {renderSettingItem(
            'time-outline',
            'Auto Logout',
            `Current: ${autoLogoutDuration === '0' ? 'Immediately' : 
                       autoLogoutDuration === '5' ? 'After 5 mins' : 
                       autoLogoutDuration === '60' ? 'After 60 mins' : 
                       autoLogoutDuration === 'never' ? 'OFF' : 'Not set'}`,
            () => Alert.alert('Auto Logout', 'Select auto logout duration', [
              { text: 'Immediately', onPress: () => setAutoLogoutDuration('0') },
              { text: 'After 5 mins', onPress: () => setAutoLogoutDuration('5') },
              { text: 'After 60 mins', onPress: () => setAutoLogoutDuration('60') },
              { text: 'OFF', onPress: () => setAutoLogoutDuration('never') },
              { text: 'Cancel', style: 'cancel' }
            ])
          )}
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name={getBiometricIcon() as any} size={20} color={colors.text} />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>{getBiometricText('app')}</Text>
                <Text style={styles.settingSubtitle}>{getBiometricSubtitle('app')}</Text>
              </View>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={() => handleBiometricToggle('app')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={biometricEnabled ? colors.primary : colors.backgroundSecondary }
              disabled={!biometricSupport?.isAvailable || !biometricSupport?.isEnrolled}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="card-outline" size={20} color={colors.text} />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Apply Lock to Payout Confirmation</Text>
                <Text style={styles.settingSubtitle}>Require PIN/biometric for payout confirmations</Text>
              </View>
            </View>
            <Switch
              value={payoutBiometricEnabled}
              onValueChange={() => handleBiometricToggle('payout')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={payoutBiometricEnabled ? colors.primary : colors.backgroundSecondary }
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name="warning-outline" size={20} color={colors.text} />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Apply Lock to Emergency Withdrawals</Text>
                <Text style={styles.settingSubtitle}>Require PIN/biometric for emergency withdrawals</Text>
              </View>
            </View>
            <Switch
              value={emergencyBiometricEnabled}
              onValueChange={() => handleBiometricToggle('emergency')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={emergencyBiometricEnabled ? colors.primary : colors.backgroundSecondary }
            />
          </View>
        </>
      ))}

      {/* Debug Information */}
      {__DEV__ && (
        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>Debug Information</Text>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Biometric Support:</Text>
            <Text style={styles.debugValue}>
              {biometricSupport ? 'Loaded' : 'Not Loaded'}
            </Text>
          </View>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Available:</Text>
            <Text style={styles.debugValue}>
              {biometricSupport?.isAvailable ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Enrolled:</Text>
            <Text style={styles.debugValue}>
              {biometricSupport?.isEnrolled ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Supported Types:</Text>
            <Text style={styles.debugValue}>
              {biometricSupport?.supportedTypes?.length || 0} types
            </Text>
          </View>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>App Biometric:</Text>
            <Text style={styles.debugValue}>
              {biometricEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Payout Biometric:</Text>
            <Text style={styles.debugValue}>
              {payoutBiometricEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
          <View style={styles.debugRow}>
            <Text style={styles.debugLabel}>Emergency Biometric:</Text>
            <Text style={styles.debugValue}>
              {emergencyBiometricEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    marginBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  refreshButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'left',
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'left',
  },
  placeholder: {
    width: 40,
  },
  section: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    padding: 20,
    paddingBottom: 10,
  },
  sectionContent: {
    paddingHorizontal: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  currentSettings: {
    margin: 20,
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currentSettingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  testButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  settingButton: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  debugSection: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  debugLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  debugValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
}); 