import { useMemo, type ReactNode } from 'react';

import { APP_THEMES, type AppThemeKey } from '@/lib/app-themes';
import { ThemeContext, useTheme } from '@/providers/theme-provider';

/**
 * Injeta o accent de uma área de feature por cima do tema base, reusando 100%
 * do useTheme() existente. Envolva o conteúdo de uma tela (ou grupo de rota):
 *
 *   <AppThemeProvider app="health">
 *     <HealthHubInner />   // todo useTheme() aqui dentro enxerga theme.accent teal
 *   </AppThemeProvider>
 *
 * Só sobrescreve `theme.accent` — bg/surface/text/border/navegação ficam iguais.
 */
export function AppThemeProvider({ app, children }: { app: AppThemeKey; children: ReactNode }) {
  const base = useTheme();
  const isDark = base.theme.name === 'dark';
  const def = APP_THEMES[app] ?? APP_THEMES.default;
  const accent = isDark ? def.dark : def.light;

  const value = useMemo(
    () => ({ ...base, theme: { ...base.theme, accent } }),
    [base, accent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
