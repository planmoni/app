import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

export default function PayoutPin() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const [hasPayoutPin, setHasPayoutPin] = useState(true); // TODO: Get from context/storage
  
  const styles = getStyles(isDark);

  const handleChangePin = () => {
    // TODO: Implement change payout PIN flow
    Alert.alert('Change Payout PIN', 'This feature will be implemented soon');
  };

  const handleForgotPin = () => {
    Alert.alert(
      'Forgot Payout PIN',
      'To reset your payout PIN, you will need to verify your identity. This process may take 24-48 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset PIN', 
          onPress: () => {
            // TODO: Implement forgot PIN flow
            Alert.alert('Reset Initiated', 'Your payout PIN reset request has been submitted. You will receive an email with further instructions.');
          }
        }
      ]
    );
  };

  const renderMenuItem = (
    icon: string,
    title: string,
    subtitle: string,
    onPress: () => void,
    isDestructive = false
  ) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuLeft}>
        <View style={[styles.iconContainer, isDestructive && styles.destructiveIcon]}>
          <Ionicons 
            name={icon as any} 
            size={24} 
            color={isDestructive ? '#ff4444' : (isDark ? '#fff' : '#333')} 
          />
        </View>
        <View style={styles.menuText}>
          <Text style={[styles.menuTitle, isDestructive && styles.destructiveText]}>
            {title}
          </Text>
          <Text style={styles.menuSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Ionicons 
        name="chevron-forward" 
        size={20} 
        color={isDark ? '#666' : '#999'} 
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#333'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payout PIN</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <Text style={styles.infoText}>
            Your payout PIN is required to authorize any payout transactions. Keep it secure and don't share it with anyone.
          </Text>
        </View>

        <View style={styles.menuSection}>
          {renderMenuItem(
            'key',
            'Change Payout PIN',
            'Update your current payout PIN to a new one',
            handleChangePin
          )}
          
          {renderMenuItem(
            'help-circle',
            'Forgot Payout PIN',
            'Reset your payout PIN if you can\'t remember it',
            handleForgotPin,
            true
          )}
        </View>

        <View style={styles.securityTips}>
          <Text style={styles.tipsTitle}>Security Tips</Text>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.tipText}>Use a PIN that's different from your app lock PIN</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.tipText}>Avoid using easily guessable numbers like 1234 or your birth year</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.tipText}>Never share your PIN via text, email, or phone calls</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const getStyles = (isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#000' : '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    backgroundColor: isDark ? '#111' : '#fff',
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#333' : '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: isDark ? '#fff' : '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#1a1a1a' : '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: isDark ? '#333' : '#e0e0e0',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: isDark ? '#ccc' : '#666',
    lineHeight: 20,
  },
  menuSection: {
    backgroundColor: isDark ? '#111' : '#fff',
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: isDark ? '#333' : '#e0e0e0',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#333' : '#f0f0f0',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: isDark ? '#333' : '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  destructiveIcon: {
    backgroundColor: '#ffebee',
  },
  menuText: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: isDark ? '#fff' : '#333',
    marginBottom: 4,
  },
  destructiveText: {
    color: '#ff4444',
  },
  menuSubtitle: {
    fontSize: 14,
    color: isDark ? '#999' : '#666',
    lineHeight: 18,
  },
  securityTips: {
    backgroundColor: isDark ? '#111' : '#fff',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? '#333' : '#e0e0e0',
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: isDark ? '#fff' : '#333',
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: isDark ? '#ccc' : '#666',
    lineHeight: 20,
  },
}); 