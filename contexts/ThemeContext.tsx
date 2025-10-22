import { createContext, useContext, useState, useEffect } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { getItem, saveItem } from '@/lib/secure-storage';

export type Theme = 'light' | 'dark' | 'system';

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  colors: typeof lightColors;
  debugTheme: () => void;
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
  accent: '#C3F57E',
  accentText: '#C3F57E',
  accentBackground: '#F8FCF4',
  accentBorder: '#C3F57E',
  
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
  accent: '#C3F57E',
  accentText: '#C3F57E',
  accentBackground: '#0E141F',
  accentBorder: '#fff',
  
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
    Appearance.getColorScheme() || 'light' // Fallback to light if null
  );

  // Load theme preference from storage on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await getItem(THEME_PREFERENCE_KEY);
        const currentSystemScheme = Appearance.getColorScheme() || 'light';
        
        console.log('🎨 Theme initialization:');
        console.log('   - Saved theme preference:', savedTheme);
        console.log('   - Current system scheme:', currentSystemScheme);
        console.log('   - Initial systemColorScheme state:', systemColorScheme);
        
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          console.log('🎨 Loading saved theme preference:', savedTheme);
          setThemeState(savedTheme as Theme);
        } else {
          console.log('🎨 No saved theme preference, using system default');
          // Default to system theme if no preference is saved
          setThemeState('system');
        }
        
        // Ensure system color scheme is up to date
        setSystemColorScheme(currentSystemScheme);
      } catch (error) {
        console.error('❌ Failed to load theme preference:', error);
        // Fallback to system theme on error
        setThemeState('system');
        setSystemColorScheme(Appearance.getColorScheme() || 'light');
      } finally {
        setIsLoading(false);
      }
    };

    loadThemePreference();
  }, []);

  // Ensure system color scheme is properly detected on startup
  useEffect(() => {
    const detectSystemScheme = () => {
      const currentScheme = Appearance.getColorScheme() || 'light';
      console.log('🎨 Detecting system color scheme:', currentScheme);
      setSystemColorScheme(currentScheme);
    };
    
    // Detect immediately
    detectSystemScheme();
    
    // Also detect after a short delay to ensure system is ready
    const timeoutId = setTimeout(detectSystemScheme, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // Listen to system appearance changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const newScheme = colorScheme || 'light'; // Fallback to light if null
      console.log('🎨 System appearance changed:', {
        from: systemColorScheme,
        to: newScheme,
        currentTheme: theme,
        willBeDark: theme === 'dark' || (theme === 'system' && newScheme === 'dark')
      });
      
      // Only update if the scheme actually changed
      if (newScheme !== systemColorScheme) {
        setSystemColorScheme(newScheme);
        console.log('🎨 System color scheme updated to:', newScheme);
      }
    });

    return () => subscription?.remove();
  }, [theme, systemColorScheme]); // Include systemColorScheme to properly track changes

  // Save theme preference to storage when it changes
  const setTheme = async (newTheme: Theme) => {
    try {
      console.log('🎨 Setting theme preference:', {
        from: theme,
        to: newTheme,
        currentSystemScheme: systemColorScheme,
        willBeDark: newTheme === 'dark' || (newTheme === 'system' && systemColorScheme === 'dark')
      });
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

  // Debug function to help troubleshoot theme issues
  const debugTheme = () => {
    const currentSystemScheme = Appearance.getColorScheme();
    console.log('🔍 THEME DEBUG INFO:');
    console.log('   - Current theme setting:', theme);
    console.log('   - System color scheme (state):', systemColorScheme);
    console.log('   - System color scheme (live):', currentSystemScheme);
    console.log('   - Is dark mode:', isDark);
    console.log('   - Theme calculation:', {
      'theme === "dark"': theme === 'dark',
      'theme === "system"': theme === 'system',
      'systemColorScheme === "dark"': systemColorScheme === 'dark',
      'currentSystemScheme === "dark"': currentSystemScheme === 'dark',
      'final isDark': isDark
    });
    console.log('   - Auto mode should follow system:', theme === 'system' ? 'YES' : 'NO');
    console.log('   - Expected behavior:', theme === 'system' ? `Follow ${currentSystemScheme || 'light'} mode` : `${theme} mode`);
  };

  // Log theme state changes for debugging
  useEffect(() => {
    console.log('🎨 Theme state changed:', {
      theme,
      systemColorScheme,
      isDark,
      currentSystemScheme: Appearance.getColorScheme()
    });
  }, [theme, systemColorScheme, isDark]);

  // Don't render until theme is loaded to prevent flash
  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, colors, debugTheme }}>
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
