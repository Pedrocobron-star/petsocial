import { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';

import { PaywallCard } from '@/components/paywall-card';
import { FONTS } from '@/lib/fonts';
import { currentMonthKey, monthLabel, shiftMonthKey } from '@/lib/health-score';
import type { PetHealthSnapshot } from '@/lib/queries';
import { upsertHealthSnapshot } from '@/lib/queries';
import { useIsPro } from '@/providers/subscription-provider';
import { useTheme } from '@/providers/theme-provider';

/** Quantos meses visíveis pra usuário free (incluindo o atual). */
const FREE_MONTHS_VISIBLE = 3;

interface Props {
  petId: string;
  currentScore: number;
  currentComponents: Record<string, unknown>;
  snapshots: PetHealthSnapshot[];
}

/**
 * Card de tendência do Score de Saúde — comparativo com mês anterior + mini-sparkline
 * dos últimos 6 meses.
 *
 * Effect colateral: faz upsert do snapshot do mês corrente toda vez que
 * o componente renderiza com um currentScore válido. Best-effort (não bloqueia UI).
 */
export function HealthScoreTrend({
  petId,
  currentScore,
  currentComponents,
  snapshots,
}: Props) {
  const { theme } = useTheme();
  const isPro = useIsPro();
  const thisMonth = currentMonthKey();

  // Upsert do snapshot atual — best-effort, sem await
  useEffect(() => {
    if (!petId || currentScore < 0) return;
    upsertHealthSnapshot({
      pet_id: petId,
      month: thisMonth,
      score: currentScore,
      components: currentComponents,
    }).catch(() => undefined);
  }, [petId, thisMonth, currentScore, currentComponents]);

  // Combina snapshots históricos + score atual (que pode ainda não estar salvo)
  const series = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of snapshots) map.set(s.month, s.score);
    map.set(thisMonth, currentScore);
    // Últimos 6 meses ordenados asc
    const months: { key: string; score: number | null }[] = [];
    for (let i = 5; i >= 0; i--) {
      const key = shiftMonthKey(thisMonth, -i);
      months.push({ key, score: map.get(key) ?? null });
    }
    return months;
  }, [snapshots, thisMonth, currentScore]);

  const lastMonth = series[series.length - 2];
  const delta = lastMonth?.score != null ? currentScore - lastMonth.score : null;
  const validScores = series.map((s) => s.score).filter((s): s is number => s != null);
  const minScore = validScores.length > 0 ? Math.min(...validScores) : 0;
  const maxScore = validScores.length > 0 ? Math.max(...validScores) : 100;
  const range = Math.max(1, maxScore - minScore);

  // Se só tem este mês, não vale mostrar comparativo
  const hasHistory = validScores.length >= 2;

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 14,
        gap: 10,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontSize: 22 }}>📈</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
            Evolução da saúde
          </Text>
          {hasHistory && delta !== null ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 2 }}>
              {deltaLabel(delta, lastMonth!.score!)}
            </Text>
          ) : (
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 2 }}>
              Continue cuidando e a evolução aparece aqui mês após mês.
            </Text>
          )}
        </View>
        {hasHistory && delta !== null ? (
          <DeltaBadge delta={delta} />
        ) : null}
      </View>

      {/* Sparkline */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          height: 56,
          gap: 6,
          marginTop: 4,
        }}
      >
        {series.map((m, idx) => {
          const isCurrent = idx === series.length - 1;
          // Free: meses mais antigos que FREE_MONTHS_VISIBLE-1 são bloqueados
          const isLocked = !isPro && idx < series.length - FREE_MONTHS_VISIBLE;
          const fillPct = m.score != null ? ((m.score - minScore) / range) * 100 : 0;
          const barColor = m.score == null
            ? theme.borderLight
            : m.score >= 80
              ? '#16A34A'
              : m.score >= 50
                ? '#F59E0B'
                : '#DC2626';

          return (
            <View key={m.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  height: '100%',
                  width: '100%',
                  borderRadius: 6,
                  backgroundColor: theme.borderLight,
                  justifyContent: 'flex-end',
                  overflow: 'hidden',
                  opacity: isLocked ? 0.35 : 1,
                }}
              >
                {m.score != null ? (
                  <View
                    style={{
                      height: `${Math.max(8, fillPct)}%`,
                      backgroundColor: isLocked ? '#A3A3A3' : barColor,
                      borderTopLeftRadius: 6,
                      borderTopRightRadius: 6,
                      borderWidth: isCurrent ? 2 : 0,
                      borderColor: '#1A1410',
                    }}
                  />
                ) : null}
                {isLocked ? (
                  <View
                    style={{
                      position: 'absolute',
                      inset: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>🔒</Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={{
                  fontFamily: isCurrent ? FONTS.bodyBold : FONTS.body,
                  fontSize: 9,
                  color: isCurrent ? theme.brand : theme.textDim,
                }}
              >
                {monthLabel(m.key)}
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 10,
                  color: isLocked
                    ? theme.textDim
                    : m.score != null
                      ? theme.text
                      : theme.textDim,
                }}
              >
                {isLocked ? '⭐' : m.score != null ? `${m.score}%` : '—'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Paywall inline pra free users com histórico bloqueado */}
      {!isPro && series.length > FREE_MONTHS_VISIBLE ? (
        <PaywallCard
          intent="score-history"
          emoji="📈"
          title="Histórico completo no Pet Pro"
          description="Veja o Score de Saúde de meses anteriores e acompanhe a evolução ao longo de todo o ano. No plano free você vê os últimos 3 meses."
          compact
          style={{ marginTop: 4 }}
        />
      ) : null}
    </View>
  );
}

function deltaLabel(delta: number, prev: number): string {
  const abs = Math.abs(delta);
  if (delta === 0) return `Igual ao mês passado (${prev}%)`;
  if (delta > 0) return `+${abs} ponto${abs === 1 ? '' : 's'} vs mês passado (${prev}%) 🎉`;
  return `-${abs} ponto${abs === 1 ? '' : 's'} vs mês passado (${prev}%)`;
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: '#E2E8F0',
        }}
      >
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#475569' }}>= 0</Text>
      </View>
    );
  }
  const positive = delta > 0;
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: positive ? '#DCFCE7' : '#FEE2E2',
      }}
    >
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 11,
          color: positive ? '#166534' : '#991B1B',
        }}
      >
        {positive ? '↑' : '↓'} {Math.abs(delta)} pts
      </Text>
    </View>
  );
}
