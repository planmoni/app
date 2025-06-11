import { useEffect, useRef } from 'react';
import { TextInput, Platform } from 'react-native';

/**
 * A hook to ensure proper keyboard focus on TextInput components
 * Works around issues with keyboard not appearing on screen transitions
 * 
 * @param autoFocus Whether the input should be focused automatically
 * @param delay Optional delay in ms before focusing (default: 100)
 * @returns A ref to be attached to the TextInput component
 */
export function useKeyboardFocus(autoFocus: boolean = false, delay: number = 100) {
  const inputRef = useRef<TextInput>(null);
  
  useEffect(() => {
    if (autoFocus) {
      // Use a timeout to ensure the component is fully mounted
      // This is especially important for screen transitions
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          
          // On iOS, sometimes we need an extra push to show the keyboard
          if (Platform.OS === 'ios') {
            // This trick helps ensure the keyboard appears
            inputRef.current.blur();
            setTimeout(() => {
              inputRef.current?.focus();
            }, 50);
          }
        }
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [autoFocus, delay]);
  
  return inputRef;
}