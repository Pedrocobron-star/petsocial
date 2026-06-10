import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';

import { CenteredColumn } from './ui/centered-column';

interface LinkItem {
  href: string;
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
  label: string;
  sub: string;
  tint: string;
  tintText: string;
}

// Só funções SOCIAIS da rede — os demais apps (Saúde, Lembretes, Pet Map,
// Conquistas, Vantagens, Adoção, Achados, etc.) vivem no springboard (/phone).
const ITEMS: LinkItem[] = [
  {
    href: '/(app)/messages',
    icon: 'chatbubbles',
    label: 'Mensagens',
    sub: 'Conversas com outros tutores',
    tint: '#E0E7FF',
    tintText: '#3730A3',
  },
  {
    href: '/(app)/notifications',
    icon: 'notifications',
    label: 'Notificações',
    sub: 'Curtidas, comentários, follows',
    tint: '#FCE7F3',
    tintText: '#9D174D',
  },
  {
    href: '/(app)/saved',
    icon: 'bookmark',
    label: 'Salvos',
    sub: 'Posts pra rever depois',
    tint: '#FFEDD5',
    tintText: '#9A3412',
  },
  {
    href: '/(app)/account',
    icon: 'settings',
    label: 'Conta',
    sub: 'Configurações, plano, LGPD',
    tint: '#F3F4F6',
    tintText: '#374151',
  },
];

/**
 * Grid 2 colunas dos atalhos SOCIAIS do perfil: Mensagens, Notificações,
 * Salvos e Conta. Cores tonais consistentes.
 */
export function ProfileQuickLinks() {
  // Distribui itens em pares pra renderizar como grade 2 colunas
  const rows: LinkItem[][] = [];
  for (let i = 0; i < ITEMS.length; i += 2) {
    rows.push(ITEMS.slice(i, i + 2));
  }

  return (
    <Animated.View entering={FadeInUp.duration(300).delay(100)}>
      <CenteredColumn maxWidth={540}>
        <View style={{ marginTop: 18, gap: 8 }}>
          {rows.map((row, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <QuickLinkCard item={row[0]} />
              {row[1] ? <QuickLinkCard item={row[1]} /> : <View style={{ flex: 1 }} />}
            </View>
          ))}
        </View>
      </CenteredColumn>
    </Animated.View>
  );
}

function QuickLinkCard({ item }: { item: LinkItem }) {
  return (
    <Link href={item.href as never} asChild>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: item.tint,
          borderRadius: 14,
          padding: 14,
          minHeight: 96,
          justifyContent: 'space-between',
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.55)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {item.emoji ? (
            <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
          ) : item.icon ? (
            <Ionicons name={item.icon} size={18} color={item.tintText} />
          ) : null}
        </View>
        <View>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 14,
              color: item.tintText,
            }}
          >
            {item.label}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: item.tintText,
              opacity: 0.75,
              marginTop: 1,
            }}
          >
            {item.sub}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}
