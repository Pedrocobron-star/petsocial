/**
 * Error tracking — implementação caseira via tabela `app_errors` no Supabase.
 *
 * Por que não Sentry: `@sentry/react-native` quebra o Metro web bundler.
 * Por enquanto usamos solução interna leve: insere o erro na tabela
 * `app_errors` (RLS permite insert de qualquer user logado ou anon).
 * Admin (pedrocobron@gmail.com) consulta no dashboard `/admin/errors`.
 *
 * Quando reintegrar Sentry de verdade (depois do build nativo via EAS):
 *  1. `npm install @sentry/react-native`
 *  2. Reescrever este arquivo importando Sentry.init
 *  3. Configurar DSN via `EXPO_PUBLIC_SENTRY_DSN`
 *  4. Manter a função `captureError` com mesma assinatura — call sites não mudam.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from './supabase';

const isDev =
  typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

let currentUserId: string | null = null;

export function initSentry(): void {
  // Captura erros não tratados (web only — native usa ErrorBoundary)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      captureError(event.error ?? new Error(event.message), {
        tags: { source: 'window.onerror' },
      });
    });
    window.addEventListener('unhandledrejection', (event) => {
      captureError(event.reason ?? new Error('Unhandled promise rejection'), {
        tags: { source: 'unhandledrejection' },
      });
    });
  }
}

export function setSentryUser(userId: string | null): void {
  currentUserId = userId;
}

export function captureError(
  error: unknown,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
): void {
  if (isDev) {
    console.error('[errors] captureError', error, context);
  }

  // Best-effort — não bloqueia o app se falhar (network, RLS, etc)
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const route = typeof window !== 'undefined' ? window.location?.pathname : undefined;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
  const platform = Platform.OS;
  const appVersion = Constants.expoConfig?.version ?? 'unknown';

  supabase
    .from('app_errors')
    .insert({
      user_id: currentUserId,
      message: message.slice(0, 1000),
      stack: stack?.slice(0, 4000),
      route,
      user_agent: userAgent?.slice(0, 300),
      platform,
      app_version: appVersion,
      context: context as Record<string, unknown> | null,
    })
    .then(({ error: insertError }) => {
      if (insertError && isDev) {
        console.warn('[errors] insert failed', insertError);
      }
    });
}
