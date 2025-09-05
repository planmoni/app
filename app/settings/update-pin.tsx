import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { usePin } from '@/contexts/PinContext';
import PinKeypad from '@/components/PinKeypad';

export default function UpdatePin() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const { verifyAppLockPin, updateAppLockPin } = usePin();
  
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('current');
  
  const styles = getStyles(isDark, colors);

  const handlePinEnter = (digit: string) => {
    if (step === 'current') {
      if (currentPin.length < 4) {
        const newCurrentPin = currentPin + digit;
        setCurrentPin(newCurrentPin);
        console.log('Current PIN entered:', newCurrentPin, 'Length:', newCurrentPin.length);
        // Auto-continue when PIN reaches 4 digits
        if (newCurrentPin.length === 4) {
          console.log('Current PIN complete, proceeding to verification...');
          // Try immediate verification first
          handleCurrentPinVerification(newCurrentPin);
          // Also try the timeout approach as backup
          setTimeout(() => {
            console.log('Calling handlePinComplete as backup...');
            handlePinComplete();
          }, 100);
        }
      }
    } else if (step === 'new') {
      if (newPin.length < 4) {
        const newPinValue = newPin + digit;
        setNewPin(newPinValue);
        console.log('New PIN entered:', newPinValue, 'Length:', newPinValue.length);
        // Auto-continue when PIN reaches 4 digits
        if (newPinValue.length === 4) {
          console.log('New PIN complete, proceeding to confirm step...');
          // Try immediate step change first
          setStep('confirm');
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
          // Try immediate processing first
          console.log('Comparing PINs - New:', newPin, 'Confirm:', newConfirmPin, 'Match:', newPin === newConfirmPin);
          if (newPin === newConfirmPin) {
            console.log('PINs match, processing PIN update immediately...');
            handlePinUpdate(newConfirmPin);
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
    if (step === 'current') {
      setCurrentPin(prev => prev.slice(0, -1));
    } else if (step === 'new') {
      setNewPin(prev => prev.slice(0, -1));
    } else {
      setConfirmPin(prev => prev.slice(0, -1));
    }
  };

  const handlePinUpdate = async (confirmPinValue: string) => {
    try {
      console.log('Processing PIN update with new PIN:', newPin);
      const success = await updateAppLockPin(newPin);
      if (success) {
        console.log('PIN update successful, navigating to success screen...');
        router.push('/settings/pin-update-success');
      } else {
        console.log('PIN update failed');
        Alert.alert('Error', 'Failed to update PIN. Please try again.');
      }
    } catch (error) {
      console.error('Error updating PIN:', error);
      Alert.alert('Error', 'Failed to update PIN. Please try again.');
    }
  };

  const handleCurrentPinVerification = async (pinToVerify: string) => {
    try {
      console.log('Immediately verifying current PIN:', pinToVerify);
      
      const isValid = await verifyAppLockPin(pinToVerify);
      console.log('Immediate PIN verification result:', isValid);
      
      if (isValid) {
        console.log('Current PIN valid, setting step to new immediately...');
        setStep('new');
        setCurrentPin(''); // Clear the current PIN input
        console.log('Step updated to new immediately');
      } else {
        console.log('Current PIN invalid, showing error immediately...');
        Alert.alert(
          'Incorrect PIN', 
          'The PIN you entered is incorrect. Please try again.',
          [
            {
              text: 'OK',
              onPress: () => {
                setCurrentPin('');
                console.log('Current PIN reset after invalid entry');
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error in immediate PIN verification:', error);
      Alert.alert('Error', 'Failed to verify PIN. Please try again.');
    }
  };

  const handlePinComplete = async () => {
    console.log('handlePinComplete called. Current step:', step, 'Current PIN length:', currentPin.length, 'New PIN length:', newPin.length, 'Confirm PIN length:', confirmPin.length);
    
    if (step === 'current') {
      if (currentPin.length === 4) {
        try {
          console.log('Verifying current PIN:', currentPin);
          const isValid = await verifyAppLockPin(currentPin);
          console.log('PIN verification result:', isValid);
          if (isValid) {
            console.log('Current PIN valid, setting step to new...');
            setStep('new');
            console.log('Step updated to new');
          } else {
            console.log('Current PIN invalid, showing error...');
            Alert.alert(
              'Incorrect PIN', 
              'The PIN you entered is incorrect. Please try again.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    setCurrentPin('');
                    console.log('Current PIN reset after invalid entry');
                  }
                }
              ]
            );
          }
        } catch (error) {
          console.error('Error verifying current PIN:', error);
          Alert.alert('Error', 'Failed to verify PIN. Please try again.');
        }
      } else {
        console.log('Current PIN not complete yet. Current PIN length:', currentPin.length);
      }
    } else if (step === 'new') {
      if (newPin.length === 4) {
        console.log('New PIN complete, setting step to confirm...');
        setStep('confirm');
        console.log('Step updated to confirm');
      } else {
        console.log('New PIN not complete yet. New PIN length:', newPin.length);
      }
    } else {
      if (confirmPin.length === 4) {
        if (newPin === confirmPin) {
          try {
            console.log('PINs match, updating PIN...');
            const success = await updateAppLockPin(newPin);
            if (success) {
              console.log('PIN update successful, navigating to success screen...');
              // Navigate to success screen instead of showing alert
              router.push('/settings/pin-update-success');
            } else {
              console.log('PIN update failed');
              Alert.alert('Error', 'Failed to update PIN. Please try again.');
            }
          } catch (error) {
            console.error('Error updating PIN:', error);
            Alert.alert('Error', 'Failed to update PIN. Please try again.');
          }
        } else {
          console.log('PINs do not match, showing error and resetting...');
          // Show error and automatically reset to new PIN step
          Alert.alert(
            'PINs Don\'t Match', 
            'The new PINs you entered don\'t match. Please try again.',
            [
              {
                text: 'OK',
                onPress: () => {
                  setConfirmPin('');
                  setNewPin('');
                  setStep('new');
                }
              }
            ]
          );
        }
      } else {
        console.log('Confirm PIN not complete yet. Confirm PIN length:', confirmPin.length);
      }
    }
  };

  const renderPinDisplay = () => {
    let currentPinValue = '';
    let maxLength = 4;
    
    if (step === 'current') {
      currentPinValue = currentPin;
    } else if (step === 'new') {
      currentPinValue = newPin;
    } else {
      currentPinValue = confirmPin;
    }
    
    return (
      <View style={styles.pinDisplay}>
        {Array.from({ length: maxLength }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.pinDot,
              index < currentPinValue.length && styles.pinDotFilled
            ]}
          />
        ))}
      </View>
    );
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={[styles.step, step === 'current' && styles.stepActive]} />
      <View style={[styles.step, step === 'new' && styles.stepActive]} />
      <View style={[styles.step, step === 'confirm' && styles.stepActive]} />
    </View>
  );

  const getStepInfo = () => {
    switch (step) {
      case 'current':
        return {
          title: 'Enter Current PIN',
          subtitle: 'Enter your current PIN to verify your identity',
          icon: 'lock-closed'
        };
      case 'new':
        return {
          title: 'Create New PIN',
          subtitle: 'Enter a new 4-digit PIN for your app',
          icon: 'key'
        };
      case 'confirm':
        return {
          title: 'Confirm New PIN',
          subtitle: 'Enter the same PIN again to confirm it',
          icon: 'checkmark-circle'
        };
      default:
        return {
          title: 'Update PIN',
          subtitle: 'Update your app lock PIN',
          icon: 'lock-closed'
        };
    }
  };

  const stepInfo = getStepInfo();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#333'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Update PIN</Text>
        <TouchableOpacity 
          style={styles.forgotPinButton} 
          onPress={() => router.push('/forgot-pin')}
        >
          <Text style={styles.forgotPinText}>Forgot PIN?</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <Ionicons name={stepInfo.icon as any} size={32} color={colors.primary} />
          <Text style={styles.infoTitle}>{stepInfo.title}</Text>
          <Text style={styles.infoText}>{stepInfo.subtitle}</Text>
        </View>

        {renderStepIndicator()}

        <View style={styles.pinSection}>
          {renderPinDisplay()}
          
          <Text style={styles.pinLabel}>
            {step === 'current' ? 'Enter current PIN' : 
             step === 'new' ? 'Enter new PIN' : 'Confirm new PIN'}
          </Text>
        </View>





        <PinKeypad
          onKeyPress={handlePinEnter}
          onDelete={handleDelete}
          disabled={false}
        />

        <View style={styles.securityTips}>
          <Text style={styles.tipsTitle}>PIN Security Tips</Text>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.tipText}>Use a 4-digit number that's easy to remember</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.tipText}>Avoid obvious patterns like 1234 or 0000</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.tipText}>Don't use your birth year or phone number</Text>
          </View>
        </View>
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
  forgotPinButton: {
    padding: 8,
  },
  forgotPinText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
}); 