import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import {
  getProduct,
  KIND_LABEL,
  type ParasiteKind,
} from '@/lib/parasite-products';
import type { ParasiteTreatment } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

import { PressScale } from './ui/press-scale';

interface Props {
  treatment: ParasiteTreatment;
  onPress?: () => void;
  /** Quando true, mostra um botão "Aplicar novamente" lateral. */
  showRenew?: boolean;
  onRenew?: () => void;
}

type Status = 'overdue' | 'due_soon' | 'ok' | 'no_due';

const STATUS_STYLES: Record<Status, { bg: string; border: string; text: string; emoji: string; label: (d: number) => string }> = {
  overdue: {
    bg: '#FEE2E2',
    border: '#FCA5A5',
    text: '#991B1B',
    emoji: '⚠️',
    label: (d) => `Atrasado ${Math.abs(d)}d`,
  },
  due_soon: {
    bg: '#FEF3C7',
    border: '#FCD34D',
    text: '#92400E',
    emoji: '⏰',
    label: (d) => (d === 0 ? 'Vence hoje!' : `Em ${d}d`),
  },
  ok: {
    bg: '#DCFCE7',
    border: '#86EFAC',
    text: '#166534',
    emoji: '✅',
    label: (d) => `Em ${d}d`,
  },
  no_due: {
    bg: '#F5F5F5',
    border: '#E5E5E5',
    text: '#525252',
    emoji: '📋',
    label: () => 'Sem reaplicação',
  },
};

function computeStatus(nextDue: string | null): { status: Status; daysUntil: number } {
  if (!nextDue) return { status: 'no_due', daysUntil: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseISO(nextDue);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { status: 'overdue', daysUntil: diff };
  if (diff <= 7) return { status: 'due_soon', daysUntil: diff };
  return { status: 'ok', daysUntil: diff };
}

/**
 * Card de um tratamento antiparasitário aplicado.
 * Status colorido na lateral (atrasado/em breve/ok), produto + intervalo,
 * data aplicada + data de reaplicação.
 */
export function ParasiteTreatmentCard({ treatment, onPress, showRenew, onRenew }: Props) {
  const { theme } = useTheme();
  const product = getProduct(treatment.product_slug);
  const { status, daysUntil } = computeStatus(treatment.next_due_at);
  const statusStyle = STATUS_STYLES[status];

  const appliedDate = format(parseISO(treatment.applied_at), "d 'de' MMM", { locale: ptBR });
  const dueDate = treatment.next_due_at
    ? format(parseISO(treatment.next_due_at), "d 'de' MMM", { locale: ptBR })
    : null;

  return (
    <PressScale
      onPress={onPress}
      style={{
        flexDirection: 'row',
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 14,
        gap: 12,
        borderWidth: 1,
        borderColor: theme.borderLight,
        overflow: 'hidden',
      }}
    >
      {/* Faixa lateral colorida indicando status */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: statusStyle.border,
        }}
      />

      {/* Ícone do produto */}
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: product?.tint.bg ?? theme.brandLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 4,
        }}
      >
        <Text style={{ fontSize: 24 }}>{product?.emoji ?? '💊'}</Text>
      </View>

      {/* Info principal */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 15,
              color: theme.text,
            }}
            numberOfLines={1}
          >
            {treatment.product_name}
          </Text>
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 999,
              backgroundColor: product?.tint.bg ?? theme.borderLight,
            }}
          >
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 9,
                color: product?.tint.text ?? theme.textDim,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {KIND_LABEL[treatment.kind as ParasiteKind]}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
          }}
        >
          <Ionicons name="calendar-outline" size={12} color={theme.textDim} />
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 12,
              color: theme.textDim,
            }}
          >
            Aplicado {appliedDate}
            {dueDate ? ` · próximo ${dueDate}` : ''}
          </Text>
        </View>

        {treatment.notes ? (
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: theme.textDim,
              opacity: 0.85,
              marginTop: 3,
            }}
            numberOfLines={2}
          >
            💬 {treatment.notes}
          </Text>
        ) : null}
      </View>

      {/* Status badge à direita */}
      <View style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 4 }}>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: statusStyle.bg,
            borderWidth: 1,
            borderColor: statusStyle.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <Text style={{ fontSize: 11 }}>{statusStyle.emoji}</Text>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 10,
              color: statusStyle.text,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
            }}
          >
            {statusStyle.label(daysUntil)}
          </Text>
        </View>

        {showRenew && (status === 'overdue' || status === 'due_soon') ? (
          <PressScale
            onPress={onRenew}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: theme.brand,
            }}
          >
            <Ionicons name="refresh" size={10} color="#fff" />
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 10,
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Aplicar
            </Text>
          </PressScale>
        ) : null}
      </View>
    </PressScale>
  );
}
