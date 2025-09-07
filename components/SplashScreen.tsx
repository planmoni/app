import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';

interface SplashScreenProps {
  onFinish?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  useEffect(() => {
    console.log('🚀 SplashScreen mounted');
    
    // Set a timeout to call onFinish after the splash screen duration
    const timer = setTimeout(() => {
      console.log('⏰ SplashScreen timer finished, calling onFinish');
      onFinish?.();
    }, 3500); // Display for 2.5 seconds

    return () => {
      console.log('🧹 SplashScreen cleanup');
      clearTimeout(timer);
    };
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#2E4F99" />
      
      {/* Logo Container */}
      <View style={styles.logoContainer}>
        <Image 
          source={require('@/assets/images/logo-dark.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E4F99', // Dark blue background matching the design
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: Math.min(screenWidth * 0.4, 160), // Responsive width, max 160px
    height: Math.min(screenWidth * 0.4, 160), // Keep it square
    marginBottom: 20,
  },
});
