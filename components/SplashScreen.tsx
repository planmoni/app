import React from 'react';
import { View, StyleSheet, Image, Dimensions, ActivityIndicator } from 'react-native';
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

      {/* Loading Indicator */}
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
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
  loadingContainer: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
