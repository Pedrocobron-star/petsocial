import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { computeHealthAlerts, type HealthAlert } from '@/lib/health-alerts';
import {
  fetchHealthSummary,
  fetchMyPets,
  fetchParasiteSummary,
  fetchPetSymptoms,
  qk,
} from '@/lib/queries';
import type { Pet } from '@/lib/types';

export interface PetAlert extends HealthAlert {
  pet: Pet;
}

/**
 * Agrega os lembretes/alertas de saúde de TODOS os pets do usuário num único
 * array ordenado por severidade. Reusado pela tela de Lembretes e pelo hub de
 * Notificações (categoria "Saúde").
 */
export function useHealthAlerts(userId: string | undefined): {
  alerts: PetAlert[];
  pets: Pet[];
  loading: boolean;
} {
  const petsQuery = useQuery({
    queryKey: userId ? qk.myPets(userId) : ['my-pets-noop'],
    queryFn: () => (userId ? fetchMyPets(userId) : Promise.resolve([])),
    enabled: !!userId,
  });
  const pets = useMemo(() => petsQuery.data ?? [], [petsQuery.data]);

  const summaries = useQueries({
    queries: pets.map((p) => ({ queryKey: qk.healthSummary(p.id), queryFn: () => fetchHealthSummary(p.id) })),
  });
  const parasites = useQueries({
    queries: pets.map((p) => ({ queryKey: qk.parasiteSummary(p.id), queryFn: () => fetchParasiteSummary(p.id) })),
  });
  const symptoms = useQueries({
    queries: pets.map((p) => ({ queryKey: qk.petSymptoms(p.id, 'active'), queryFn: () => fetchPetSymptoms(p.id, 'active') })),
  });

  const loading = petsQuery.isLoading || summaries.some((q) => q.isLoading);

  const alerts = useMemo(() => {
    const out: PetAlert[] = [];
    pets.forEach((pet, i) => {
      const summary = summaries[i]?.data;
      if (!summary) return;
      const computed = computeHealthAlerts({ pet, summary, symptoms: symptoms[i]?.data ?? [] });
      for (const a of computed) out.push({ ...a, pet });

      // Alertas de vermífugo/antipulga (vêm do parasiteSummary, não do computeHealthAlerts)
      const ps = parasites[i]?.data;
      if (ps?.next_due) {
        const d = ps.next_due.days_until;
        const name = ps.next_due.product_name;
        if (d < 0) {
          out.push({
            id: `parasite-${pet.id}`,
            severity: 'urgent',
            category: 'parasite',
            emoji: '🦟',
            title: `${name} atrasado ${Math.abs(d)}d`,
            description: 'Reaplique o antiparasitário',
            action: { label: 'Ver', href: `/pet/${pet.id}/parasites` },
            daysUntil: d,
            pet,
          });
        } else if (d <= 7) {
          out.push({
            id: `parasite-${pet.id}`,
            severity: 'warning',
            category: 'parasite',
            emoji: '💊',
            title: d === 0 ? `${name} vence hoje` : `${name} em ${d}d`,
            description: 'Programe a reaplicação',
            action: { label: 'Ver', href: `/pet/${pet.id}/parasites` },
            daysUntil: d,
            pet,
          });
        }
      }
    });
    const sev = { urgent: 0, warning: 1, info: 2 } as const;
    return out.sort((a, b) => {
      if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
      return (a.daysUntil ?? Infinity) - (b.daysUntil ?? Infinity);
    });
  }, [pets, summaries, parasites, symptoms]);

  return { alerts, pets, loading };
}
