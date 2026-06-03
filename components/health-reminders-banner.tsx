import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Dimensions, Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { FEED_CARD_MARGIN, MAX_FEED_WIDTH } from '@/lib/layout';
import { fetchHealthSummary, fetchParasiteSummary, qk } from '@/lib/queries';
import { useActivePet } from '@/providers/active-pet-provider';

/**
 * Banner global no feed que mostra alertas críticos de saúde do pet ativo:
 * vacinas vencidas, antiparasitários atrasados, próximas em 3 dias, doses pendentes hoje.
 */
export function HealthRemindersBanner() {
  const { activePet } = useActivePet();
  const query = useQuery({
    queryKey: activePet ? qk.healthSummary(activePet.id) : ['health-summary', 'none'],
    queryFn: () => fetchHealthSummary(activePet!.id),
    enabled: !!activePet,
  });
  const parasiteQuery = useQuery({
    queryKey: activePet ? qk.parasiteSummary(activePet.id) : ['parasite-summary', 'none'],
    queryFn: () => fetchParasiteSummary(activePet!.id),
    enabled: !!activePet,
  });

  const summary = query.data;
  const parasiteSummary = parasiteQuery.data;
  if (!summary || !activePet) return null;

  // Decide qual lembrete mostrar (prioriza o mais urgente)
  // Ordem: vacina atrasada > parasita atrasado > vacina em 3d > parasita em 3d > remédio hoje
  let alert: { emoji: string; text: string; tone: 'urgent' | 'warn'; href: string } | null = null;

  const healthHref = `/pet/${activePet.id}/health`;
  const parasitesHref = `/pet/${activePet.id}/parasites`;

  if (summary.next_vaccine) {
    const d = summary.next_vaccine.days_until;
    if (d <= 0) {
      alert = {
        emoji: '⚠️',
        text: `Vacina ${summary.next_vaccine.name} de ${activePet.name} venceu!`,
        tone: 'urgent',
        href: `/pet/${activePet.id}/vaccinations`,
      };
    }
  }

  // Parasitas atrasados (urgent)
  if (!alert && parasiteSummary?.next_due) {
    const d = parasiteSummary.next_due.days_until;
    if (d < 0) {
      alert = {
        emoji: '⚠️',
        text: `${parasiteSummary.next_due.product_name} de ${activePet.name} atrasado ${Math.abs(d)}d`,
        tone: 'urgent',
        href: parasitesHref,
      };
    }
  }

  // Vacina vence em 3d (warn)
  if (!alert && summary.next_vaccine) {
    const d = summary.next_vaccine.days_until;
    if (d <= 3) {
      alert = {
        emoji: '🔔',
        text: `${summary.next_vaccine.name} de ${activePet.name} em ${d} dia${d === 1 ? '' : 's'}`,
        tone: 'warn',
        href: `/pet/${activePet.id}/vaccinations`,
      };
    }
  }

  // Parasita vence em 3d (warn)
  if (!alert && parasiteSummary?.next_due) {
    const d = parasiteSummary.next_due.days_until;
    if (d <= 3) {
      alert = {
        emoji: '💊',
        text:
          d === 0
            ? `${parasiteSummary.next_due.product_name} vence hoje`
            : `${parasiteSummary.next_due.product_name} em ${d} dia${d === 1 ? '' : 's'}`,
        tone: 'warn',
        href: parasitesHref,
      };
    }
  }

  if (!alert && summary.due_medications_today > 0) {
    alert = {
      emoji: '🧪',
      text: `${summary.due_medications_today} dose${summary.due_medications_today === 1 ? '' : 's'} de remédio pendente${summary.due_medications_today === 1 ? '' : 's'} hoje`,
      tone: 'warn',
      href: healthHref,
    };
  }

  if (!alert) return null;

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
            Toque pra ver os detalhes
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
