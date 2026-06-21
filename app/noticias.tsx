import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { Link, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fragment } from 'react';

import { AdSlot } from '@/components/news/ad-slot';
import { MetaTags } from '@/components/meta-tags';
import { CenteredColumn } from '@/components/ui/centered-column';
import { FONTS } from '@/lib/fonts';
import { MOZART } from '@/lib/mozart';
import { fetchArticles, qkNews, type NewsArticle } from '@/lib/news';
import { useTheme } from '@/providers/theme-provider';

/**
 * JORNAL PET público — rota /noticias FORA do gate de auth. Lista as matérias
 * publicadas pra QUALQUER visitante (e pros crawlers do Google), cada uma
 * linkando pro leitor público /ler/[slug]. É canal de aquisição + SEO: dá ao
 * Google um hub com links pra todas as matérias.
 */
export default function PublicNewsIndex() {
  const { theme } = useTheme();
  const query = useQuery({
    queryKey: qkNews.articles(),
    queryFn: () => fetchArticles({ limit: 40 }),
    staleTime: 5 * 60_000,
  });
  const articles = query.data ?? [];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <MetaTags
        title="Jornal Pet: notícias e cuidados | Maestro Pet"
        description="Saúde, comportamento, alimentação e curiosidades do mundo pet, pela Redação do Maestro Pet. Leia grátis, sem login."
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Nav */}
        <View
          style={{ backgroundColor: '#FFFBF5' }}
          className="flex-row items-center justify-between border-b border-orange-100 px-5 py-3"
        >
          <Link href="/welcome" asChild>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image source={{ uri: MOZART.rosto }} style={{ width: 30, height: 30 }} contentFit="contain" />
              <Text style={{ fontFamily: FONTS.display, fontSize: 19, color: '#1A1410' }}>Maestro Pet</Text>
            </Pressable>
          </Link>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable style={{ borderRadius: 999, backgroundColor: '#F97316', paddingHorizontal: 14, paddingVertical: 7 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>Criar conta</Text>
            </Pressable>
          </Link>
        </View>

        <CenteredColumn maxWidth={720}>
          <View style={{ paddingHorizontal: 18, paddingTop: 22, paddingBottom: 8 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 30, color: '#1A1410' }}>📰 Jornal Pet</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: '#525252', marginTop: 4, lineHeight: 20 }}>
              Saúde, comportamento e curiosidades do mundo pet, pela Redação do Maestro Pet. De graça,
              sem precisar de conta.
            </Text>
          </View>

          {query.isLoading ? (
            <ActivityIndicator color="#F97316" style={{ paddingVertical: 40 }} />
          ) : null}

          {!query.isLoading && articles.length === 0 ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: '#737373', textAlign: 'center', padding: 30 }}>
              Em breve, as primeiras matérias. 🐾
            </Text>
          ) : null}

          <View style={{ paddingHorizontal: 14, gap: 12 }}>
            {articles.map((a, i) => (
              <Fragment key={a.id}>
                <ArticleCard article={a} />
                {/* Espaço de anúncio a cada 4 matérias (dormente até o AdSense ligar) */}
                {(i + 1) % 4 === 0 && i < articles.length - 1 ? <AdSlot /> : null}
              </Fragment>
            ))}
          </View>

          {/* CTA de aquisição */}
          {articles.length > 0 ? (
            <View style={{ alignItems: 'center', paddingHorizontal: 18, paddingTop: 28 }}>
              <Link href="/(auth)/sign-up" asChild>
                <Pressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: '#F97316',
                    paddingHorizontal: 22,
                    paddingVertical: 14,
                    borderRadius: 14,
                  }}
                >
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#fff' }}>
                    Criar conta grátis no Maestro Pet
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </Pressable>
              </Link>
            </View>
          ) : null}
        </CenteredColumn>
      </ScrollView>
    </SafeAreaView>
  );
}

function ArticleCard({ article }: { article: NewsArticle }) {
  const cat = article.category ?? null;
  return (
    <Link href={{ pathname: '/ler/[slug]', params: { slug: article.slug } }} asChild>
      <Pressable
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#F1ECE5',
          overflow: 'hidden',
        }}
      >
        {article.cover_url ? (
          <Image
            source={{ uri: article.cover_url }}
            style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#F5F1EB' }}
            contentFit="cover"
          />
        ) : null}
        <View style={{ padding: 14, gap: 6 }}>
          {cat ? (
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: cat.color || '#C2410C', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {cat.emoji} {cat.name}
            </Text>
          ) : null}
          <Text style={{ fontFamily: FONTS.display, fontSize: 19, color: '#1A1410', lineHeight: 24 }}>
            {article.title}
          </Text>
          {article.dek ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: '#525252', lineHeight: 20 }} numberOfLines={3}>
              {article.dek}
            </Text>
          ) : null}
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#A3A3A3', marginTop: 2 }}>
            {article.author_name}
            {article.published_at
              ? ` · ${format(parseISO(article.published_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}`
              : ''}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}
