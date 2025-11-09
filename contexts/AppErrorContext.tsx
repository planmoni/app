import React, { createContext, useContext, useState } from 'react';

type AppErrorState = {
  message?: string | null;
  fatal?: boolean;
};

type AppErrorContextValue = {
  appError: AppErrorState | null;
  setError: (message: string, fatal?: boolean) => void;
  clearError: () => void;
};

const AppErrorContext = createContext<AppErrorContextValue | undefined>(undefined);

export const AppErrorProvider: React.FC<React.PropsWithChildren<Record<string, unknown>>> = ({ children }) => {
  const [appError, setAppError] = useState<AppErrorState | null>(null);

  const setError = (message: string, fatal = false) => {
    setAppError({ message, fatal });
    if (fatal) {
      // Also log fatal errors to console for diagnostics
      console.error('AppErrorProvider - fatal error:', message);
    } else {
      console.warn('AppErrorProvider - non-fatal error:', message);
    }
  };

  const clearError = () => setAppError(null);

  return (
    <AppErrorContext.Provider value={{ appError, setError, clearError }}>
      {children}
    </AppErrorContext.Provider>
  );
};

export function useAppError() {
  const ctx = useContext(AppErrorContext);
  if (!ctx) throw new Error('useAppError must be used within AppErrorProvider');
  return ctx;
}

export default AppErrorProvider;
