import { View, StyleSheet, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

type SafeFloatingButtonProps = {
  children: React.ReactNode;
  backgroundColor?: string;
  borderTopWidth?: number;
  borderTopColor?: string;
  keyboardAware?: boolean;
};

export default function SafeFloatingButton({
  children,
  backgroundColor,
  borderTopWidth,
  borderTopColor,
  keyboardAware = true,
}: SafeFloatingButtonProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  useEffect(() => {
    if (!keyboardAware) return;
    
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [keyboardAware]);

  // Calculate bottom padding based on platform and keyboard state
  const getBottomPadding = () => {
    if (Platform.OS === 'ios') {
      return keyboardVisible ? keyboardHeight : insets.bottom || 16;
    } else {
      // On Android, we need to handle this differently
      return keyboardVisible ? 0 : insets.bottom || 16;
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: getBottomPadding(),
          backgroundColor: backgroundColor || colors.surface,
          borderTopWidth: borderTopWidth !== undefined ? borderTopWidth : 1,
          borderTopColor: borderTopColor || colors.border,
          // On Android, when keyboard is visible, position the button at the bottom of the visible area
          ...(Platform.OS === 'android' && keyboardVisible && {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
          }),
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 16,
    paddingTop: 16,
  },
});