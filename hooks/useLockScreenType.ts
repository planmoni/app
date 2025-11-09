import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useLockScreenType = () => {
  const [lockScreenType, setLockScreenType] = useState<'pin' | 'welcome'>('welcome');

  useEffect(() => {
    const loadLockScreenType = async () => {
      try {
        const saved = await AsyncStorage.getItem('lock_screen_type');
        console.log('useLockScreenType - Loaded from storage:', saved);
        if (saved && (saved === 'pin' || saved === 'welcome')) {
          setLockScreenType(saved);
          console.log('useLockScreenType - Set lock screen type to:', saved);
        } else {
          console.log('useLockScreenType - Using default: welcome');
        }
      } catch (error) {
        console.error('Error loading lock screen type:', error);
      }
    };
    
    loadLockScreenType();
  }, []);

  return lockScreenType;
}; 