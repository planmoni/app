import { createContext, useContext, useState, useEffect } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { getItem, saveItem } from '@/lib/secure-storage';

export type Theme = 'light' | 'dark' | 'system';

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  colors: typeof lightColors;
};

// Storage key for theme preference
const THEME_PREFERENCE_KEY = 'theme_preference';

const lightColors = {
  // Background colors
  background: '#FFFFFF',
  backgroundSecondary: '#F8FAFC',
  backgroundTertiary: '#F1F5F9',
  backgroundBlack: '#F8FAFC',
  transactionLight: '#E2E8FF',
  iconBackground: '#EFF6FF',
  iconColor: '#203B8B',
  buttonPrimary: '#203B8B',
  buttonTextPrimary: '#203B8B',
  
  // Surface colors
  surface: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
  
  // Text colors
  text: '#1E293B',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',

  
  // Primary colors
  primary: '#1E3A8A',
  primaryLight: '#FAD923',
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
  backgroundSecondary: '#0E141F',
  transactionLight: '#687A9B',
  backgroundTertiary: '#0C2241',
  backgroundBlack: '#000',
  iconBackground: '#002964',
  iconColor: '#85A9DE',
  buttonPrimary: '#fff',
  buttonTextPrimary: '#fff',
  
  // Surface colors
  surface: '#0E141F',
  surfaceSecondary: '#0C2241',
  
  // Text colors
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textTertiary: '#94A3B8',
  
  // Primary colors
  primary: '#284BB2',
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
  border: '#29323E',
  borderSecondary: '#64748B',
  
  // Card colors
  card: '#040C19',
  cardSecondary: '#475569',
  
  // Tab bar
  tabBar: '#0E141F',
  tabBarBorder: '#475569',
  
  // Modal overlay
  overlay: 'rgba(0, 0, 0, 0.9)',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [isLoading, setIsLoading] = useState(true);
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );

  // Load theme preference from storage on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await getItem(THEME_PREFERENCE_KEY);
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          console.log('🎨 Loading saved theme preference:', savedTheme);
          setThemeState(savedTheme as Theme);
        } else {
          console.log('🎨 No saved theme preference, using system default');
        }
      } catch (error) {
        console.error('❌ Failed to load theme preference:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadThemePreference();
  }, []);

  // Listen to system appearance changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme);
    });

    return () => subscription?.remove();
  }, []);

  // Save theme preference to storage when it changes
  const setTheme = async (newTheme: Theme) => {
    try {
      console.log('🎨 Setting theme preference:', newTheme);
      setThemeState(newTheme);
      await saveItem(THEME_PREFERENCE_KEY, newTheme);
      console.log('✅ Theme preference saved successfully');
    } catch (error) {
      console.error('❌ Failed to save theme preference:', error);
      // Still update the state even if saving fails
      setThemeState(newTheme);
    }
  };

  const isDark = theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  // Don't render until theme is loaded to prevent flash
  if (isLoading) {
    return null;
  }

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
