import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { computeHealthScore, type ScoreComponent } from '@/lib/health-score';
import type { ParasiteSummary } from '@/lib/queries';
import type { HealthSummary } from '@/lib/types';

interface Props {
  petName: string;
  summary: HealthSummary;
  parasiteSummary: ParasiteSummary | undefined;
}

// Emoji por dimensão (o cálculo/label/detalhe vêm da FONTE ÚNICA computeHealthScore).
const KIND_EMOJI: Record<ScoreComponent['key'], string> = {
  vaccines: '💉',
  parasites: '💊',
  medications: '🧪',
  vet_visits: '🩺',
  weight: '⚖️',
};

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
  // FONTE ÚNICA: o card, o snapshot mensal e o trend usam a MESMA função.
  const { score, components } = useMemo(
    () => computeHealthScore(summary, parasiteSummary),
    [summary, parasiteSummary],
  );

  // Quantas das dimensões essenciais de prevenção têm registro.
  // Sem NENHUMA (vacina, vermífugo, consulta), o pet não pode aparecer como
  // "100% cuidado": o cadastro está incompleto e o score seria enganoso.
  const essentialsRegistered = components.filter(
    (c) =>
      (c.key === 'vaccines' || c.key === 'parasites' || c.key === 'vet_visits') &&
      c.status !== 'na',
  ).length;
  const incomplete = essentialsRegistered === 0;

  // Cores e copy baseados no score
  const tone: 'good' | 'mid' | 'bad' = score >= 80 ? 'good' : score >= 50 ? 'mid' : 'bad';
  const palette = incomplete
    ? { bg: '#E0F2FE', fg: '#075985', accent: '#0284C7', label: 'Comece aqui' }
    : {
        good: { bg: '#DCFCE7', fg: '#166534', accent: '#16A34A', label: 'Em dia' },
        mid: { bg: '#FEF3C7', fg: '#92400E', accent: '#F59E0B', label: 'Atenção' },
        bad: { bg: '#FEE2E2', fg: '#991B1B', accent: '#DC2626', label: 'Precisa cuidar' },
      }[tone];

  const headline = incomplete
    ? `Vamos cuidar da saúde do ${petName}? 🐾`
    : tone === 'good'
      ? `${petName} está super cuidado! 🌟`
      : tone === 'mid'
        ? `${petName} está bem, falta pouca coisa`
        : `${petName} precisa de atenção`;

  // % da barra: quando incompleto, mostra progresso do cadastro essencial
  // (0–3 dimensões) em vez de um score inflado.
  const displayPct = incomplete ? Math.round((essentialsRegistered / 3) * 100) : score;

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
          {incomplete ? (
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 12,
                lineHeight: 17,
                color: palette.fg,
                opacity: 0.8,
                marginTop: 4,
              }}
            >
              Registre vacinas, vermífugo e a 1ª consulta pra acompanhar a saúde de verdade.
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'center' }}>
          {incomplete ? (
            <>
              <Text style={{ fontFamily: FONTS.display, fontSize: 30, color: palette.accent }}>
                {essentialsRegistered}
                <Text style={{ fontSize: 16, color: palette.fg, opacity: 0.6 }}>/3</Text>
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 8,
                  letterSpacing: 0.6,
                  color: palette.fg,
                  opacity: 0.7,
                  textTransform: 'uppercase',
                }}
              >
                essenciais
              </Text>
            </>
          ) : (
            <Text style={{ fontFamily: FONTS.display, fontSize: 36, color: palette.accent }}>
              {score}
              <Text style={{ fontSize: 18, color: palette.fg, opacity: 0.7 }}>%</Text>
            </Text>
          )}
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
            width: `${displayPct}%`,
            height: '100%',
            backgroundColor: palette.accent,
            borderRadius: 4,
          }}
        />
      </View>

      {/* Breakdown — 5 mini-chips horizontais */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {components.map((c) => (
          <View
            key={c.key}
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
                c.status === 'bad'
                  ? '#FCA5A5'
                  : c.status === 'warn'
                    ? '#FCD34D'
                    : c.status === 'ok'
                      ? '#86EFAC'
                      : '#E5E5E5',
            }}
          >
            <Text style={{ fontSize: 11 }}>{KIND_EMOJI[c.key]}</Text>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 10,
                color:
                  c.status === 'bad'
                    ? '#991B1B'
                    : c.status === 'warn'
                      ? '#92400E'
                      : c.status === 'ok'
                        ? '#166534'
                        : '#737373',
              }}
            >
              {c.label}: {c.detail}
            </Text>
            {c.status === 'ok' ? (
              <Text style={{ fontSize: 9, color: '#16A34A' }}>✓</Text>
            ) : c.status === 'bad' ? (
              <Text style={{ fontSize: 9, color: '#DC2626' }}>!</Text>
            ) : null}
          </View>
        ))}
      </View>

    </View>
  );
}
