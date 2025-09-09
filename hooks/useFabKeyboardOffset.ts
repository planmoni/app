import { useEffect, useRef, useState } from 'react';
import { Platform, Animated, Easing, Keyboard } from 'react-native';
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
}

export function useFabKeyboardOffset(options: UseFabKeyboardOffsetOptions = {}) {
  const {
    gap = 8, // Reduced from 8 to 4
    tabBarHeight = 0,
    animationDuration = 250,
  } = options;

  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [bottomOffset, setBottomOffset] = useState(insets.bottom + tabBarHeight);
  const animatedBottom = useRef(new Animated.Value(insets.bottom + tabBarHeight)).current;

  // Use native module if available, otherwise fallback to Keyboard API
  const softKeyboardOffset = useSoftKeyboardOffset ? useSoftKeyboardOffset() : 0;

  useEffect(() => {
    if (useSoftKeyboardOffset) {
      // Use react-native-avoid-softinput if available
      setKeyboardHeight(softKeyboardOffset);

      const finalBottom = softKeyboardOffset > 0 
        ? softKeyboardOffset + gap + insets.bottom
        : insets.bottom + tabBarHeight;

      setBottomOffset(finalBottom);
    } else {
      // Fallback to standard Keyboard API
      const keyboardWillShow = (event: any) => {
        const height = event.endCoordinates?.height || 0;
        setKeyboardHeight(height);
        
        const finalBottom = height > 0 
          ? height + gap + insets.bottom
          : insets.bottom + tabBarHeight;

        setBottomOffset(finalBottom);
      };

      const keyboardWillHide = () => {
        setKeyboardHeight(0);
        
        const finalBottom = insets.bottom + tabBarHeight;
        setBottomOffset(finalBottom);
      };

      const showListener = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideListener = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

      const keyboardWillShowListener = Keyboard.addListener(showListener, keyboardWillShow);
      const keyboardWillHideListener = Keyboard.addListener(hideListener, keyboardWillHide);

      return () => {
        keyboardWillShowListener.remove();
        keyboardWillHideListener.remove();
      };
    }
  }, [softKeyboardOffset, insets.bottom, gap, tabBarHeight]);

  // Animate when bottomOffset changes
  useEffect(() => {
    Animated.timing(animatedBottom, {
      toValue: bottomOffset,
      duration: animationDuration,
      easing: Platform.OS === 'ios' 
        ? Easing.bezier(0.17, 0.59, 0.4, 0.77)
        : Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [bottomOffset, animationDuration]);

  return {
    /**
     * Current bottom offset (no animation for now)
     */
    bottomOffset,
    /**
     * Current keyboard height
     */
    keyboardHeight,
    /**
     * Whether keyboard is currently visible
     */
    isKeyboardVisible: keyboardHeight > 0,
    /**
     * Safe area bottom inset
     */
    safeAreaBottom: insets.bottom,
  };
} 