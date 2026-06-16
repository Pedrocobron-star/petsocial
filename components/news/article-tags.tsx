import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import type { NewsTag } from '@/lib/news';
import { useTheme } from '@/providers/theme-provider';

/**
 * Chips das tags de uma matéria (no rodapé do artigo).
 * `linkable` → cada chip navega pra /news/tag/[slug] (usado na versão logada).
 * Na versão pública (/ler) renderiza chips sem link (a página de tag é logada).
 */
export function ArticleTags({ tags, linkable = false }: { tags?: NewsTag[]; linkable?: boolean }) {
  const { theme } = useTheme();
  if (!tags || tags.length === 0) return null;

  const chip = (t: NewsTag) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.brandSurface,
        borderWidth: 1,
        borderColor: theme.brandLight,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 999,
      }}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.brandDark }}>
        #{t.name}
      </Text>
    </View>
  );

  return (
    <View style={{ marginTop: 24, gap: 8 }}>
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 10.5,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: theme.textDim,
        }}
      >
        Tags
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tags.map((t) =>
          linkable ? (
            <Link key={t.id} href={`/news/tag/${t.slug}` as never} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel={`Ver matérias da tag ${t.name}`}>
                {chip(t)}
              </Pressable>
            </Link>
          ) : (
            <View key={t.id}>{chip(t)}</View>
          ),
        )}
      </View>
    </View>
  );
}
