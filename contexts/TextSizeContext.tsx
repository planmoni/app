import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type TextSizeContextType = {
  textSizeMultiplier: number;
  setTextSizeMultiplier: (multiplier: number) => Promise<void>;
};

// Storage key for text size preference
const TEXT_SIZE_MULTIPLIER_KEY = 'text_size_multiplier';

// Default multiplier (normal size)
const DEFAULT_MULTIPLIER = 1.0;

// Min and max multiplier values
export const MIN_TEXT_SIZE_MULTIPLIER = 0.75;
export const MAX_TEXT_SIZE_MULTIPLIER = 1.5;

const TextSizeContext = createContext<TextSizeContextType | undefined>(undefined);

export function TextSizeProvider({ children }: { children: React.ReactNode }) {
  const [textSizeMultiplier, setTextSizeMultiplierState] = useState<number>(DEFAULT_MULTIPLIER);
  const [isLoading, setIsLoading] = useState(true);

  // Load text size preference from storage on mount
  useEffect(() => {
    const loadTextSizePreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(TEXT_SIZE_MULTIPLIER_KEY);
        if (stored) {
          const multiplier = parseFloat(stored);
          // Validate multiplier is within range
          if (multiplier >= MIN_TEXT_SIZE_MULTIPLIER && multiplier <= MAX_TEXT_SIZE_MULTIPLIER) {
            setTextSizeMultiplierState(multiplier);
          } else {
            // If stored value is invalid, use default
            setTextSizeMultiplierState(DEFAULT_MULTIPLIER);
          }
        } else {
          // No stored preference, use default
          setTextSizeMultiplierState(DEFAULT_MULTIPLIER);
        }
      } catch (error) {
        console.error('Error loading text size preference:', error);
        // On error, use default
        setTextSizeMultiplierState(DEFAULT_MULTIPLIER);
      } finally {
        setIsLoading(false);
      }
    };

    loadTextSizePreference();
  }, []);

  // Save text size preference to storage when it changes
  const setTextSizeMultiplier = async (multiplier: number) => {
    try {
      // Validate multiplier is within range
      const clampedMultiplier = Math.max(
        MIN_TEXT_SIZE_MULTIPLIER,
        Math.min(MAX_TEXT_SIZE_MULTIPLIER, multiplier)
      );
      
      setTextSizeMultiplierState(clampedMultiplier);
      await AsyncStorage.setItem(TEXT_SIZE_MULTIPLIER_KEY, clampedMultiplier.toString());
    } catch (error) {
      console.error('Error saving text size preference:', error);
      // Still update state even if save fails
      setTextSizeMultiplierState(multiplier);
    }
  };

  // Don't render until text size is loaded to prevent flash
  if (isLoading) {
    return null;
  }

  return (
    <TextSizeContext.Provider value={{ textSizeMultiplier, setTextSizeMultiplier }}>
      {children}
    </TextSizeContext.Provider>
  );
}

export function useTextSize() {
  const context = useContext(TextSizeContext);
  if (context === undefined) {
    throw new Error('useTextSize must be used within a TextSizeProvider');
  }
  return context;
}

