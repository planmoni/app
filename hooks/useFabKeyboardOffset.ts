import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, Animated, Easing, Keyboard, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Try to import the native module, but provide a fallback if it fails
let useSoftKeyboardOffset: (() => number) | null = null;
try {
  const avoidSoftInput = require('react-native-avoid-softinput');
  useSoftKeyboardOffset = avoidSoftInput.useSoftKeyboardOffset;
} catch (error) {
  console.warn('react-native-avoid-softinput not available, using fallback keyboard detection');
}

interface UseFabKeyboardOffsetOptions {
  /**
   * Additional offset to add above the keyboard (default: 8)
   */
  gap?: number;
  /**
   * Height of bottom tab bar if present (default: 0)
   */
  tabBarHeight?: number;
  /**
   * Animation duration in milliseconds (default: 250)
   */
  animationDuration?: number;
  /**
   * Use dynamic calculation for Android (default: true)
   */
  useDynamicCalculation?: boolean;
  /**
   * When false, skip keyboard listeners (use for Android FABs that stay fixed).
   */
  enabled?: boolean;
}

export function useFabKeyboardOffset(options: UseFabKeyboardOffsetOptions = {}) {
  const {
    gap = 8,
    tabBarHeight = 0,
    animationDuration = 250,
    useDynamicCalculation = true,
    enabled = true,
  } = options;

  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [bottomOffset, setBottomOffset] = useState(insets.bottom + tabBarHeight);
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);
  const animatedBottom = useRef(new Animated.Value(insets.bottom + tabBarHeight)).current;
  const keyboardListeners = useRef<any[]>([]);

  // Always call the hook when available (Rules of Hooks); ignore result when disabled
  const softKeyboardOffsetRaw = useSoftKeyboardOffset ? useSoftKeyboardOffset() : 0;
  const softKeyboardOffset = enabled ? softKeyboardOffsetRaw : 0;

  // Calculate dynamic keyboard height for Android
  const calculateAndroidKeyboardHeight = useCallback((keyboardEventHeight: number) => {
    if (!useDynamicCalculation || Platform.OS !== 'android') {
      return keyboardEventHeight;
    }

    const windowHeight = Dimensions.get('window').height;
    const screenHeight = Dimensions.get('screen').height;
    
    // Calculate the difference between screen and window height
    const statusBarHeight = screenHeight - windowHeight;
    
    // Adjust keyboard height based on screen dimensions
    const adjustedHeight = Math.max(
      keyboardEventHeight - statusBarHeight - insets.bottom,
      0
    );
    
    return adjustedHeight;
  }, [useDynamicCalculation, insets.bottom]);

  // Update screen height when dimensions change
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenHeight(window.height);
    });

    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    // Clean up existing listeners
    keyboardListeners.current.forEach(listener => listener.remove());
    keyboardListeners.current = [];

    if (!enabled) {
      setKeyboardHeight(0);
      setBottomOffset(insets.bottom + tabBarHeight);
      return;
    }

    if (useSoftKeyboardOffset) {
      // Use react-native-avoid-softinput if available
      setKeyboardHeight(softKeyboardOffset);

      const finalBottom = softKeyboardOffset > 0 
        ? softKeyboardOffset + gap + insets.bottom
        : insets.bottom + tabBarHeight;

      setBottomOffset(finalBottom);
    } else {
      // Enhanced keyboard handling with multiple event listeners
      const handleKeyboardShow = (event: any) => {
        const height = event.endCoordinates?.height || 0;
        const adjustedHeight = calculateAndroidKeyboardHeight(height);
        
        setKeyboardHeight(adjustedHeight);
        
        let finalBottom;
        if (Platform.OS === 'android') {
          // For Android, position the button just above the keyboard
          finalBottom = adjustedHeight > 0 
            ? adjustedHeight + gap
            : insets.bottom + tabBarHeight;
        } else {
          // iOS behavior
          finalBottom = height > 0 
            ? height + gap + insets.bottom
            : insets.bottom + tabBarHeight;
        }

        setBottomOffset(finalBottom);
      };

      const handleKeyboardHide = () => {
        setKeyboardHeight(0);
        const finalBottom = insets.bottom + tabBarHeight;
        setBottomOffset(finalBottom);
      };

      // Add multiple listeners for better Android support
      const listeners = [
        Keyboard.addListener('keyboardDidShow', handleKeyboardShow),
        Keyboard.addListener('keyboardDidHide', handleKeyboardHide),
      ];

      // Add iOS-specific listeners
      if (Platform.OS === 'ios') {
        listeners.push(
          Keyboard.addListener('keyboardWillShow', handleKeyboardShow),
          Keyboard.addListener('keyboardWillHide', handleKeyboardHide)
        );
      }

      // Add Android-specific listeners for better detection
      if (Platform.OS === 'android') {
        listeners.push(
          Keyboard.addListener('keyboardDidChangeFrame', handleKeyboardShow)
        );
      }

      keyboardListeners.current = listeners;
    }

    return () => {
      keyboardListeners.current.forEach(listener => listener.remove());
      keyboardListeners.current = [];
    };
  }, [enabled, softKeyboardOffset, insets.bottom, gap, tabBarHeight, calculateAndroidKeyboardHeight]);

  // Animate when bottomOffset changes
  useEffect(() => {
    if (!enabled) return;
    Animated.timing(animatedBottom, {
      toValue: bottomOffset,
      duration: animationDuration,
      easing: Platform.OS === 'ios' 
        ? Easing.bezier(0.17, 0.59, 0.4, 0.77)
        : Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [enabled, bottomOffset, animationDuration]);

  return {
    /**
     * Current bottom offset
     */
    bottomOffset: enabled ? bottomOffset : insets.bottom + tabBarHeight,
    /**
     * Current keyboard height
     */
    keyboardHeight: enabled ? keyboardHeight : 0,
    /**
     * Whether keyboard is currently visible
     */
    isKeyboardVisible: enabled && keyboardHeight > 0,
    /**
     * Safe area bottom inset
     */
    safeAreaBottom: insets.bottom,
    /**
     * Screen height for debugging
     */
    screenHeight,
  };
} 