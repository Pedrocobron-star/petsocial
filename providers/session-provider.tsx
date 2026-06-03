import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { registerPushToken, unregisterPushToken } from '@/lib/push-notifications';
import { setSentryUser } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';

interface SessionContextValue {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      setSentryUser(data.session?.user?.id ?? null);
      // Registra push token se logado (best-effort, no-op no web)
      if (data.session?.user?.id) {
        registerPushToken(data.session.user.id).catch(() => {});
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSentryUser(next?.user?.id ?? null);
      if (next?.user?.id) {
        registerPushToken(next.user.id).catch(() => {});
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signUp: async (email, password, displayName) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        if (error) throw error;
      },
      signOut: async () => {
        // Remove push token antes do signOut pra parar notifs
        if (session?.user?.id) {
          await unregisterPushToken(session.user.id).catch(() => {});
        }
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession deve estar dentro de SessionProvider');
  return ctx;
}
