import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

export default function PinUpdateSuccess() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  // Determine if we're on a small screen
  const isSmallScreen = width < 380 || height < 700;
  
  const styles = getStyles(isDark, colors, isSmallScreen, insets);

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBackToSecurity}
        >
          <Ionicons name="arrow-back" size={isSmallScreen ? 20 : 24} color={isDark ? '#fff' : '#333'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PIN Updated Successfully</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={isSmallScreen ? 50 : 70} color="#4CAF50" />
          </View>
          
          <Text style={styles.successTitle}>PIN Update Complete!</Text>
          
          <Text style={styles.successText}>
            Your app lock PIN has been updated successfully. You can now use your new PIN to secure your app.
          </Text>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Ionicons name="refresh-circle" size={isSmallScreen ? 18 : 20} color="#4CAF50" />
              <Text style={styles.featureText}>PIN has been changed to your new choice</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={isSmallScreen ? 18 : 20} color="#4CAF50" />
              <Text style={styles.featureText}>App security remains fully protected</Text>
            </View>
            
            <View style={styles.featureItem}>
              <Ionicons name="lock-closed" size={isSmallScreen ? 18 : 20} color="#4CAF50" />
              <Text style={styles.featureText}>All security features are active</Text>
            </View>
          </View>

          <View style={styles.autoNavigateInfo}>
            <Ionicons name="time" size={isSmallScreen ? 14 : 16} color={isDark ? '#666' : '#999'} />
            <Text style={styles.autoNavigateText}>
              Automatically returning to Security Center in 3 seconds...
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.continueButton} 
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (isDark: boolean, colors: any, isSmallScreen: boolean, insets: any) => {
  const contentPadding = isSmallScreen ? 16 : 20;
  const footerPadding = Math.max(insets.bottom, 16);
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#000' : '#f5f5f5',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: contentPadding,
      paddingVertical: isSmallScreen ? 12 : 16,
      backgroundColor: isDark ? '#111' : '#fff',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#333' : '#e0e0e0',
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: isSmallScreen ? 18 : 20,
      fontWeight: '600',
      color: isDark ? '#fff' : '#333',
    },
    placeholder: {
      width: 40,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      padding: contentPadding,
      paddingBottom: contentPadding + 20,
    },
    successCard: {
      backgroundColor: isDark ? '#1a1a1a' : '#fff',
      padding: isSmallScreen ? 16 : 20,
      borderRadius: 16,
      alignItems: 'center',
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
      marginBottom: isSmallScreen ? 12 : 16,
    },
    successTitle: {
      fontSize: isSmallScreen ? 18 : 22,
      fontWeight: '700',
      color: isDark ? '#fff' : '#333',
      textAlign: 'center',
      marginBottom: isSmallScreen ? 8 : 12,
    },
    successText: {
      fontSize: isSmallScreen ? 13 : 15,
      color: isDark ? '#ccc' : '#666',
      textAlign: 'center',
      lineHeight: isSmallScreen ? 18 : 22,
      marginBottom: isSmallScreen ? 16 : 20,
    },
    featuresList: {
      width: '100%',
      marginBottom: isSmallScreen ? 12 : 16,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: isSmallScreen ? 8 : 12,
    },
    featureText: {
      fontSize: isSmallScreen ? 13 : 15,
      color: isDark ? '#ccc' : '#666',
      marginLeft: isSmallScreen ? 10 : 14,
      flex: 1,
    },
    autoNavigateInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#2a2a2a' : '#f8f8f8',
      padding: isSmallScreen ? 10 : 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? '#444' : '#e0e0e0',
    },
    autoNavigateText: {
      fontSize: isSmallScreen ? 11 : 13,
      color: isDark ? '#888' : '#666',
      marginLeft: isSmallScreen ? 8 : 10,
      fontStyle: 'italic',
    },
    footer: {
      backgroundColor: isDark ? '#111' : '#fff',
      borderTopWidth: 1,
      borderTopColor: isDark ? '#333' : '#e0e0e0',
      paddingHorizontal: contentPadding,
      paddingTop: 16,
      paddingBottom: footerPadding,
    },
    continueButton: {
      backgroundColor: colors.primary,
      paddingVertical: isSmallScreen ? 14 : 16,
      paddingHorizontal: 32,
      borderRadius: isSmallScreen ? 16 : 20,
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
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '600',
    },
  });
}; 