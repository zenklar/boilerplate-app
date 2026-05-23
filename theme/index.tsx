import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const lightColors = {
  // Backgrounds — light uses Apple's system grouped background (#F2F2F7) so cards pop white
  background: '#F2F2F7',
  backgroundSecondary: '#E5E5EA',
  surface: '#FFFFFF',
  surfaceSecondary: '#F2F2F7',
  text: '#000000',
  textSecondary: '#3C3C43',
  textMuted: '#8E8E93',
  border: '#D1D1D6',
  borderFocused: '#007AFF',
  primary: '#007AFF',
  primaryText: '#FFFFFF',
  danger: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
  separator: '#D1D1D6',
  tabBarBackground: '#F8F8FA',
  tabBarBorder: '#D1D1D6',
  tabBarActive: '#007AFF',
  tabBarInactive: '#8E8E93',
  headerBackground: '#F8F8FA',
  headerBorder: '#D1D1D6',
  inputBackground: '#FFFFFF',
  inputText: '#000000',
  inputPlaceholder: '#C7C7CC',
  card: '#FFFFFF',
  cardBorder: '#E0E0E5',
};

const darkColors: typeof lightColors = {
  background: '#111113',
  backgroundSecondary: '#1C1C1E',
  surface: '#1C1C1E',
  surfaceSecondary: '#2C2C2E',
  text: '#FFFFFF',
  textSecondary: '#EBEBF5',
  textMuted: '#8E8E93',
  border: '#38383A',
  borderFocused: '#0A84FF',
  primary: '#0A84FF',
  primaryText: '#FFFFFF',
  danger: '#FF453A',
  success: '#32D74B',
  warning: '#FF9F0A',
  separator: '#38383A',
  tabBarBackground: '#1C1C1E',
  tabBarBorder: '#2C2C2E',
  tabBarActive: '#0A84FF',
  tabBarInactive: '#636366',
  headerBackground: '#1C1C1E',
  headerBorder: '#2C2C2E',
  inputBackground: '#2C2C2E',
  inputText: '#FFFFFF',
  inputPlaceholder: '#636366',
  card: '#1C1C1E',
  cardBorder: '#38383A',
};

// Gradient tuples for use with expo-linear-gradient
const lightGradients = {
  primary: ['#1A8FFF', '#0055CC'] as [string, string],
  avatar: ['#5AC8FA', '#007AFF'] as [string, string],
  danger: ['#FF5C52', '#FF3B30'] as [string, string],
  card: ['#FFFFFF', '#F7F7FB'] as [string, string],
  header: ['#FAFAFE', '#F2F2F7'] as [string, string],
  tabBar: ['#F5F5FA', '#F8F8FA'] as [string, string],
  screen: ['#FAFAFE', '#F2F2F7'] as [string, string],
};

const darkGradients: typeof lightGradients = {
  primary: ['#1A8FFF', '#0055CC'] as [string, string],
  avatar: ['#5AC8FA', '#0A84FF'] as [string, string],
  danger: ['#FF6058', '#FF453A'] as [string, string],
  card: ['#2C2C2E', '#252527'] as [string, string],
  header: ['#252527', '#1C1C1E'] as [string, string],
  tabBar: ['#252527', '#1C1C1E'] as [string, string],
  screen: ['#1A1A1D', '#111113'] as [string, string],
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const fontSize = { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, xl: 20, full: 9999 } as const;

export type Colors = typeof lightColors;
export type Gradients = typeof lightGradients;
export type Theme = {
  mode: ResolvedTheme;
  colors: Colors;
  gradients: Gradients;
  spacing: typeof spacing;
  fontSize: typeof fontSize;
  radius: typeof radius;
};

type ThemeContextType = {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);
const THEME_KEY = '@boilerplate/theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === 'light' || val === 'dark' || val === 'system') {
        setThemeModeState(val);
      }
      setLoaded(true);
    });
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_KEY, mode);
  };

  const resolvedSystem: ResolvedTheme = systemScheme === 'dark' ? 'dark' : 'light';
  const resolved: ResolvedTheme =
    themeMode === 'system' ? resolvedSystem : themeMode;

  const theme: Theme = {
    mode: resolved,
    colors: resolved === 'dark' ? darkColors : lightColors,
    gradients: resolved === 'dark' ? darkGradients : lightGradients,
    spacing,
    fontSize,
    radius,
  };

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
