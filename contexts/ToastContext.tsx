import React, { createContext, useContext, useState, ReactNode } from 'react';
import Toast from '@/components/Toast';
import { useHaptics } from '@/hooks/useHaptics';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastContextType = {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('info');
  const [duration, setDuration] = useState(3000);
  const haptics = useHaptics();

  const showToast = (
    message: string,
    type: ToastType = 'info',
    duration: number = 3000
  ) => {
    setMessage(message);
    setType(type);
    setDuration(duration);
    setVisible(true);
    
    // Trigger appropriate haptic feedback based on toast type
    if (Platform.OS !== 'web') {
      switch (type) {
        case 'success':
          haptics.notification(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          haptics.notification(Haptics.NotificationFeedbackType.Error);
          break;
        case 'warning':
          haptics.notification(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'info':
          haptics.selection();
          break;
      }
    }
  };

  const hideToast = () => {
    setVisible(false);
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <Toast
        visible={visible}
        message={message}
        type={type}
        duration={duration}
        onDismiss={hideToast}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}