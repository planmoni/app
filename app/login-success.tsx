import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Dimensions, Animated, Text } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import { CheckCircle } from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function LoginSuccessScreen() {
  const { colors } = useTheme();
  const haptics = useHaptics();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;


  useEffect(() => {
    console.log('🎉 LoginSuccessScreen mounted');
    
    // Trigger success haptic feedback
    haptics.notification(Haptics.NotificationFeedbackType.Success);
    
    // Start animations
    Animated.parallel([
      // Fade in the entire screen
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      // Scale in the logo
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      // Slide up the success message
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate checkmark after logo animation
    setTimeout(() => {
      Animated.spring(checkmarkAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }, 800);

    // Navigate to main tabs after showing success
    const timer = setTimeout(() => {
      console.log('✅ Login success complete, navigating to main tabs');
      router.replace('/(tabs)');
    }, 2500); // Display for 2.5 seconds

    return () => {
      console.log('🧹 LoginSuccessScreen cleanup');
      clearTimeout(timer);
    };
  }, [haptics, fadeAnim, scaleAnim, checkmarkAnim, slideAnim]);

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
        
        {/* Success Message */}
        <Animated.View 
          style={[
            styles.messageContainer,
            {
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Checkmark Icon */}
          <Animated.View 
            style={[
              styles.checkmarkContainer,
              {
                transform: [{ scale: checkmarkAnim }]
              }
            ]}
          >
            <CheckCircle size={60} color="#FFFFFF" strokeWidth={2} />
          </Animated.View>
          
          {/* Success Text */}
          <Text style={styles.successTitle}>Welcome Back!</Text>
          <Text style={styles.successSubtitle}>
            You've successfully signed in to your account
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
  checkmarkContainer: {
    marginBottom: 30,
    padding: 20,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  successSubtitle: {
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
