import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Image, Dimensions, Animated, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import { CheckCircle, Loader2, UserPlus } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function AccountCreationScreen() {
  const { colors, isDark } = useTheme();
  const haptics = useHaptics();
  const { signUp } = useAuth();
  
  // Get parameters from navigation
  const params = useLocalSearchParams();
  const firstName = params.firstName as string;
  const lastName = params.lastName as string;
  const email = params.email as string;
  const password = params.password as string;
  const referralCode = params.referralCode as string;
  const emailVerified = params.emailVerified === 'true';
  
  // State to track current phase
  const [isCreatingAccount, setIsCreatingAccount] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUserAlreadyExists, setIsUserAlreadyExists] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const iconAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const textFadeAnim = useRef(new Animated.Value(0)).current;
  const spinnerRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('🔄 Account Creation Screen mounted');
    
    // Start with account creation phase
    startAccountCreationPhase();
  }, []);

  const startAccountCreationPhase = () => {
    console.log('⏳ Starting account creation phase');
    
    // Start animations for account creation
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

    // Start the actual account creation process
    createAccount();
  };

  const createAccount = async () => {
    try {
      console.log('🚀 Creating account...');
      
      // Sign up the user
      const result = await signUp(email, password, firstName, lastName, referralCode);
      
      if (result.success) {
        // If email was verified during onboarding, update the profile
        if (emailVerified && result.data?.session?.user?.id) {
          try {
            console.log('Updating email_verified status to true');
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ email_verified: true })
              .eq('id', result.data.session.user.id);
              
            if (updateError) {
              console.error('Error updating email_verified status:', updateError);
            } else {
              console.log('Email verified status updated successfully');
            }
          } catch (updateError) {
            console.error('Failed to update email_verified status:', updateError);
          }
        }
        
        // Transition to success phase after a short delay
        setTimeout(() => {
          transitionToSuccessPhase();
        }, 1000);
      } else {
        throw new Error(result.error || 'Failed to create account');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account';
      
      // Check if the error is specifically about user already existing
      if (errorMessage.includes('user_already_exists') || 
          errorMessage.includes('User already registered') ||
          errorMessage.includes('already registered')) {
        setError('This email is already registered. Please sign in or use a different email.');
        setIsUserAlreadyExists(true);
      } else {
        setError(errorMessage);
      }
      
      // Transition to error state
      transitionToErrorPhase();
    }
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
      setIsCreatingAccount(false);
      
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
      console.log('✅ Account creation complete, navigating to main tabs');
      router.replace('/(tabs)');
    }, 2000); // Show success for 2 seconds
  };

  const transitionToErrorPhase = () => {
    console.log('❌ Transitioning to error phase');
    
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
      // Update state to error
      setIsCreatingAccount(false);
      
      // Trigger error haptic feedback
      haptics.notification(Haptics.NotificationFeedbackType.Error);
      
      // Animate in error content
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

    // Navigate to login screen after showing error
    setTimeout(() => {
      console.log('❌ Account creation failed, navigating to login');
      router.replace('/(auth)/login');
    }, 3000); // Show error for 3 seconds
  };

  const spinnerRotation = spinnerRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const styles = createStyles(colors, isDark);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
      
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
            {isCreatingAccount ? (
              <Animated.View
                style={{
                  transform: [{ rotate: spinnerRotation }]
                }}
              >
                <Loader2 size={30} color={colors.text} strokeWidth={2} />
              </Animated.View>
            ) : isUserAlreadyExists ? (
              <UserPlus size={60} color={colors.text} strokeWidth={2} />
            ) : (
              <CheckCircle size={60} color={colors.text} strokeWidth={2} />
            )}
          </Animated.View>
          
          {/* Text Content */}
          <Animated.View style={{ opacity: textFadeAnim }}>
            {isCreatingAccount ? (
              <>
                <Text style={styles.title}>Creating Account...</Text>
                <Text style={styles.subtitle}>
                  Please wait while we set up your account
                </Text>
              </>
            ) : isUserAlreadyExists ? (
              <>
                <Text style={styles.title}>Account Already Exists</Text>
                <Text style={styles.subtitle}>
                  This email is already registered. Please sign in or use a different email.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>Account Created Successfully!</Text>
                <Text style={styles.subtitle}>
                  Welcome to Planmoni! Your account is ready to use.
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

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
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
  iconContainer: {
    marginBottom: 30,
    padding: 20,
    borderRadius: 50,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(30, 58, 138, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
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