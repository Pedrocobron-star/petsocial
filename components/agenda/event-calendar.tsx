import { Ionicons } from '@expo/vector-icons';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isToday,
  parseISO,
  startOfMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PressScale } from '@/components/ui/press-scale';
import { FONTS } from '@/lib/fonts';
import type { AgendaItem } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

interface Props {
  items: AgendaItem[];
  selectedDate: Date | null;
  onSelectDate: (d: Date | null) => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Grid mensal estilo Apple Calendar. Cada dia mostra:
 *  - Número do dia (destaque pra hoje)
 *  - Até 3 dots coloridos por tipo de evento
 *  - "+N" se houver mais
 *  - Highlight quando o dia tem evento atrasado (anel vermelho ao redor do número)
 *
 * Tap em dia preenche `selectedDate` → a tela exibe lista filtrada.
 */
export function EventCalendar({ items, selectedDate, onSelectDate }: Props) {
  const { theme } = useTheme();
  const [cursorMonth, setCursorMonth] = useState(() => startOfMonth(new Date()));

  // Indexa items por data 'YYYY-MM-DD'
  const itemsByDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const it of items) {
      const key = it.occurs_at.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return map;
  }, [items]);

  // Dias do mês visível + preenchimento da grade (sempre 6 linhas × 7 colunas = 42)
  const days = useMemo(() => {
    const start = startOfMonth(cursorMonth);
    const end = endOfMonth(cursorMonth);
    const monthDays = eachDayOfInterval({ start, end });
    const firstWeekday = getDay(start); // 0 (dom) - 6 (sab)
    const leading: (Date | null)[] = Array.from({ length: firstWeekday }, () => null);
    const grid: (Date | null)[] = [...leading, ...monthDays];
    while (grid.length % 7 !== 0) grid.push(null);
    // Preencher até 42 pra altura consistente
    while (grid.length < 42) grid.push(null);
    return grid;
  }, [cursorMonth]);

  const goPrev = () => setCursorMonth((m) => addMonths(m, -1));
  const goNext = () => setCursorMonth((m) => addMonths(m, 1));
  const goToday = () => {
    const now = new Date();
    setCursorMonth(startOfMonth(now));
    onSelectDate(now);
  };

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: theme.borderLight,
      }}
    >
      {/* Header com mês e navegação */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 4,
          marginBottom: 10,
        }}
      >
        <PressScale onPress={goPrev} hitSlop={8}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              backgroundColor: theme.borderLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={16} color={theme.text} />
          </View>
        </PressScale>

        <PressScale onPress={goToday}>
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 18,
              color: theme.text,
              letterSpacing: -0.3,
              textTransform: 'capitalize',
            }}
          >
            {format(cursorMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </Text>
        </PressScale>

        <PressScale onPress={goNext} hitSlop={8}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              backgroundColor: theme.borderLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-forward" size={16} color={theme.text} />
          </View>
        </PressScale>
      </View>

      {/* Cabeçalho dos dias da semana */}
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 10,
                color: theme.textDim,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              }}
            >
              {w}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid de dias */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((d, idx) => {
          if (!d) {
            return <View key={idx} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          }
          const dayKey = format(d, 'yyyy-MM-dd');
          const dayItems = itemsByDay.get(dayKey) ?? [];
          const isSelected = selectedDate ? isSameDay(d, selectedDate) : false;
          const today = isToday(d);
          const hasOverdue = dayItems.some((it) => {
            if (it.log) return false;
            return new Date(it.occurs_at) < new Date() && it.editable;
          });

          const dotsToShow = dayItems.slice(0, 3);
          const remaining = dayItems.length - dotsToShow.length;

          return (
            <PressScale
              key={idx}
              onPress={() => onSelectDate(isSelected ? null : d)}
              style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}
            >
              <Animated.View
                entering={FadeIn.duration(180).delay(idx * 4)}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  backgroundColor: isSelected
                    ? theme.brand
                    : today
                    ? theme.brandSurface
                    : 'transparent',
                  borderWidth: today && !isSelected ? 1 : 0,
                  borderColor: theme.brandLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  paddingVertical: 4,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  {hasOverdue && !isSelected ? (
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: '#EF4444',
                      }}
                    />
                  ) : null}
                  <Text
                    style={{
                      fontFamily: today || isSelected ? FONTS.bodyBold : FONTS.body,
                      fontSize: 13,
                      color: isSelected
                        ? '#fff'
                        : today
                        ? theme.brandDark
                        : theme.text,
                    }}
                  >
                    {d.getDate()}
                  </Text>
                </View>

                {/* Dots */}
                {dayItems.length > 0 ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 2,
                      minHeight: 5,
                    }}
                  >
                    {dotsToShow.map((it, i) => (
                      <View
                        key={i}
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: isSelected ? '#fff' : it.tint.text,
                          opacity: it.log?.status === 'done' ? 0.4 : 1,
                        }}
                      />
                    ))}
                    {remaining > 0 ? (
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 8,
                          color: isSelected ? '#fff' : theme.textDim,
                          marginLeft: 1,
                        }}
                      >
                        +{remaining}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ height: 5 }} />
                )}
              </Animated.View>
            </PressScale>
          );
        })}
      </View>

      {/* Legenda compacta */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 10,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <LegendDot color="#EF4444" label="Atrasado" />
        <LegendDot color={theme.brand} label="Selecionado" />
        <LegendDot color={theme.brandLight} label="Hoje" filled={false} />
      </View>
    </View>
  );
}

function LegendDot({
  color,
  label,
  filled = true,
}: {
  color: string;
  label: string;
  filled?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: filled ? color : 'transparent',
          borderWidth: filled ? 0 : 1.5,
          borderColor: color,
        }}
      />
      <Text
        style={{
          fontFamily: FONTS.bodyMedium,
          fontSize: 10,
          color: theme.textDim,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
