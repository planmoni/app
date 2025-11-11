import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { getItem, saveItem, deleteItem } from '@/lib/secure-storage';

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
  primaryLight: '#C8A2FF',
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
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(() => {
    // Initialize immediately from Appearance API
    const scheme = Appearance.getColorScheme();
    console.log('🎨 Initial system color scheme:', scheme);
    return scheme || 'light';
  });

  // Load theme preference from storage on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        console.log('🎨 Loading theme preference...');
        
        // Get current system scheme and update state immediately
        const currentSystemScheme = Appearance.getColorScheme();
        const normalizedSystemScheme = currentSystemScheme || 'light';
        console.log('🎨 Current system scheme:', currentSystemScheme, '→ normalized:', normalizedSystemScheme);
        
        // Update system color scheme state immediately
        setSystemColorScheme(normalizedSystemScheme);
        
        // Load saved theme preference - only 'light' or 'dark' should be saved
        const savedTheme = await getItem(THEME_PREFERENCE_KEY);
        console.log('🎨 Saved theme preference:', savedTheme);
        
        // Only load 'light' or 'dark' from storage - 'system' is never saved
        if (savedTheme === 'light' || savedTheme === 'dark') {
          console.log('🎨 Setting theme from storage:', savedTheme);
          setThemeState(savedTheme as Theme);
        } else {
          // No saved preference or invalid value - default to system (Auto)
          console.log('🎨 No saved theme preference, defaulting to system (Auto)');
          setThemeState('system');
          
          // Clean up if 'system' was accidentally saved (shouldn't happen, but just in case)
          if (savedTheme === 'system') {
            console.log('🎨 Cleaning up: removing system from storage');
            try {
              await deleteItem(THEME_PREFERENCE_KEY);
            } catch (deleteError) {
              console.error('❌ Error removing system from storage:', deleteError);
            }
          }
        }
        
        console.log('🎨 Theme initialization complete');
      } catch (error) {
        console.error('❌ Error loading theme preference:', error);
        const currentSystemScheme = Appearance.getColorScheme() || 'light';
        setSystemColorScheme(currentSystemScheme);
        setThemeState('system');
      } finally {
        setIsLoading(false);
      }
    };

    loadThemePreference();
  }, []);

  // Listen to system appearance changes - CRITICAL for Auto theme
  useEffect(() => {
    console.log('🎨 Setting up appearance change listener');
    
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const newScheme = colorScheme || 'light';
      console.log('🎨 System appearance changed:', {
        from: systemColorScheme,
        to: newScheme,
        currentTheme: theme,
        willApplyDark: theme === 'dark' || (theme === 'system' && newScheme === 'dark')
      });
      
      // Always update system color scheme when device theme changes
      setSystemColorScheme(newScheme);
    });

    return () => {
      console.log('🎨 Removing appearance change listener');
      subscription.remove();
    };
  }, [theme, systemColorScheme]);

  // Ensure system color scheme is always up to date
  useEffect(() => {
    const updateSystemScheme = () => {
      const currentScheme = Appearance.getColorScheme();
      const normalizedScheme = currentScheme || 'light';
      
      if (normalizedScheme !== systemColorScheme) {
        console.log('🎨 Updating system color scheme:', {
          from: systemColorScheme,
          to: normalizedScheme
        });
        setSystemColorScheme(normalizedScheme);
      }
    };

    // Update immediately
    updateSystemScheme();
    
    // Also update after a short delay to catch any timing issues
    const timeoutId = setTimeout(updateSystemScheme, 50);
    
    return () => clearTimeout(timeoutId);
  }, []); // Run once on mount

  // Save theme preference to storage when it changes
  // Only save 'light' or 'dark' - never save 'system' (Auto mode)
  const setTheme = async (newTheme: Theme) => {
    try {
      console.log('🎨 Setting theme:', {
        from: theme,
        to: newTheme,
        currentSystemScheme: systemColorScheme,
        liveSystemScheme: Appearance.getColorScheme()
      });
      
      setThemeState(newTheme);
      
      // Only save 'light' or 'dark' to storage - never save 'system'
      if (newTheme === 'light' || newTheme === 'dark') {
        await saveItem(THEME_PREFERENCE_KEY, newTheme);
        console.log('✅ Theme saved to storage:', newTheme);
      } else if (newTheme === 'system') {
        // Auto mode selected - remove any saved preference to always follow system
        try {
          await deleteItem(THEME_PREFERENCE_KEY);
          console.log('✅ Auto mode selected - removed saved theme preference');
        } catch (deleteError) {
          console.error('❌ Error removing saved theme:', deleteError);
          // Not critical - continue anyway
        }
      }
    } catch (error) {
      console.error('❌ Error saving theme:', error);
      // Still update state even if save fails
      setThemeState(newTheme);
    }
  };

  // Calculate isDark - when theme is 'system', always check live system color scheme
  // This ensures Auto theme always follows the device's current setting
  const isDark = useMemo(() => {
    if (theme === 'dark') {
      return true;
    }
    
    if (theme === 'system') {
      // Always check live system color scheme for Auto theme
      const liveSystemScheme = Appearance.getColorScheme();
      const effectiveScheme = liveSystemScheme || systemColorScheme || 'light';
      const shouldBeDark = effectiveScheme === 'dark';
      
      console.log('🎨 Auto theme calculation:', {
        liveSystemScheme,
        systemColorSchemeState: systemColorScheme,
        effectiveScheme,
        shouldBeDark
      });
      
      return shouldBeDark;
    }
    
    // theme === 'light'
    return false;
  }, [theme, systemColorScheme]);

  const colors = useMemo(() => {
    return isDark ? darkColors : lightColors;
  }, [isDark]);

  // Debug function
  const debugTheme = () => {
    const liveSystemScheme = Appearance.getColorScheme();
    console.log('🔍 THEME DEBUG INFO:');
    console.log('   - Theme setting:', theme);
    console.log('   - System color scheme (state):', systemColorScheme);
    console.log('   - System color scheme (live):', liveSystemScheme);
    console.log('   - Is dark mode:', isDark);
    console.log('   - Calculation:', {
      'theme === "dark"': theme === 'dark',
      'theme === "system"': theme === 'system',
      'theme === "light"': theme === 'light',
      'liveSystemScheme === "dark"': liveSystemScheme === 'dark',
      'systemColorScheme === "dark"': systemColorScheme === 'dark',
      'final isDark': isDark
    });
  };

  // Log theme changes for debugging
  useEffect(() => {
    console.log('🎨 Theme state:', {
      theme,
      systemColorScheme,
      liveSystemScheme: Appearance.getColorScheme(),
      isDark,
      colors: isDark ? 'dark' : 'light'
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