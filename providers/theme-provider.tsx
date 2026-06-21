import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme, type ThemeMode } from '@/lib/theme';

const STORAGE_KEY = 'petsocial:theme-mode';

export interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  // Padrão = CLARO (fundo branco). O modo escuro é opt-in nas Configurações —
  // não seguir o 'system' automático, pra não deixar o app preto sem o usuário pedir.
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<ThemeContextValue>(() => {
    const resolved = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
    const theme = resolved === 'dark' ? darkTheme : lightTheme;
    return { theme, mode, setMode };
  }, [mode, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve estar dentro de ThemeProvider');
  return ctx;
}
