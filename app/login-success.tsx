import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Image, Dimensions, Animated, Text } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import { CheckCircle, Loader2 } from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function LoginSuccessScreen() {
  const { colors } = useTheme();
  const haptics = useHaptics();
  
  // State to track current phase
  const [isLoggingIn, setIsLoggingIn] = useState(true);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const iconAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const spinnerRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('🔄 Combined Login Screen mounted');
    
    // Start with logging in phase
    startLoggingInPhase();
  }, []);

  const startLoggingInPhase = () => {
    console.log('⏳ Starting logging in phase');
    
    // Start animations for logging in
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
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Start spinner rotation
    const startSpinnerRotation = () => {
      Animated.loop(
        Animated.timing(spinnerRotate, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    };

    // Animate spinner after logo animation
    setTimeout(() => {
      Animated.spring(iconAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
      startSpinnerRotation();
    }, 600);

    // Fade in text
    setTimeout(() => {
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 800);

    // Transition to success phase after 2 seconds
    setTimeout(() => {
      transitionToSuccessPhase();
    }, 2000);
  };

  const transitionToSuccessPhase = () => {
    console.log('✅ Transitioning to success phase');
    
    // Stop spinner rotation
    spinnerRotate.stopAnimation();
    
    // Fade out current content
    Animated.parallel([
      Animated.timing(iconAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(textFadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Update state to success
      setIsLoggingIn(false);
      
      // Trigger success haptic feedback
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      
      // Animate in success content
      Animated.parallel([
        Animated.spring(iconAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(textFadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    });

    // Navigate to main tabs after showing success
    setTimeout(() => {
      console.log('✅ Login complete, navigating to main tabs');
      router.replace('/(tabs)');
    }, 1500); // Show success for 1.5 seconds
  };

  const spinnerRotation = spinnerRotate.interpolate({
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
        
        {/* Message Container */}
        <Animated.View 
          style={[
            styles.messageContainer,
            {
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Icon Container */}
          <Animated.View 
            style={[
              styles.iconContainer,
              {
                transform: [{ scale: iconAnim }]
              }
            ]}
          >
            {isLoggingIn ? (
              <Animated.View
                style={{
                  transform: [{ rotate: spinnerRotation }]
                }}
              >
                <Loader2 size={30} color="#FFFFFF" strokeWidth={2} />
              </Animated.View>
            ) : (
              <CheckCircle size={60} color="#FFFFFF" strokeWidth={2} />
            )}
          </Animated.View>
          
          {/* Text Content */}
          <Animated.View style={{ opacity: textFadeAnim }}>
            {isLoggingIn ? (
              <>
                <Text style={styles.title}>Logging In...</Text>
                <Text style={styles.subtitle}>
                  Please wait while we sign you in
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>Welcome Back!</Text>
                <Text style={styles.subtitle}>
                  You've successfully signed in to your account
                </Text>
              </>
            )}
          </Animated.View>
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
  iconContainer: {
    marginBottom: 30,
    padding: 20,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
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
