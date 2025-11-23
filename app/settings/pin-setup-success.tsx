import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

export default function PinSetupSuccess() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  
  const styles = getStyles(isDark, colors);

  // Auto-navigate back to security center after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/settings/security-center');
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  const handleContinue = () => {
    router.push('/settings/security-center');
  };

  const handleBackToSecurity = () => {
    router.push('/settings/security-center');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBackToSecurity}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#333'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PIN Setup Complete</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
          </View>
          
          <Text style={styles.successTitle}>PIN Setup Successful!</Text>
          
          <Text style={styles.successText}>
            Your app lock PIN has been set successfully. You can now use it to secure your app and protect your sensitive information.
          </Text>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
              <Text style={styles.featureText}>App is now protected with your PIN</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Ionicons name="lock-closed" size={20} color="#4CAF50" />
              <Text style={styles.featureText}>Secure access to your financial data</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Ionicons name="finger-print" size={20} color="#4CAF50" />
              <Text style={styles.featureText}>Biometric authentication available</Text>
            </View>
          </View>

          <View style={styles.autoNavigateInfo}>
            <Ionicons name="time" size={16} color={isDark ? '#666' : '#999'} />
            <Text style={styles.autoNavigateText}>
              Automatically returning to Security Center in 3 seconds...
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.continueButton} 
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>Continue Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
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
    justifyContent: 'center',
  },
  successCard: {
    backgroundColor: isDark ? '#1a1a1a' : '#fff',
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: isDark ? '#333' : '#e0e0e0',
    shadowColor: isDark ? '#000' : '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: isDark ? 0.3 : 0.1,
    shadowRadius: 8,
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: isDark ? '#fff' : '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  successText: {
    fontSize: 16,
    color: isDark ? '#ccc' : '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  featuresList: {
    width: '100%',
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    fontSize: 16,
    color: isDark ? '#ccc' : '#666',
    marginLeft: 16,
    flex: 1,
  },
  autoNavigateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#2a2a2a' : '#f8f8f8',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? '#444' : '#e0e0e0',
  },
  autoNavigateText: {
    fontSize: 14,
    color: isDark ? '#888' : '#666',
    marginLeft: 12,
    fontStyle: 'italic',
  },
  continueButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
}); 