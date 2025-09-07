import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Dimensions, Animated, Text } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import { Loader2 } from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function LoggingInScreen() {
  const { colors } = useTheme();
  const haptics = useHaptics();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const spinnerAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    console.log('🔄 LoggingInScreen mounted');
    
    // Trigger light haptic feedback
    haptics.lightImpact();
    
    // Start animations immediately
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
      // Slide up the message
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Start spinner animation immediately
    const startSpinner = () => {
      Animated.loop(
        Animated.timing(spinnerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    };

    // Start spinner after a very short delay
    setTimeout(() => {
      startSpinner();
    }, 200);

    // Navigate to login success screen after a short delay
    const timer = setTimeout(() => {
      console.log('✅ Logging in complete, navigating to success screen');
      router.replace('/login-success');
    }, 1500); // Reduced to 1.5 seconds for faster flow

    return () => {
      console.log('🧹 LoggingInScreen cleanup');
      clearTimeout(timer);
    };
  }, [haptics, fadeAnim, scaleAnim, spinnerAnim, slideAnim]);

  const spin = spinnerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.primary, opacity: fadeAnim }]}>
      <StatusBar style="light" backgroundColor={colors.primary} />
      
      {/* Background Pattern */}
      <View style={styles.backgroundPattern}>
        <View style={[styles.patternCircle, styles.patternCircle1]} />
        <View style={[styles.patternCircle, styles.patternCircle2]} />
        <View style={[styles.patternCircle, styles.patternCircle3]} />
      </View>
      
      {/* Main Content */}
      <View style={styles.content}>
        {/* Logo Container */}
        <Animated.View 
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <Image 
            source={require('@/assets/images/logo-dark.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        
        {/* Loading Message */}
        <Animated.View 
          style={[
            styles.messageContainer,
            {
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Spinner Icon */}
          <Animated.View 
            style={[
              styles.spinnerContainer,
              {
                transform: [{ rotate: spin }]
              }
            ]}
          >
            <Loader2 size={60} color="#FFFFFF" strokeWidth={2} />
          </Animated.View>
          
          {/* Loading Text */}
          <Text style={styles.loadingTitle}>Logging In...</Text>
          <Text style={styles.loadingSubtitle}>
            Please wait while we sign you in
          </Text>
        </Animated.View>
      </View>
      
      {/* Bottom Decoration */}
      <View style={styles.bottomDecoration}>
        <View style={styles.decorationLine} />
        <View style={[styles.decorationLine, styles.decorationLineShort]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
  spinnerContainer: {
    marginBottom: 30,
    padding: 20,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  loadingSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 8,
  },
  decorationLineShort: {
    width: 30,
    height: 2,
  },
}); 