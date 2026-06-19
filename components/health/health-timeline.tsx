import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { PaywallCard } from '@/components/paywall-card';
import { FONTS } from '@/lib/fonts';
import type { HealthEventKind, HealthTimelineEvent } from '@/lib/queries';
import { useIsPro } from '@/providers/subscription-provider';
import { useTheme } from '@/providers/theme-provider';

/** Quantos meses de histórico clínico o usuário free enxerga. O resto é Pet Pro. */
const FREE_TIMELINE_MONTHS = 3;

interface Props {
  events: HealthTimelineEvent[];
  /** Quantos eventos mostrar inicialmente. Default 8. */
  limit?: number;
}

const KIND_META: Record<
  HealthEventKind,
  { emoji: string; color: string; bgColor: string }
> = {
  vaccine: { emoji: '💉', color: '#9A3412', bgColor: '#FED7AA' },
  parasite: { emoji: '💊', color: '#166534', bgColor: '#DCFCE7' },
  vet_visit: { emoji: '🩺', color: '#1E40AF', bgColor: '#DBEAFE' },
  weight: { emoji: '⚖️', color: '#9D174D', bgColor: '#FCE7F3' },
  medication_started: { emoji: '🧪', color: '#5B21B6', bgColor: '#EDE9FE' },
  symptom: { emoji: '📝', color: '#9F1239', bgColor: '#FECDD3' },
};

/**
 * Timeline vertical de eventos de saúde — cronológico desc.
 *
 * Cada item é uma "linha do tempo" com bolinha colorida + label + data.
 * Linha contínua (border-left) conecta os items pra dar sensação de sequência.
 */
export function HealthTimeline({ events, limit = 8 }: Props) {
  const { theme } = useTheme();
  const isPro = useIsPro();

  // Free: histórico clínico só dos últimos 3 meses. O que é mais antigo fica
  // bloqueado e vira gancho pro Pet Pro (mesma lógica do Score de saúde).
  const cutoffISO = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - FREE_TIMELINE_MONTHS);
    return d.toISOString();
  }, []);
  const freeEvents = isPro ? events : events.filter((e) => e.date >= cutoffISO);
  const lockedCount = events.length - freeEvents.length;
  const visible = freeEvents.slice(0, limit);

  // Nenhum evento registrado de fato.
  if (events.length === 0) {
    return (
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: 14,
          padding: 16,
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 28 }}>📜</Text>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
          Sem histórico ainda
        </Text>
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 12,
            color: theme.textDim,
            textAlign: 'center',
          }}
        >
          Registre vacinas, consultas e pesagens — vai virar uma timeline aqui.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 14,
        gap: 0,
      }}
    >
      {visible.map((event, i) => {
        const meta = KIND_META[event.kind];
        const date = parseISO(event.date);
        const isLast = i === visible.length - 1;
        return (
          <View key={`${event.kind}-${event.source_id}`} style={{ flexDirection: 'row', gap: 12 }}>
            {/* Coluna do timeline: bolinha + linha vertical */}
            <View style={{ alignItems: 'center', width: 28 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: meta.bgColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: theme.surface,
                  zIndex: 1,
                }}
              >
                <Text style={{ fontSize: 13 }}>{meta.emoji}</Text>
              </View>
              {!isLast ? (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    backgroundColor: theme.borderLight,
                    marginTop: -1,
                  }}
                />
              ) : null}
            </View>

            {/* Conteúdo do evento */}
            <View style={{ flex: 1, paddingBottom: isLast ? 0 : 14 }}>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 13,
                  color: theme.text,
                  lineHeight: 18,
                }}
                numberOfLines={2}
              >
                {event.title}
              </Text>
              {event.detail ? (
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 12,
                    color: theme.textDim,
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {event.detail}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 11,
                    color: meta.color,
                    fontWeight: '600',
                  }}
                >
                  {format(date, "d 'de' MMM", { locale: ptBR })}
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
                  · {formatDistanceToNow(date, { addSuffix: true, locale: ptBR })}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
      {/* Free com TUDO fora da janela de 3 meses: nada visível, só o gancho. */}
      {visible.length === 0 ? (
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 12,
            color: theme.textDim,
            textAlign: 'center',
            paddingVertical: 4,
          }}
        >
          Seu histórico dos últimos 3 meses aparece aqui.
        </Text>
      ) : null}

      {freeEvents.length > limit ? (
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 11,
            color: theme.textDim,
            textAlign: 'center',
            marginTop: 8,
            marginLeft: 40,
          }}
        >
          + {freeEvents.length - limit} eventos recentes
        </Text>
      ) : null}

      {/* Histórico clínico antigo (fora dos 3 meses) é exclusivo do Pet Pro. */}
      {lockedCount > 0 ? (
        <PaywallCard
          intent="health-timeline"
          emoji="🩺"
          title="Histórico clínico completo no Pet Pro"
          description={`${lockedCount} ${lockedCount === 1 ? 'registro mais antigo está' : 'registros mais antigos estão'} guardados no Cofre da Saúde. No free você vê os últimos 3 meses; no Pet Pro, a vida toda do seu pet: vacinas, exames, peso e consultas que nunca somem.`}
          compact
          style={{ marginTop: 12 }}
        />
      ) : null}
    </View>
  );
}
