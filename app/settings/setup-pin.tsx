import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { usePin } from '@/contexts/PinContext';
import PinKeypad from '@/components/PinKeypad';

export default function SetupPin() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { setupAppLockPin } = usePin();
  
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'setup' | 'confirm'>('setup');
  
  const styles = getStyles(isDark, colors);

  const handlePinEnter = (digit: string) => {
    if (step === 'setup') {
      if (pin.length < 4) {
        const newPin = pin + digit;
        setPin(newPin);
        console.log('Setup PIN entered:', newPin, 'Length:', newPin.length);
        // Auto-continue when PIN reaches 4 digits
        if (newPin.length === 4) {
          console.log('PIN complete, proceeding to confirm step...');
          // Use callback to ensure state update
          setStep(prevStep => {
            console.log('Previous step was:', prevStep, 'Setting to confirm');
            return 'confirm';
          });
          // Also try the timeout approach as backup
          setTimeout(() => {
            console.log('Calling handlePinComplete as backup...');
            handlePinComplete();
          }, 100);
        }
      }
    } else {
      if (confirmPin.length < 4) {
        const newConfirmPin = confirmPin + digit;
        setConfirmPin(newConfirmPin);
        console.log('Confirm PIN entered:', newConfirmPin, 'Length:', newConfirmPin.length);
        // Auto-continue when PIN reaches 4 digits
        if (newConfirmPin.length === 4) {
          console.log('Confirm PIN complete, proceeding to completion...');
          console.log('Original PIN:', pin, 'Confirm PIN:', newConfirmPin, 'Match:', pin === newConfirmPin);
          console.log('PIN types - Original:', typeof pin, 'Confirm:', typeof newConfirmPin);
          // Try immediate processing first
          if (pin === newConfirmPin || String(pin) === String(newConfirmPin)) {
            console.log('PINs match, processing immediately...');
            handlePinSetup(newConfirmPin);
          } else {
            console.log('PINs do not match, showing error...');
            setTimeout(() => {
              handlePinComplete();
            }, 100);
          }
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === 'setup') {
      setPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  };

  const handlePinSetup = async (confirmPinValue: string) => {
    try {
      console.log('Setting up PIN with value:', pin);
      const success = await setupAppLockPin(pin);
      if (success) {
        console.log('PIN setup successful, navigating to success screen...');
        router.push('/settings/pin-setup-success');
      } else {
        console.log('PIN setup failed');
        Alert.alert('Error', 'Failed to setup PIN. Please try again.');
      }
    } catch (error) {
      console.error('Error setting up PIN:', error);
      Alert.alert('Error', 'Failed to setup PIN. Please try again.');
    }
  };

  const handlePinComplete = async () => {
    console.log('handlePinComplete called. Current step:', step, 'PIN length:', pin.length, 'Confirm PIN length:', confirmPin.length);
    
    if (step === 'setup') {
      if (pin.length === 4) {
        console.log('Setting step to confirm...');
        setStep('confirm');
        console.log('Step updated to confirm');
      } else {
        console.log('PIN not complete yet. PIN length:', pin.length);
      }
    } else if (step === 'confirm') {
      // For confirm step, we know we have 4 digits since this function is only called when length === 4
      console.log('Processing confirm PIN...');
      if (pin === confirmPin) {
        try {
          console.log('PINs match, setting up PIN...');
          const success = await setupAppLockPin(pin);
          if (success) {
            console.log('PIN setup successful, navigating to success screen...');
            // Navigate to success screen instead of showing alert
            router.push('/settings/pin-setup-success');
          } else {
            console.log('PIN setup failed');
            Alert.alert('Error', 'Failed to setup PIN. Please try again.');
          }
        } catch (error) {
          console.error('Error setting up PIN:', error);
          Alert.alert('Error', 'Failed to setup PIN. Please try again.');
        }
      } else {
        console.log('PINs do not match, showing error and resetting...');
        // Show error and automatically reset to setup step
        Alert.alert(
          'PINs Don\'t Match', 
          'The PINs you entered don\'t match. Please try again.',
          [
            {
              text: 'OK',
              onPress: () => {
                setConfirmPin('');
                setPin('');
                setStep('setup');
              }
            }
          ]
        );
      }
    }
  };

  const renderPinDisplay = () => {
    const currentPin = step === 'setup' ? pin : confirmPin;
    const maxLength = 4;
    
    return (
      <View style={styles.pinDisplay}>
        {Array.from({ length: maxLength }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              index < currentPin.length && styles.pinDotFilled
            ]}
          />
        ))}
      </View>
    );
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={[styles.step, step === 'setup' && styles.stepActive]} />
      <View style={[styles.step, step === 'confirm' && styles.stepActive]} />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#333'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set Up PIN</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name="lock-closed" size={32} color={colors.primary} />
          <Text style={styles.infoTitle}>
            {step === 'setup' ? 'Create Your PIN' : 'Confirm Your PIN'}
          </Text>
          <Text style={styles.infoText}>
            {step === 'setup' 
              ? 'Create a 4-digit PIN to secure your app. Choose something memorable but secure.'
              : 'Enter the same PIN again to confirm it.'
            }
          </Text>
        </View>

        {renderStepIndicator()}

        <View style={styles.pinSection}>
                  {renderPinDisplay()}
        
        <Text style={styles.pinLabel}>
          {step === 'setup' ? 'Enter your PIN' : 'Confirm your PIN'}
        </Text>


        </View>



        <PinKeypad
          onKeyPress={handlePinEnter}
          onDelete={handleDelete}
          disabled={false}
        />

      </View>
    </View>
  );
}

const getStyles = (isDark: boolean, colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#000' : '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    backgroundColor: isDark ? '#111' : '#fff',
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#333' : '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: isDark ? '#fff' : '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    alignItems: 'center',
    backgroundColor: isDark ? '#1a1a1a' : '#fff',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: isDark ? '#333' : '#e0e0e0',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: isDark ? '#fff' : '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: isDark ? '#ccc' : '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  step: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: isDark ? '#333' : '#e0e0e0',
    marginHorizontal: 6,
  },
  stepActive: {
    backgroundColor: colors.primary,
  },
  pinSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  pinDisplay: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: isDark ? '#666' : '#999',
    marginHorizontal: 8,
  },
  pinDotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pinLabel: {
    fontSize: 16,
    color: isDark ? '#ccc' : '#666',
    textAlign: 'center',
  },
  securityTips: {
    backgroundColor: isDark ? '#111' : '#fff',
    padding: 20,
    borderRadius: 12,
    marginTop: 24,
    borderWidth: 1,
    borderColor: isDark ? '#333' : '#e0e0e0',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: isDark ? '#fff' : '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: isDark ? '#ccc' : '#666',
    lineHeight: 20,
  },

}); 