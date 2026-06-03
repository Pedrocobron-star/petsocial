import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { differenceInMonths, parseISO } from 'date-fns';

import { FONTS } from '@/lib/fonts';
import type { ParasiteSummary } from '@/lib/queries';
import type { HealthSummary } from '@/lib/types';

interface Props {
  petName: string;
  summary: HealthSummary;
  parasiteSummary: ParasiteSummary | undefined;
}

interface BreakdownItem {
  label: string;
  emoji: string;
  status: 'ok' | 'warn' | 'bad' | 'na';
  detail: string;
}

/**
 * Card de "Saúde Score" — visão positiva consolidada.
 *
 * Computa um score ponderado de 0-100 baseado em 5 dimensões:
 *  - Vacinas (30): em dia / próxima / vencida
 *  - Parasitas (25): em dia / próximo / atrasado
 *  - Medicações (20): doses do dia OK / pendentes
 *  - Consultas (15): última consulta < 1 ano / nunca
 *  - Peso (10): tem pesagem / sem registro
 *
 * Dimensões "n/a" (sem dados pra avaliar) não pesam — score é normalizado.
 * Isso evita penalizar pet recém-cadastrado.
 */
export function HealthScoreCard({ petName, summary, parasiteSummary }: Props) {
  const { score, items } = useMemo<{ score: number; items: BreakdownItem[] }>(() => {
    const items: BreakdownItem[] = [];

    // Vacinas
    if (summary.next_vaccine) {
      const d = summary.next_vaccine.days_until;
      if (d <= 0) {
        items.push({
          label: 'Vacinas',
          emoji: '💉',
          status: 'bad',
          detail: `${summary.next_vaccine.name} vencida`,
        });
      } else if (d <= 7) {
        items.push({
          label: 'Vacinas',
          emoji: '💉',
          status: 'warn',
          detail: `Próxima em ${d}d`,
        });
      } else {
        items.push({
          label: 'Vacinas',
          emoji: '💉',
          status: 'ok',
          detail: 'Em dia',
        });
      }
    } else {
      items.push({ label: 'Vacinas', emoji: '💉', status: 'na', detail: 'Sem registro' });
    }

    // Parasitas
    if (parasiteSummary && parasiteSummary.total > 0) {
      if (parasiteSummary.overdue > 0) {
        items.push({
          label: 'Vermífugo/Pulga',
          emoji: '💊',
          status: 'bad',
          detail: `${parasiteSummary.overdue} atrasado${parasiteSummary.overdue > 1 ? 's' : ''}`,
        });
      } else if (parasiteSummary.next_due && parasiteSummary.next_due.days_until <= 7) {
        items.push({
          label: 'Vermífugo/Pulga',
          emoji: '💊',
          status: 'warn',
          detail: `Próximo em ${parasiteSummary.next_due.days_until}d`,
        });
      } else {
        items.push({ label: 'Vermífugo/Pulga', emoji: '💊', status: 'ok', detail: 'Em dia' });
      }
    } else {
      items.push({ label: 'Vermífugo/Pulga', emoji: '💊', status: 'na', detail: 'Sem registro' });
    }

    // Medicações
    if (summary.active_medications_count > 0) {
      if (summary.due_medications_today > 0) {
        items.push({
          label: 'Remédios',
          emoji: '🧪',
          status: 'warn',
          detail: `${summary.due_medications_today} dose${summary.due_medications_today > 1 ? 's' : ''} hoje`,
        });
      } else {
        items.push({
          label: 'Remédios',
          emoji: '🧪',
          status: 'ok',
          detail: `${summary.active_medications_count} ativo${summary.active_medications_count > 1 ? 's' : ''}`,
        });
      }
    } else {
      items.push({ label: 'Remédios', emoji: '🧪', status: 'ok', detail: 'Sem ativos' });
    }

    // Consultas
    if (summary.last_vet_visit) {
      const monthsAgo = differenceInMonths(new Date(), parseISO(summary.last_vet_visit.visited_at));
      if (monthsAgo >= 12) {
        items.push({
          label: 'Consultas',
          emoji: '🩺',
          status: 'warn',
          detail: 'Última > 1 ano',
        });
      } else {
        items.push({ label: 'Consultas', emoji: '🩺', status: 'ok', detail: `Há ${monthsAgo}m` });
      }
    } else {
      items.push({ label: 'Consultas', emoji: '🩺', status: 'na', detail: 'Sem registro' });
    }

    // Peso
    if (summary.latest_weight) {
      items.push({
        label: 'Peso',
        emoji: '⚖️',
        status: 'ok',
        detail: `${summary.latest_weight.weight_kg}kg`,
      });
    } else {
      items.push({ label: 'Peso', emoji: '⚖️', status: 'na', detail: 'Sem registro' });
    }

    // Score ponderado — só considera dimensões com dados
    const weights = { Vacinas: 30, 'Vermífugo/Pulga': 25, Remédios: 20, Consultas: 15, Peso: 10 };
    const statusValue = { ok: 100, warn: 50, bad: 0, na: -1 };
    let totalWeight = 0;
    let weightedSum = 0;
    for (const item of items) {
      const w = weights[item.label as keyof typeof weights] ?? 0;
      const v = statusValue[item.status];
      if (v < 0) continue; // ignora 'na'
      totalWeight += w;
      weightedSum += w * v;
    }
    const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    return { score, items };
  }, [summary, parasiteSummary]);

  // Cores e copy baseados no score
  const tone: 'good' | 'mid' | 'bad' = score >= 80 ? 'good' : score >= 50 ? 'mid' : 'bad';
  const palette = {
    good: { bg: '#DCFCE7', fg: '#166534', accent: '#16A34A', label: 'Em dia' },
    mid: { bg: '#FEF3C7', fg: '#92400E', accent: '#F59E0B', label: 'Atenção' },
    bad: { bg: '#FEE2E2', fg: '#991B1B', accent: '#DC2626', label: 'Precisa cuidar' },
  }[tone];

  const headline = (() => {
    if (tone === 'good') return `${petName} está super cuidado! 🌟`;
    if (tone === 'mid') return `${petName} está bem, falta pouca coisa`;
    return `${petName} precisa de atenção`;
  })();

  return (
    <View
      style={{
        backgroundColor: palette.bg,
        borderRadius: 18,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.2,
              color: palette.fg,
              textTransform: 'uppercase',
              opacity: 0.85,
            }}
          >
            Saúde · {palette.label}
          </Text>
          <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: palette.fg, marginTop: 2 }}>
            {headline}
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 36, color: palette.accent }}>
            {score}
            <Text style={{ fontSize: 18, color: palette.fg, opacity: 0.7 }}>%</Text>
          </Text>
        </View>
      </View>

      {/* Barra de progresso */}
      <View
        style={{
          height: 8,
          borderRadius: 4,
          backgroundColor: '#FFFFFF',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${score}%`,
            height: '100%',
            backgroundColor: palette.accent,
            borderRadius: 4,
          }}
        />
      </View>

      {/* Breakdown — 5 mini-chips horizontais */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {items.map((item, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor:
                item.status === 'bad'
                  ? '#FCA5A5'
                  : item.status === 'warn'
                    ? '#FCD34D'
                    : item.status === 'ok'
                      ? '#86EFAC'
                      : '#E5E5E5',
            }}
          >
            <Text style={{ fontSize: 11 }}>{item.emoji}</Text>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 10,
                color:
                  item.status === 'bad'
                    ? '#991B1B'
                    : item.status === 'warn'
                      ? '#92400E'
                      : item.status === 'ok'
                        ? '#166534'
                        : '#737373',
              }}
            >
              {item.label}: {item.detail}
            </Text>
            {item.status === 'ok' ? (
              <Text style={{ fontSize: 9, color: '#16A34A' }}>✓</Text>
            ) : item.status === 'bad' ? (
              <Text style={{ fontSize: 9, color: '#DC2626' }}>!</Text>
            ) : null}
          </View>
        ))}
      </View>

    </View>
  );
}
