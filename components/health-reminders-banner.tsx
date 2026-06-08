import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Dimensions, Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { FEED_CARD_MARGIN, MAX_FEED_WIDTH } from '@/lib/layout';
import {
  fetchHealthSummary,
  fetchParasiteSummary,
  qk,
  type ParasiteSummary,
} from '@/lib/queries';
import type { HealthSummary, Pet } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';

interface Alert {
  emoji: string;
  text: string;
  tone: 'urgent' | 'warn';
  href: string;
  /** Menor = mais urgente (pra ordenar entre todos os pets). */
  score: number;
}

/** Calcula o alerta mais urgente de UM pet (mesma cascata de prioridade). */
function buildAlert(
  pet: Pet,
  summary: HealthSummary | undefined,
  parasite: ParasiteSummary | undefined,
): Alert | null {
  if (!summary) return null;
  const v = summary.next_vaccine;
  const p = parasite?.next_due;

  if (v && v.days_until <= 0) {
    return {
      emoji: '⚠️',
      text: `Vacina ${v.name} de ${pet.name} venceu!`,
      tone: 'urgent',
      href: `/pet/${pet.id}/vaccinations`,
      score: -1000 + v.days_until,
    };
  }
  if (p && p.days_until < 0) {
    return {
      emoji: '⚠️',
      text: `${p.product_name} de ${pet.name} atrasado ${Math.abs(p.days_until)}d`,
      tone: 'urgent',
      href: `/pet/${pet.id}/parasites`,
      score: -900 + p.days_until,
    };
  }
  if (v && v.days_until <= 3) {
    return {
      emoji: '🔔',
      text: `${v.name} de ${pet.name} em ${v.days_until} dia${v.days_until === 1 ? '' : 's'}`,
      tone: 'warn',
      href: `/pet/${pet.id}/vaccinations`,
      score: 100 + v.days_until,
    };
  }
  if (p && p.days_until <= 3) {
    return {
      emoji: '💊',
      text:
        p.days_until === 0
          ? `${p.product_name} de ${pet.name} vence hoje`
          : `${p.product_name} de ${pet.name} em ${p.days_until} dia${p.days_until === 1 ? '' : 's'}`,
      tone: 'warn',
      href: `/pet/${pet.id}/parasites`,
      score: 200 + p.days_until,
    };
  }
  if (summary.due_medications_today > 0) {
    const n = summary.due_medications_today;
    return {
      emoji: '🧪',
      text: `${n} dose${n === 1 ? '' : 's'} de ${pet.name} pendente${n === 1 ? '' : 's'} hoje`,
      tone: 'warn',
      href: `/pet/${pet.id}/health`,
      score: 300,
    };
  }
  return null;
}

/**
 * Banner global no feed com o cuidado de saúde mais urgente — agora varrendo
 * TODOS os pets do tutor (não só o ativo), pra não deixar passar uma vacina de
 * outro pet. Mostra o #1 e quantos outros pets têm pendência.
 */
export function HealthRemindersBanner() {
  const { pets } = useActivePet();

  const healthQueries = useQueries({
    queries: pets.map((p) => ({
      queryKey: qk.healthSummary(p.id),
      queryFn: () => fetchHealthSummary(p.id),
      staleTime: 2 * 60_000,
    })),
  });
  const parasiteQueries = useQueries({
    queries: pets.map((p) => ({
      queryKey: qk.parasiteSummary(p.id),
      queryFn: () => fetchParasiteSummary(p.id),
      staleTime: 2 * 60_000,
    })),
  });

  const alerts: Alert[] = pets
    .map((p, i) => buildAlert(p, healthQueries[i]?.data, parasiteQueries[i]?.data))
    .filter((a): a is Alert => a !== null)
    .sort((a, b) => a.score - b.score);

  if (alerts.length === 0) return null;
  const alert = alerts[0];
  const others = alerts.length - 1;

  const SCREEN_W = Dimensions.get('window').width;
  const width = Math.min(SCREEN_W - FEED_CARD_MARGIN * 2, MAX_FEED_WIDTH);

  return (
    <Link href={alert.href as never} asChild>
      <Pressable
        style={{
          width,
          alignSelf: 'center',
          marginTop: 12,
          backgroundColor: alert.tone === 'urgent' ? '#FEE2E2' : '#FEF3C7',
          borderRadius: 14,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: alert.tone === 'urgent' ? '#FECACA' : '#FDE68A',
        }}
      >
        <Text style={{ fontSize: 22 }}>{alert.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 13,
              color: alert.tone === 'urgent' ? '#991B1B' : '#92400E',
            }}
          >
            {alert.text}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: alert.tone === 'urgent' ? '#7F1D1D' : '#78350F',
              marginTop: 2,
            }}
          >
            {others > 0
              ? `+${others} pendência${others === 1 ? '' : 's'} em outros pets · toque pra ver`
              : 'Toque pra ver os detalhes'}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={alert.tone === 'urgent' ? '#991B1B' : '#92400E'}
        />
      </Pressable>
    </Link>
  );
}
