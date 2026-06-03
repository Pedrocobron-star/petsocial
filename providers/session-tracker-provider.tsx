import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useSession } from './session-provider';

/**
 * SessionTrackerProvider — mantém `user_sessions` no Supabase em sincronia.
 *
 * Comportamento:
 *  1. Quando o usuário fica logado: chama RPC `start_session(platform)` e
 *     guarda o id em memória.
 *  2. Loop de heartbeat a cada 60s pra evitar sessions zumbi (caso o user
 *     feche o browser sem trigger de unmount).
 *  3. Em background/blur (mobile) e em beforeunload (web): chama
 *     `end_session(id)`.
 *  4. Quando o usuário desloga: encerra session ativa.
 *
 * Tudo é fire-and-forget — se a RPC falhar, segue sem quebrar UX.
 *
 * Sessions excessivamente curtas (<5s) ou longas (>4h) são ignoradas no
 * cálculo de avg_session_seconds via filtro na própria query admin.
 */

const HEARTBEAT_INTERVAL_MS = 60_000;

export function SessionTrackerProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const sessionIdRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Inicia/encerra session conforme login state
  useEffect(() => {
    if (!userId) {
      // Garante encerramento se existia
      const sid = sessionIdRef.current;
      if (sid) {
        sessionIdRef.current = null;
        void endSessionSafe(sid);
      }
      return;
    }

    // Abre nova session
    let cancelled = false;
    (async () => {
      const id = await startSessionSafe();
      if (cancelled) {
        if (id) void endSessionSafe(id);
        return;
      }
      sessionIdRef.current = id;
    })();

    // Heartbeat loop
    heartbeatRef.current = setInterval(() => {
      const sid = sessionIdRef.current;
      if (sid) void heartbeatSafe(sid);
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      const sid = sessionIdRef.current;
      sessionIdRef.current = null;
      if (sid) void endSessionSafe(sid);
    };
  }, [userId]);

  // Mobile: pausa session quando vai pra background
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      if (state === 'background' || state === 'inactive') {
        void endSessionSafe(sid);
        sessionIdRef.current = null;
      } else if (state === 'active' && userId) {
        // Volta do background — abre nova session
        void startSessionSafe().then((id) => {
          sessionIdRef.current = id;
        });
      }
    });
    return () => sub.remove();
  }, [userId]);

  // Web: encerra session no beforeunload
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handler = () => {
      const sid = sessionIdRef.current;
      if (sid) {
        // sendBeacon não dá pra usar com supabase-js facilmente; o trigger via
        // RPC normal funciona em maioria dos casos (browsers seguram alguns ms).
        void endSessionSafe(sid);
      }
    };
    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
    };
  }, []);

  return <>{children}</>;
}

// ----------------------------------------------------------------------------
// Helpers (silenciam todos os erros — analytics nunca quebra UX)
// ----------------------------------------------------------------------------

async function startSessionSafe(): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('start_session', {
      p_platform: Platform.OS,
    });
    if (error || !data) return null;
    return data as string;
  } catch {
    return null;
  }
}

async function endSessionSafe(sessionId: string): Promise<void> {
  try {
    await supabase.rpc('end_session', { p_session_id: sessionId });
  } catch {
    // ignora
  }
}

async function heartbeatSafe(sessionId: string): Promise<void> {
  try {
    await supabase.rpc('heartbeat_session', { p_session_id: sessionId });
  } catch {
    // ignora
  }
}
