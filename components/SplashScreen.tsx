import React from 'react';
import { View, StyleSheet, Image, Dimensions, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SplashScreenProps {
  onFinish?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

// Planmoni blue background color
const PLANMONI_BLUE = '#1E3A8A';

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const styles = createStyles();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style={'light'} />
      
      {/* Logo Container */}
      <View style={styles.logoContainer}>
        <Image 
          source={require('@/assets/images/PlanmoniDarkMode.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Partnership Section */}
      <View style={styles.partnershipContainer}>
        <Text style={styles.partnershipText}>In partnership with</Text>
        <Image 
          source={require('@/assets/images/SafeHavenLogo.png')} 
          style={styles.partnershipLogo}
          resizeMode="contain"
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PLANMONI_BLUE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  logo: {
    width: Math.min(screenWidth * 0.5, 200),
    height: Math.min(screenWidth * 0.5, 200),
  },
  partnershipContainer: {
    position: 'absolute',
    bottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  partnershipText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 8,
    fontWeight: '400',
  },
  partnershipLogo: {
    width: Math.min(screenWidth * 0.3, 120),
    height: Math.min(screenWidth * 0.15, 60),
  },
});
