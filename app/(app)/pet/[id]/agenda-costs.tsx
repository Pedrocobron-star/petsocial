import { useQuery } from '@tanstack/react-query';
import { addMonths, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { EmptyState } from '@/components/empty-state';
import { usePetHealthGate } from '@/components/pet-health-gate';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PressScale } from '@/components/ui/press-scale';
import { EVENT_KIND_META } from '@/lib/event-templates';
import { FONTS } from '@/lib/fonts';
import { fetchPet, fetchPetEventLogs, fetchPetEvents, qk } from '@/lib/queries';
import type { PetEventKind } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

type Period = 'this_month' | 'last_3' | 'last_6' | 'last_12';

const PERIOD_OPTIONS: { value: Period; label: string; months: number }[] = [
  { value: 'this_month', label: 'Este mês', months: 1 },
  { value: 'last_3', label: '3 meses', months: 3 },
  { value: 'last_6', label: '6 meses', months: 6 },
  { value: 'last_12', label: '1 ano', months: 12 },
];

/**
 * Dashboard de gastos com pet, por categoria + evolução mensal.
 * Differential: descobre que gasta mais com escolinha que com vet.
 */
export default function AgendaCostsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const healthGate = usePetHealthGate(id);
  const { theme } = useTheme();
  const [period, setPeriod] = useState<Period>('last_3');

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });
  const eventsQuery = useQuery({
    queryKey: qk.petEvents(id),
    queryFn: () => fetchPetEvents(id),
    enabled: !!id,
  });
  const logsQuery = useQuery({
    queryKey: qk.petEventLogs(id),
    queryFn: () => fetchPetEventLogs(id, 500),
    enabled: !!id,
  });

  // Map event_id → kind pra associar log com categoria
  const eventKindMap = useMemo(() => {
    const m = new Map<string, PetEventKind>();
    for (const e of eventsQuery.data ?? []) m.set(e.id, e.kind);
    return m;
  }, [eventsQuery.data]);

  const periodMonths = PERIOD_OPTIONS.find((p) => p.value === period)!.months;

  // Logs no período
  const periodLogs = useMemo(() => {
    const cutoff = subMonths(startOfMonth(new Date()), periodMonths - 1);
    return (logsQuery.data ?? []).filter((log) => {
      if (!log.actual_cost || log.actual_cost <= 0) return false;
      return parseISO(log.occurrence_date) >= cutoff;
    });
  }, [logsQuery.data, periodMonths]);

  // --- Totais por categoria ---
  const byKind = useMemo(() => {
    const map = new Map<PetEventKind, number>();
    for (const log of periodLogs) {
      const kind = eventKindMap.get(log.event_id);
      if (!kind) continue;
      map.set(kind, (map.get(kind) ?? 0) + (log.actual_cost ?? 0));
    }
    return Array.from(map.entries())
      .map(([kind, total]) => ({ kind, total }))
      .sort((a, b) => b.total - a.total);
  }, [periodLogs, eventKindMap]);

  const grandTotal = byKind.reduce((acc, b) => acc + b.total, 0);
  const monthlyAvg = grandTotal / periodMonths;

  // --- Por mês (pro chart) ---
  const monthlyTotals = useMemo(() => {
    const months: { key: string; label: string; total: number }[] = [];
    const start = subMonths(startOfMonth(new Date()), periodMonths - 1);
    for (let i = 0; i < periodMonths; i++) {
      const month = addMonths(start, i);
      const key = format(month, 'yyyy-MM');
      const label = format(month, 'MMM', { locale: ptBR });
      months.push({ key, label, total: 0 });
    }
    for (const log of periodLogs) {
      const key = log.occurrence_date.slice(0, 7);
      const entry = months.find((m) => m.key === key);
      if (entry) entry.total += log.actual_cost ?? 0;
    }
    return months;
  }, [periodLogs, periodMonths]);

  const hasData = grandTotal > 0;

  if (healthGate) return healthGate;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: petQuery.data ? `Custos · ${petQuery.data.name}` : 'Custos',
        }}
      />

      <ScrollView contentContainerStyle={{ paddingVertical: 12, paddingBottom: 32 }}>
        {/* Filtro de período */}
        <CenteredColumn maxWidth={540}>
          <View
            style={{
              flexDirection: 'row',
              gap: 6,
              marginBottom: 12,
            }}
          >
            {PERIOD_OPTIONS.map((p) => {
              const active = period === p.value;
              return (
                <PressScale
                  key={p.value}
                  onPress={() => setPeriod(p.value)}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: 12,
                    backgroundColor: active ? theme.brand : theme.borderLight,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 12,
                      color: active ? '#fff' : theme.textMuted,
                    }}
                  >
                    {p.label}
                  </Text>
                </PressScale>
              );
            })}
          </View>
        </CenteredColumn>

        {!hasData ? (
          <EmptyState
            emoji="💰"
            title="Ainda sem custos registrados"
            description="Toda vez que você marcar um evento como feito, pode informar o custo real. Vamos te mostrar o quanto custa cuidar dele 🐾"
          />
        ) : (
          <>
            {/* Total + média */}
            <CenteredColumn maxWidth={540}>
              <Animated.View
                entering={FadeInUp.duration(280)}
                style={{
                  backgroundColor: '#1A1410',
                  borderRadius: 18,
                  padding: 16,
                  flexDirection: 'row',
                  gap: 12,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <Text
                  style={{
                    position: 'absolute',
                    top: -10,
                    right: -4,
                    fontSize: 72,
                    opacity: 0.06,
                    transform: [{ rotate: '12deg' }],
                  }}
                >
                  💰
                </Text>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: '#FBBF24',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 24 }}>💰</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 11,
                      color: '#A3A3A3',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    Total no período
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: 26,
                      color: '#fff',
                      letterSpacing: -0.5,
                      marginTop: 2,
                    }}
                  >
                    R$ {grandTotal.toFixed(2).replace('.', ',')}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 12,
                      color: '#D4D4D4',
                      marginTop: 2,
                    }}
                  >
                    Média mensal: R$ {monthlyAvg.toFixed(2).replace('.', ',')}
                  </Text>
                </View>
              </Animated.View>
            </CenteredColumn>

            {/* Bar chart mensal (se mais de 1 mês) */}
            {periodMonths > 1 ? (
              <CenteredColumn maxWidth={540}>
                <View style={{ marginTop: 12 }}>
                  <MonthlyBarChart data={monthlyTotals} />
                </View>
              </CenteredColumn>
            ) : null}

            {/* Lista por categoria */}
            <CenteredColumn maxWidth={540}>
              <View style={{ marginTop: 16 }}>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 11,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    color: theme.brand,
                    marginBottom: 8,
                    marginLeft: 4,
                  }}
                >
                  Por categoria
                </Text>
                <View style={{ gap: 6 }}>
                  {byKind.map((b, idx) => {
                    const meta = EVENT_KIND_META[b.kind];
                    const pct = (b.total / grandTotal) * 100;
                    return (
                      <Animated.View
                        key={b.kind}
                        entering={FadeInUp.delay(idx * 50).duration(280)}
                      >
                        <View
                          style={{
                            backgroundColor: theme.surface,
                            borderRadius: 14,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: theme.borderLight,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                            }}
                          >
                            <View
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                backgroundColor: meta.tint.bg,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  fontFamily: FONTS.bodyBold,
                                  fontSize: 14,
                                  color: theme.text,
                                }}
                              >
                                {meta.label}
                              </Text>
                              <Text
                                style={{
                                  fontFamily: FONTS.body,
                                  fontSize: 11,
                                  color: theme.textDim,
                                  marginTop: 1,
                                }}
                              >
                                {pct.toFixed(0)}% do total
                              </Text>
                            </View>
                            <Text
                              style={{
                                fontFamily: FONTS.display,
                                fontSize: 18,
                                color: theme.text,
                                letterSpacing: -0.3,
                              }}
                            >
                              R$ {b.total.toFixed(0)}
                            </Text>
                          </View>
                          {/* Barra de progresso */}
                          <View
                            style={{
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: theme.borderLight,
                              marginTop: 10,
                              overflow: 'hidden',
                            }}
                          >
                            <View
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                backgroundColor: meta.tint.text,
                                borderRadius: 3,
                              }}
                            />
                          </View>
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              </View>
            </CenteredColumn>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// Bar chart mensal — usa react-native-svg (já instalado)
// ============================================================================
function MonthlyBarChart({ data }: { data: { key: string; label: string; total: number }[] }) {
  const { theme } = useTheme();
  const W = 320;
  const H = 160;
  const padX = 16;
  const padY = 24;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const barW = innerW / data.length - 6;

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.borderLight,
      }}
    >
      <Text
        style={{
          alignSelf: 'flex-start',
          fontFamily: FONTS.bodyBold,
          fontSize: 11,
          color: theme.textDim,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 8,
          marginLeft: 4,
        }}
      >
        Evolução mensal
      </Text>
      <Svg width={W} height={H}>
        {data.map((d, i) => {
          const barH = (d.total / maxVal) * innerH;
          const x = padX + i * (innerW / data.length) + 3;
          const y = padY + innerH - barH;
          return (
            <Svg key={d.key} x={0} y={0}>
              {/* Background bar (subtle) */}
              <Rect
                x={x}
                y={padY}
                width={barW}
                height={innerH}
                rx={4}
                fill={theme.borderLight}
                opacity={0.5}
              />
              {/* Value bar */}
              {d.total > 0 ? (
                <Rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill={theme.brand}
                />
              ) : null}
              {/* Value label on top */}
              {d.total > 0 ? (
                <SvgText
                  x={x + barW / 2}
                  y={y - 4}
                  fontSize={9}
                  fontWeight="bold"
                  fill={theme.text}
                  textAnchor="middle"
                >
                  {d.total >= 1000 ? `${(d.total / 1000).toFixed(1)}k` : Math.round(d.total)}
                </SvgText>
              ) : null}
              {/* Month label */}
              <SvgText
                x={x + barW / 2}
                y={H - 6}
                fontSize={10}
                fill={theme.textDim}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            </Svg>
          );
        })}
      </Svg>
    </View>
  );
}
