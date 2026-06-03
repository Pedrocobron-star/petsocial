import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { fetchSubscription, qk } from '@/lib/queries';
import type { Subscription } from '@/lib/types';

import { useSession } from './session-provider';

interface SubscriptionContextValue {
  subscription: Subscription | null;
  isPro: boolean;
  isTrialing: boolean;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: userId ? qk.subscription(userId) : ['subscription', 'anon'],
    queryFn: () => fetchSubscription(userId!),
    enabled: !!userId,
    staleTime: 60_000, // 1 min — não muda muito
  });

  const value = useMemo<SubscriptionContextValue>(() => {
    const sub = query.data ?? null;
    const status = sub?.status ?? 'free';
    return {
      subscription: sub,
      isPro: status === 'active' || status === 'trialing',
      isTrialing: status === 'trialing',
      isLoading: query.isLoading,
      refetch: query.refetch,
    };
  }, [query.data, query.isLoading, query.refetch]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription deve estar dentro de SubscriptionProvider');
  return ctx;
}

/**
 * Hook simplificado pra checar se o user é Pro.
 * Uso: const isPro = useIsPro();
 */
export function useIsPro(): boolean {
  return useSubscription().isPro;
}
