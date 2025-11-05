import { createContext, useContext, useState, useEffect } from 'react';
import { Appearance, ColorSchemeName, Platform, useColorScheme as useRNColorScheme, AppState, AppStateStatus } from 'react-native';
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
  
  // Use useColorScheme hook for better mobile support (recommended by React Native)
  // This hook automatically updates when system theme changes on mobile
  const systemColorSchemeFromHook = useRNColorScheme();
  
  // Fallback state for when hook doesn't work (web fallback)
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(
    systemColorSchemeFromHook || Appearance.getColorScheme() 
  );

  // Load theme preference from storage on mount
  // Wait for system color scheme to be available before initializing
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        console.log('🎨 Starting theme initialization...');
        const savedTheme = await getItem(THEME_PREFERENCE_KEY);
        
        // Prioritize hook value, then Appearance API, with proper fallback
        // Use hook value if available (mobile), otherwise use Appearance API
        const currentSystemScheme = systemColorSchemeFromHook || Appearance.getColorScheme();
        
        console.log('🎨 Theme initialization:');
        console.log('   - Saved theme preference:', savedTheme);
        console.log('   - Hook value:', systemColorSchemeFromHook);
        console.log('   - Appearance API value:', Appearance.getColorScheme());
        console.log('   - Current system scheme (resolved):', currentSystemScheme);
        console.log('   - Initial systemColorScheme state:', systemColorScheme);
        console.log('   - Platform:', Platform.OS);
        
        // Update system color scheme with the most reliable value
        if (currentSystemScheme) {
          setSystemColorScheme(currentSystemScheme);
        } else {
          // If both are null, default to light but log a warning
          console.warn('⚠️ Could not detect system color scheme, defaulting to light');
          setSystemColorScheme('light');
        }
        
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          console.log('🎨 Loading saved theme preference:', savedTheme);
          setThemeState(savedTheme as Theme);
        } else {
          console.log('🎨 No saved theme preference, using system default');
          // Default to system theme if no preference is saved
          setThemeState('system');
        }
        
        // Log final state for debugging
        const finalTheme = savedTheme && ['light', 'dark', 'system'].includes(savedTheme) 
          ? (savedTheme as Theme) 
          : 'system';
        const finalSystemScheme = currentSystemScheme || systemColorScheme;
        const finalIsDark = finalTheme === 'dark' || (finalTheme === 'system' && finalSystemScheme === 'dark');
        
        console.log('🎨 Theme initialization complete:', {
          theme: finalTheme,
          systemColorScheme: finalSystemScheme,
          isDark: finalIsDark,
          effectiveSystemScheme: systemColorSchemeFromHook || Appearance.getColorScheme()
        });
      } catch (error) {
        console.error('❌ Failed to load theme preference:', error);
        // Fallback to system theme on error
        setThemeState('system');
        const fallbackScheme = systemColorSchemeFromHook || Appearance.getColorScheme() || 'light';
        setSystemColorScheme(fallbackScheme);
      } finally {
        setIsLoading(false);
      }
    };

    // Wait a bit for the hook to initialize, especially on mobile
    // But don't wait too long as it should be available immediately
    const initTimer = setTimeout(() => {
      loadThemePreference();
    }, 50); // Small delay to ensure hook is ready

    return () => clearTimeout(initTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemColorSchemeFromHook]); // systemColorScheme is intentionally excluded to avoid infinite loop

  // Sync system color scheme from hook (mobile) or Appearance API (web fallback)
  // This ensures we always have the latest system theme value
  // Force update whenever hook value changes OR when state doesn't match hook
  useEffect(() => {
    // Prioritize hook value (more reliable on mobile), fallback to Appearance API
    const hookValue = systemColorSchemeFromHook;
    const appearanceValue = Appearance.getColorScheme();
    const currentScheme = hookValue || appearanceValue;
    
    // Force update if hook value exists and differs from state
    // OR if appearance value exists and differs from state
    if (hookValue && hookValue !== systemColorScheme) {
      console.log('🎨 System color scheme synced from hook:', {
        from: systemColorScheme,
        to: hookValue,
        source: 'hook',
        platform: Platform.OS
      });
      setSystemColorScheme(hookValue);
    } else if (!hookValue && appearanceValue && appearanceValue !== systemColorScheme) {
      console.log('🎨 System color scheme synced from Appearance API:', {
        from: systemColorScheme,
        to: appearanceValue,
        source: 'Appearance API',
        platform: Platform.OS
      });
      setSystemColorScheme(appearanceValue);
    } else if (!currentScheme && systemColorScheme !== 'light') {
      // If we can't detect but state isn't light, reset to detected value
      console.log('🎨 No system scheme detected, checking Appearance API');
      const detected = Appearance.getColorScheme();
      if (detected) {
        setSystemColorScheme(detected);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemColorSchemeFromHook]); // systemColorScheme is intentionally excluded to avoid infinite loop

  // Ensure system color scheme is properly detected on startup
  // This is a backup detection that runs after initial load
  // Also runs periodically to catch any missed updates
  useEffect(() => {
    if (isLoading) return; // Don't run during initial load
    
    const detectSystemScheme = () => {
      // Check all sources
      const hookValue = systemColorSchemeFromHook;
      const appearanceValue = Appearance.getColorScheme();
      const currentScheme = hookValue || appearanceValue;
      
      // Always update if we detect a different value
      if (currentScheme && currentScheme !== systemColorScheme) {
        console.log('🎨 Detecting system color scheme:', {
          detected: currentScheme,
          current: systemColorScheme,
          hookValue,
          appearanceValue,
          source: hookValue ? 'hook' : 'Appearance API',
          platform: Platform.OS
        });
        setSystemColorScheme(currentScheme);
      } else if (!currentScheme) {
        // If nothing detected, log for debugging
        console.warn('⚠️ System color scheme not detected:', {
          hookValue,
          appearanceValue,
          currentState: systemColorScheme,
          platform: Platform.OS
        });
      }
    };
    
    // Detect immediately if not loading
    detectSystemScheme();
    
    // Periodic check to catch any missed updates (especially on mobile)
    const intervalId = setInterval(detectSystemScheme, 1000);
    
    // Also detect after delays to ensure system is ready
    const timeout1 = setTimeout(detectSystemScheme, 100);
    const timeout2 = setTimeout(detectSystemScheme, 500);
    
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [systemColorSchemeFromHook, isLoading, systemColorScheme]);

  // Listen to system appearance changes (fallback for web or when hook doesn't update)
  // On mobile, useColorScheme hook automatically handles updates, but we keep this as fallback
  useEffect(() => {
    // On mobile, the hook should handle updates, but we keep the listener as backup
    // On web, we need the listener since the hook might not work as well
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const newScheme = colorScheme || 'light'; // Fallback to light if null
      
      // Use hook value if available, otherwise use listener value
      const effectiveScheme = systemColorSchemeFromHook || newScheme;
      
      console.log('🎨 System appearance changed:', {
        from: systemColorScheme,
        to: effectiveScheme,
        hookValue: systemColorSchemeFromHook,
        listenerValue: newScheme,
        currentTheme: theme,
        willBeDark: theme === 'dark' || (theme === 'system' && effectiveScheme === 'dark'),
        platform: Platform.OS
      });
      
      // Force update to the detected value
      if (effectiveScheme !== systemColorScheme) {
        setSystemColorScheme(effectiveScheme);
        console.log('🎨 System color scheme updated to:', effectiveScheme);
      }
    });

    return () => subscription?.remove();
  }, [theme, systemColorScheme, systemColorSchemeFromHook]); // Include hook value to track changes

  // Listen to app state changes to re-check theme when app comes to foreground
  // System theme might have changed while app was in background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground - force re-check system theme
        console.log('🎨 App came to foreground, re-checking system theme');
        
        // Force check all sources
        const hookValue = systemColorSchemeFromHook;
        const appearanceValue = Appearance.getColorScheme();
        const detected = hookValue || appearanceValue;
        
        if (detected && detected !== systemColorScheme) {
          console.log('🎨 System theme detected after foreground:', {
            detected,
            current: systemColorScheme,
            hookValue,
            appearanceValue,
            platform: Platform.OS
          });
          setSystemColorScheme(detected);
        } else if (detected) {
          console.log('🎨 System theme unchanged after foreground:', {
            detected,
            hookValue,
            appearanceValue
          });
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, [systemColorScheme, systemColorSchemeFromHook]);

  // Save theme preference to storage when it changes
  const setTheme = async (newTheme: Theme) => {
    try {
      // Get current system scheme for logging
      const currentSystemScheme = systemColorSchemeFromHook || Appearance.getColorScheme() || systemColorScheme;
      const willBeDark = newTheme === 'dark' || (newTheme === 'system' && currentSystemScheme === 'dark');
      
      console.log('🎨 Setting theme preference:', {
        from: theme,
        to: newTheme,
        currentSystemScheme: currentSystemScheme,
        systemColorSchemeState: systemColorScheme,
        willBeDark
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

  // Calculate isDark using the most up-to-date values
  // Always use hook value first, then state, then Appearance API as fallback
  const effectiveSystemScheme = systemColorSchemeFromHook || systemColorScheme || Appearance.getColorScheme();
  const isDark = theme === 'dark' || (theme === 'system' && effectiveSystemScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  // Additional debugging for system theme detection
  useEffect(() => {
    const hookValue = systemColorSchemeFromHook;
    const stateValue = systemColorScheme;
    const appearanceValue = Appearance.getColorScheme();
    const effective = effectiveSystemScheme;
    
    console.log('🎨 Theme calculation debug:', {
      theme,
      systemColorSchemeState: stateValue,
      systemColorSchemeHook: hookValue,
      systemColorSchemeAppearance: appearanceValue,
      effectiveSystemScheme: effective,
      isDark,
      calculation: {
        'theme === "dark"': theme === 'dark',
        'theme === "system"': theme === 'system',
        'effectiveSystemScheme === "dark"': effective === 'dark',
        'final isDark': isDark
      }
    });
  }, [theme, systemColorScheme, systemColorSchemeFromHook, effectiveSystemScheme, isDark]);

  // Debug function to help troubleshoot theme issues
  const debugTheme = () => {
    const hookValue = systemColorSchemeFromHook;
    const stateValue = systemColorScheme;
    const appearanceValue = Appearance.getColorScheme();
    const effective = effectiveSystemScheme;
    
    console.log('🔍 THEME DEBUG INFO:');
    console.log('   - Current theme setting:', theme);
    console.log('   - System color scheme (hook):', hookValue);
    console.log('   - System color scheme (state):', stateValue);
    console.log('   - System color scheme (Appearance API):', appearanceValue);
    console.log('   - Effective system scheme (used for calculation):', effective);
    console.log('   - Is dark mode:', isDark);
    console.log('   - Theme calculation:', {
      'theme === "dark"': theme === 'dark',
      'theme === "system"': theme === 'system',
      'effectiveSystemScheme === "dark"': effective === 'dark',
      'final isDark': isDark
    });
    console.log('   - Auto mode should follow system:', theme === 'system' ? 'YES' : 'NO');
    console.log('   - Expected behavior:', theme === 'system' ? `Follow ${effective || 'light'} mode` : `${theme} mode`);
  };

  // Log theme state changes for debugging
  useEffect(() => {
    console.log('🎨 Theme state changed:', {
      theme,
      systemColorSchemeState: systemColorScheme,
      systemColorSchemeHook: systemColorSchemeFromHook,
      effectiveSystemScheme: effectiveSystemScheme,
      isDark,
      appearanceApiValue: Appearance.getColorScheme()
    });
  }, [theme, systemColorScheme, systemColorSchemeFromHook, effectiveSystemScheme, isDark]);

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
