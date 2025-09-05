import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react-native';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, options?: Partial<ToastMessage>) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  hideToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { colors } = useTheme();

  const showToast = useCallback((
    message: string, 
    type: ToastType = 'info',
    options: Partial<ToastMessage> = {}
  ) => {
    const id = Date.now().toString();
    const toast: ToastMessage = {
      id,
      type,
      title: message,
      message: options.message,
      duration: options.duration || (type === 'error' ? 5000 : 3000),
      persistent: options.persistent || false,
      ...options
    };

    setToasts(prev => [...prev, toast]);

    // Auto-hide toast after duration
    if (!toast.persistent) {
      setTimeout(() => {
        hideToast(id);
      }, toast.duration);
    }
  }, []);

  const showSuccess = useCallback((message: string, title?: string) => {
    showToast(message, 'success', { title });
  }, [showToast]);

  const showError = useCallback((message: string, title?: string) => {
    showToast(message, 'error', { title });
  }, [showToast]);

  const showWarning = useCallback((message: string, title?: string) => {
    showToast(message, 'warning', { title });
  }, [showToast]);

  const showInfo = useCallback((message: string, title?: string) => {
    showToast(message, 'info', { title });
  }, [showToast]);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} color="#22C55E" />;
      case 'error':
        return <AlertCircle size={20} color="#EF4444" />;
      case 'warning':
        return <AlertTriangle size={20} color="#F59E0B" />;
      case 'info':
        return <Info size={20} color="#3B82F6" />;
    }
  };

  const getToastColors = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          background: '#DCFCE7',
          border: '#22C55E',
          text: '#166534'
        };
      case 'error':
        return {
          background: '#FEE2E2',
          border: '#EF4444',
          text: '#991B1B'
        };
      case 'warning':
        return {
          background: '#FEF3C7',
          border: '#F59E0B',
          text: '#92400E'
        };
      case 'info':
        return {
          background: '#DBEAFE',
          border: '#3B82F6',
          text: '#1E40AF'
        };
    }
  };

  return (
    <ToastContext.Provider value={{
      showToast,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      hideToast,
      clearAllToasts
    }}>
      {children}
      
      {/* Toast Container */}
      <View style={styles.toastContainer}>
        {toasts.map((toast) => {
          const toastColors = getToastColors(toast.type);
          return (
            <View
              key={toast.id}
              style={[
                styles.toast,
                {
                  backgroundColor: toastColors.background,
                  borderColor: toastColors.border,
                }
              ]}
            >
              <View style={styles.toastContent}>
                <View style={styles.toastIcon}>
                  {getToastIcon(toast.type)}
                </View>
                <View style={styles.toastText}>
                  <Text style={[styles.toastTitle, { color: toastColors.text }]}>
                    {toast.title}
                  </Text>
                  {toast.message && (
                    <Text style={[styles.toastMessage, { color: toastColors.text }]}>
                      {toast.message}
                    </Text>
                  )}
                </View>
                <View style={styles.toastClose}>
                  <X 
                    size={16} 
                    color={toastColors.text}
                    onPress={() => hideToast(toast.id)}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  toastIcon: {
    marginRight: 12,
  },
  toastText: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: 14,
    opacity: 0.8,
  },
  toastClose: {
    marginLeft: 12,
  },
});