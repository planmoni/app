import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';

interface SplashScreenProps {
  onFinish?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    console.log('🚀 SplashScreen mounted');
    
    // Set a timeout to call onFinish after the splash screen duration
    const timer = setTimeout(() => {
      console.log('⏰ SplashScreen timer finished, calling onFinish');
      onFinish?.();
    }, 3500); // Display for 3.5 seconds

    return () => {
      console.log('🧹 SplashScreen cleanup');
      clearTimeout(timer);
    };
  }, [onFinish]);

  const styles = createStyles(colors, isDark);

  return (
    <View style={styles.container}>
      <StatusBar style={'light'} />
      
      {/* Logo Container */}
      <View style={styles.logoContainer}>
        <Image 
          source={isDark ? require('@/assets/images/logo-dark.png') : require('@/assets/images/logo-dark.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? colors.background : colors.primary,
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
