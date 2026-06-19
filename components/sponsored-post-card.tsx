import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Linking, Platform, Pressable, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import { haptic } from '@/lib/haptics';
import { FEED_CARD_MARGIN, MAX_FEED_WIDTH } from '@/lib/layout';
import {
  type SponsoredPost,
  trackSponsoredClick,
  trackSponsoredImpression,
} from '@/lib/sponsored';
import { useTheme } from '@/providers/theme-provider';

const SCREEN_W = Dimensions.get('window').width;
const CARD_RADIUS = 22;
const MEDIA_INNER_PADDING = 6;

/**
 * Card de post patrocinado renderizado no feed.
 *
 * Decisões de UX:
 *  - Badge "Patrocinado" grande e claro no topo — transparência total.
 *  - Avatar + nome + handle do anunciante (tudo customizável pelo admin).
 *  - Imagem do post como qualquer outro post (mesmo radius, mesmo formato).
 *  - Caption opcional acima da CTA.
 *  - Barra CTA grande e proeminente embaixo, com botão de ação que abre o
 *    URL externo do anunciante.
 *  - NÃO tem like/comment/save — é um anúncio, não um post da rede.
 *  - Click em qualquer área (avatar/imagem/CTA) abre o link.
 *  - Impression registrada UMA vez por monte (uso de ref guard).
 */
export function SponsoredPostCard({ post }: { post: SponsoredPost }) {
  const { theme } = useTheme();
  const impressionLoggedRef = useRef(false);

  // Loga impression ao montar — uma vez por instância
  useEffect(() => {
    if (impressionLoggedRef.current) return;
    impressionLoggedRef.current = true;
    void trackSponsoredImpression(post.id);
  }, [post.id]);

  const openCta = async () => {
    haptic.light();
    void trackSponsoredClick(post.id);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(post.cta_url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(post.cta_url);
      }
    } catch {
      // ignora — Linking.openURL pode falhar em URLs inválidas
    }
  };

  const cardWidth = Math.min(SCREEN_W - FEED_CARD_MARGIN * 2, MAX_FEED_WIDTH);
  const mediaWidth = cardWidth - MEDIA_INNER_PADDING * 2;

  return (
    <Animated.View
      entering={FadeInDown.duration(360).easing(Easing.out(Easing.cubic))}
      style={{
        width: cardWidth,
        alignSelf: 'center',
        marginBottom: 16,
        backgroundColor: theme.surface,
        borderRadius: CARD_RADIUS,
        overflow: 'hidden',
        shadowColor: '#7C2D12',
        shadowOpacity: 0.04,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
        borderWidth: 1,
        borderColor: theme.borderLight,
      }}
    >
      {/* Badge Patrocinado */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 0,
        }}
      >
        <Ionicons name="megaphone-outline" size={14} color="#92400E" />
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 11,
            color: '#92400E',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          Patrocinado
        </Text>
      </View>

      {/* Header: avatar + nome + handle do anunciante */}
      <Pressable
        onPress={openCta}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 10,
          gap: 11,
        }}
      >
        <SponsorAvatar
          url={post.sponsor_avatar_url}
          name={post.sponsor_name}
          size={44}
        />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: 16,
                color: theme.text,
                letterSpacing: -0.3,
              }}
              numberOfLines={1}
            >
              {post.sponsor_name}
            </Text>
            {post.sponsor_verified ? (
              <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />
            ) : null}
          </View>
          {post.sponsor_handle ? (
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 12,
                color: theme.textDim,
                marginTop: 1,
              }}
              numberOfLines={1}
            >
              {post.sponsor_handle}
            </Text>
          ) : null}
        </View>
        <Ionicons name="open-outline" size={18} color={theme.textDim} />
      </Pressable>

      {/* Mídia */}
      <Pressable
        onPress={openCta}
        style={{
          paddingHorizontal: MEDIA_INNER_PADDING,
          paddingBottom: MEDIA_INNER_PADDING,
        }}
      >
        <View
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: '#F5F3F0',
            width: mediaWidth,
            aspectRatio: 1,
          }}
        >
          <Image
            source={{ uri: post.media_url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={200}
          />
        </View>
      </Pressable>

      {/* Caption */}
      {post.content ? (
        <View style={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 10 }}>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              lineHeight: 20,
              color: theme.text,
            }}
          >
            {post.content}
          </Text>
        </View>
      ) : null}

      {/* CTA bar — botão grande com URL */}
      <Pressable
        onPress={openCta}
        accessibilityRole="link"
        accessibilityLabel={`${post.cta_label}: abrir ${post.sponsor_name}`}
        style={{
          marginHorizontal: 14,
          marginBottom: 14,
          backgroundColor: '#F97316',
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          shadowColor: '#F97316',
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 15,
              color: '#FFFFFF',
            }}
            numberOfLines={1}
          >
            {post.cta_label}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: '#FFFFFF',
              opacity: 0.85,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {prettifyUrl(post.cta_url)}
          </Text>
        </View>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.22)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ----------------------------------------------------------------------------
// Avatar do anunciante (com fallback pra inicial estilizada)
// ----------------------------------------------------------------------------

function SponsorAvatar({
  url,
  name,
  size,
}: {
  url: string | null;
  name: string;
  size: number;
}) {
  const [errored, setErrored] = useState(false);
  if (url && !errored) {
    return (
      <Image
        source={{ uri: url }}
        onError={() => setErrored(true)}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#FED7AA',
        }}
        contentFit="cover"
        transition={200}
      />
    );
  }
  const initial = (name?.trim().charAt(0) || '?').toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FED7AA',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: FONTS.display, fontSize: size * 0.42, color: '#9A3412' }}>
        {initial}
      </Text>
    </View>
  );
}

function prettifyUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return url;
  }
}
