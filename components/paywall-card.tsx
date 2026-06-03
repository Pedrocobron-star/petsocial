import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { track } from '@/lib/analytics';

interface Props {
  /** Intent identifier — usado em analytics + na URL pra segmentar. */
  intent: string;
  /** Emoji do card (default 🔒). */
  emoji?: string;
  /** Título grande. */
  title: string;
  /** Descrição curta, motivação clara. */
  description: string;
  /** Texto do botão CTA. Default "Conhecer Pet Pro ⭐". */
  ctaLabel?: string;
  /** Compact reduz padding pra usar inline (não tela inteira). */
  compact?: boolean;
  style?: ViewStyle;
}

/**
 * Card de paywall reusável. Padroniza CTA do Pro pra todos os intents.
 *
 * Dispara `paywall_view` no mount (com intent), e `paywall_click` no toque
 * do CTA. Link vai pra /pro?from={intent} pra abrir a tela de conversão.
 */
export function PaywallCard({
  intent,
  emoji = '🔒',
  title,
  description,
  ctaLabel = 'Conhecer Pet Pro ⭐',
  compact = false,
  style,
}: Props) {
  useEffect(() => {
    track('paywall_view', { intent });
  }, [intent]);

  return (
    <View
      style={[
        {
          backgroundColor: '#1A1410',
          borderRadius: 18,
          padding: compact ? 14 : 18,
          gap: compact ? 8 : 12,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/* Glow decorativo */}
      <View
        style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 140,
          height: 140,
          borderRadius: 999,
          backgroundColor: '#F59E0B',
          opacity: 0.18,
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: compact ? 36 : 44,
            height: compact ? 36 : 44,
            borderRadius: 12,
            backgroundColor: '#F59E0B',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: compact ? 18 : 22 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View
            style={{
              backgroundColor: '#F59E0B',
              alignSelf: 'flex-start',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 9,
                color: '#1A1410',
                letterSpacing: 1,
              }}
            >
              ⭐ PET PRO
            </Text>
          </View>
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: compact ? 15 : 17,
              color: '#FFFFFF',
            }}
          >
            {title}
          </Text>
        </View>
      </View>

      <Text
        style={{
          fontFamily: FONTS.body,
          fontSize: compact ? 12 : 13,
          color: '#D4D4D4',
          lineHeight: compact ? 17 : 19,
        }}
      >
        {description}
      </Text>

      <Link href={`/pro?from=${encodeURIComponent(intent)}` as never} asChild>
        <Pressable
          onPress={() => track('paywall_click', { intent })}
          style={{
            backgroundColor: '#F59E0B',
            paddingVertical: compact ? 10 : 12,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: compact ? 13 : 14,
              color: '#1A1410',
            }}
          >
            {ctaLabel}
          </Text>
          <Ionicons name="arrow-forward" size={14} color="#1A1410" />
        </Pressable>
      </Link>
    </View>
  );
}
