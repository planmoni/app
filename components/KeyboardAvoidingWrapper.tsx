import React, { ReactNode } from 'react';
import { 
  KeyboardAvoidingView, 
  ScrollView, 
  Platform, 
  StyleSheet, 
  View,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingViewProps
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type KeyboardAvoidingWrapperProps = {
  children: ReactNode;
  contentContainerStyle?: any;
  avoidingViewStyle?: any;
  behavior?: KeyboardAvoidingViewProps['behavior'];
  keyboardVerticalOffset?: number;
  disableScrollView?: boolean;
  disableDismissKeyboard?: boolean;
};

/**
 * A wrapper component that handles keyboard avoiding behavior for forms
 * and input fields, ensuring they remain visible when the keyboard is open.
 */
export default function KeyboardAvoidingWrapper({
  children,
  contentContainerStyle,
  avoidingViewStyle,
  behavior = Platform.OS === 'ios' ? 'padding' : 'height',
  keyboardVerticalOffset = 0,
  disableScrollView = false,
  disableDismissKeyboard = false
}: KeyboardAvoidingWrapperProps) {
  const insets = useSafeAreaInsets();
  
  // Calculate the bottom padding to account for the safe area
  const bottomPadding = Platform.OS === 'ios' ? insets.bottom : 0;
  
  // Wrap content in TouchableWithoutFeedback to dismiss keyboard on outside tap
  const content = disableDismissKeyboard ? (
    children
  ) : (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      {children}
    </TouchableWithoutFeedback>
  );
  
  // If ScrollView is disabled, just return the KeyboardAvoidingView
  if (disableScrollView) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, avoidingViewStyle]}
        behavior={behavior}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }
  
  // Default implementation with ScrollView
  return (
    <KeyboardAvoidingView
      style={[styles.container, avoidingViewStyle]}
      behavior={behavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer, 
          { paddingBottom: 20 + bottomPadding },
          contentContainerStyle
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
});