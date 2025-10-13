import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Dimensions, Animated, Text } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import { LogOut } from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function LoggingOutScreen() {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const logoutAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    console.log('🚪 LoggingOutScreen mounted');
    
    // Trigger light haptic feedback
    haptics.lightImpact();
    
    // Start animations
    Animated.parallel([
      // Fade in the entire screen
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      // Scale in the logo
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      // Slide up the logout message
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate logout icon after logo animation
    setTimeout(() => {
      Animated.spring(logoutAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }, 600);

    // Navigate to login screen after showing logout
    const timer = setTimeout(() => {
      console.log('✅ Logout complete, navigating to login screen');
      router.replace('/');
    }, 2000); // Display for 2 seconds

    return () => {
      console.log('🧹 LoggingOutScreen cleanup');
      clearTimeout(timer);
    };
  }, [haptics, fadeAnim, scaleAnim, logoutAnim, slideAnim]);

  const styles = createStyles(colors, isDark);

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
      
      {/* Main Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Logo Container */}
        <Animated.View 
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          {/* <Image 
            source={require('@/assets/images/logo-dark.png')} 
            style={styles.logo}
            resizeMode="contain"
          /> */}
        </Animated.View>
        
        {/* Logout Message */}
        <Animated.View 
          style={[
            styles.messageContainer,
            {
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Logout Icon */}
          <Animated.View 
            style={[
              styles.logoutContainer,
              {
                transform: [{ scale: logoutAnim }]
              }
            ]}
          >
            <LogOut size={30} color={'#fff'} strokeWidth={2} />
          </Animated.View>
          
          {/* Logout Text */}
          <Text style={styles.logoutTitle}>Logging Out...</Text>
          <Text style={styles.logoutSubtitle}>
            Thank you for using Planmoni. See you soon!
          </Text>
        </Animated.View>
      </Animated.View>
      
      {/* Bottom Decoration */}
      <Animated.View style={[styles.bottomDecoration, { opacity: fadeAnim }]}>
        <View style={styles.decorationLine} />
        <View style={[styles.decorationLine, styles.decorationLineShort]} />
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDark ? colors.background : colors.primary,
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  patternCircle: {
    position: 'absolute',
    borderRadius: 1000,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(30, 58, 138, 0.1)',
  },
  patternCircle1: {
    width: 200,
    height: 200,
    top: -50,
    right: -50,
  },
  patternCircle2: {
    width: 150,
    height: 150,
    bottom: 100,
    left: -30,
  },
  patternCircle3: {
    width: 100,
    height: 100,
    top: screenHeight * 0.3,
    right: 50,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60,
  },
  logo: {
    width: 200,
    height: 200,
  },
  messageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutContainer: {
    marginBottom: 30,
    padding: 20,
    borderRadius: 50,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
  },
  logoutTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  logoutSubtitle: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  bottomDecoration: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  decorationLine: {
    width: 60,
    height: 4,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(30, 58, 138, 0.3)',
    borderRadius: 2,
    marginBottom: 8,
  },
  decorationLineShort: {
    width: 30,
    height: 2,
  },
}); 