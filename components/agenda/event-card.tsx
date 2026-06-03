import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { PressScale } from '@/components/ui/press-scale';
import { FONTS } from '@/lib/fonts';
import type { AgendaItem } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

interface Props {
  item: AgendaItem;
  onPress?: () => void;
  onComplete?: () => void;
  /** Quando true, mostra "ATRASADO" se occurs_at < now */
  showStatus?: boolean;
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😢',
  2: '😟',
  3: '😐',
  4: '🙂',
  5: '🤩',
};

function formatWhen(iso: string, allDay: boolean): string {
  const date = parseISO(iso);
  const dayLabel = isToday(date)
    ? 'Hoje'
    : isTomorrow(date)
    ? 'Amanhã'
    : format(date, "EEE, d 'de' MMM", { locale: ptBR });
  if (allDay) return dayLabel;
  return `${dayLabel} · ${format(date, 'HH:mm')}`;
}

/**
 * Card de evento na agenda. Mostra:
 *  - Emoji + título + tipo
 *  - Data/hora ou "Hoje" / "Amanhã"
 *  - Foto pequena se o log tem photo_url
 *  - Mood emoji se já concluído
 *  - Badge de status (atrasado / hoje / em breve)
 *  - Side stripe colorido por tipo
 *  - Botão de check inline se editable + ainda não concluído
 */
export function EventCard({ item, onPress, onComplete, showStatus = true }: Props) {
  const { theme } = useTheme();
  const occurs = parseISO(item.occurs_at);
  const now = new Date();
  const isPast = occurs.getTime() < now.getTime();
  const isCompleted = item.log?.status === 'done';
  const isSkipped = item.log?.status === 'skipped';
  const minutesDelta = (occurs.getTime() - now.getTime()) / (60 * 1000);
  const isOverdue = isPast && !isCompleted && !isSkipped && minutesDelta < -60;

  // Determine state styling
  let stateBadge: { bg: string; text: string; label: string } | null = null;
  if (showStatus) {
    if (isCompleted) {
      stateBadge = { bg: '#DCFCE7', text: '#166534', label: '✓ Feito' };
    } else if (isSkipped) {
      stateBadge = { bg: '#F5F5F5', text: '#737373', label: 'Pulado' };
    } else if (isOverdue) {
      const days = Math.abs(Math.round(minutesDelta / (60 * 24)));
      stateBadge = {
        bg: '#FEE2E2',
        text: '#991B1B',
        label: days > 0 ? `Atrasado ${days}d` : 'Atrasado',
      };
    } else if (isToday(occurs) && !isPast) {
      stateBadge = { bg: '#FEF3C7', text: '#92400E', label: 'Hoje' };
    }
  }

  // Read-only items (vaccinations, parasites, vet, meetups) have lock icon
  const readOnly = !item.editable;

  return (
    <PressScale
      onPress={onPress}
      style={{
        flexDirection: 'row',
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: theme.borderLight,
        overflow: 'hidden',
        opacity: isSkipped ? 0.6 : 1,
      }}
    >
      {/* Faixa lateral colorida indicando tipo */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: item.tint.text,
          opacity: isCompleted ? 0.5 : 1,
        }}
      />

      {/* Ícone tipo */}
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: item.tint.bg,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 4,
        }}
      >
        <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
      </View>

      {/* Info principal */}
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 15,
              color: theme.text,
              textDecorationLine: isCompleted ? 'line-through' : 'none',
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {readOnly ? (
            <Ionicons name="lock-closed" size={11} color={theme.textDim} />
          ) : null}
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
          }}
        >
          <Ionicons name="time-outline" size={12} color={theme.textDim} />
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 12,
              color: theme.textDim,
            }}
            numberOfLines={1}
          >
            {formatWhen(item.occurs_at, item.all_day)}
          </Text>
        </View>

        {/* Mood + foto se completed */}
        {isCompleted && item.log && (item.log.mood || item.log.photo_url) ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 6,
            }}
          >
            {item.log.mood ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: theme.borderLight,
                }}
              >
                <Text style={{ fontSize: 13 }}>{MOOD_EMOJI[item.log.mood]}</Text>
              </View>
            ) : null}
            {item.log.photo_url ? (
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  overflow: 'hidden',
                  backgroundColor: theme.borderLight,
                }}
              >
                <Image
                  source={{ uri: item.log.photo_url }}
                  style={{ width: 28, height: 28 }}
                  contentFit="cover"
                />
              </View>
            ) : null}
            {item.log.actual_cost ? (
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 11,
                  color: theme.brandDark,
                }}
              >
                R$ {item.log.actual_cost.toFixed(2).replace('.', ',')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {item.description && !isCompleted ? (
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: theme.textDim,
              marginTop: 3,
            }}
            numberOfLines={1}
          >
            {item.description}
          </Text>
        ) : null}
      </View>

      {/* Status + check button */}
      <View style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 6 }}>
        {stateBadge ? (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: stateBadge.bg,
            }}
          >
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 10,
                color: stateBadge.text,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {stateBadge.label}
            </Text>
          </View>
        ) : null}

        {item.editable && !isCompleted && !isSkipped && onComplete ? (
          <PressScale
            onPress={onComplete}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: theme.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
          </PressScale>
        ) : null}
      </View>
    </PressScale>
  );
}
