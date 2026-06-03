import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { fetchMyPets, qk } from '@/lib/queries';
import type { Pet } from '@/lib/types';

import { useSession } from './session-provider';

const STORAGE_KEY = 'petsocial:active-pet-id';

interface ActivePetContextValue {
  pets: Pet[];
  activePet: Pet | null;
  setActivePet: (id: string) => void;
  loading: boolean;
  refetch: () => Promise<unknown>;
}

const ActivePetContext = createContext<ActivePetContextValue | undefined>(undefined);

export function ActivePetProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: pets, isLoading, refetch } = useQuery({
    queryKey: userId ? qk.myPets(userId) : ['my-pets', 'anon'],
    queryFn: () => fetchMyPets(userId!),
    enabled: !!userId,
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((id) => setActiveId(id));
  }, []);

  useEffect(() => {
    if (!pets || pets.length === 0) return;
    if (!activeId || !pets.find((p) => p.id === activeId)) {
      const fallback = pets[0].id;
      setActiveId(fallback);
      AsyncStorage.setItem(STORAGE_KEY, fallback);
    }
  }, [pets, activeId]);

  const value = useMemo<ActivePetContextValue>(
    () => ({
      pets: pets ?? [],
      activePet: pets?.find((p) => p.id === activeId) ?? null,
      setActivePet: (id) => {
        setActiveId(id);
        AsyncStorage.setItem(STORAGE_KEY, id);
      },
      loading: isLoading,
      refetch,
    }),
    [pets, activeId, isLoading, refetch],
  );

  return <ActivePetContext.Provider value={value}>{children}</ActivePetContext.Provider>;
}

export function useActivePet() {
  const ctx = useContext(ActivePetContext);
  if (!ctx) throw new Error('useActivePet deve estar dentro de ActivePetProvider');
  return ctx;
}
