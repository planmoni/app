import { createContext, useContext, useState, useEffect } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';

export type Theme = 'light' | 'dark' | 'system';

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  colors: typeof lightColors;
};

const lightColors = {
  // Background colors
  background: '#FFFFFF',
  backgroundSecondary: '#F8FAFC',
  backgroundTertiary: '#F1F5F9',
  
  // Surface colors
  surface: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
  
  // Text colors
  text: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  
  // Primary colors
  primary: '#1E3A8A',
  primaryLight: '#3B82F6',
  primaryDark: '#1E40AF',
  
  // Status colors
  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  
  // Border colors
  border: '#E2E8F0',
  borderSecondary: '#CBD5E1',
  
  // Card colors
  card: '#FFFFFF',
  cardSecondary: '#F8FAFC',
  
  // Tab bar
  tabBar: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  
  // Modal overlay
  overlay: 'rgba(15, 23, 42, 0.8)',
};

const darkColors = {
  // Background colors
  background: '#0F172A',
  backgroundSecondary: '#1E293B',
  backgroundTertiary: '#334155',
  
  // Surface colors
  surface: '#1E293B',
  surfaceSecondary: '#334155',
  
  // Text colors
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textTertiary: '#94A3B8',
  
  // Primary colors
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryDark: '#2563EB',
  
  // Status colors
  success: '#22C55E',
  successLight: '#166534',
  warning: '#F59E0B',
  warningLight: '#92400E',
  error: '#EF4444',
  errorLight: '#991B1B',
  
  // Border colors
  border: '#475569',
  borderSecondary: '#64748B',
  
  // Card colors
  card: '#334155',
  cardSecondary: '#475569',
  
  // Tab bar
  tabBar: '#1E293B',
  tabBarBorder: '#475569',
  
  // Modal overlay
  overlay: 'rgba(0, 0, 0, 0.9)',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme);
    });

    return () => subscription?.remove();
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}