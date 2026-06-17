import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ArticleListCard } from '@/components/news/article-list-card';
import { NewBadge } from '@/components/news/news-actions';
import { SponsoredPostCard } from '@/components/sponsored-post-card';
import { CenteredColumn } from '@/components/ui/centered-column';
import { FONTS } from '@/lib/fonts';
import {
  fetchArticles,
  fetchCategories,
  fetchMostReadArticles,
  fetchTags,
  qkNews,
  searchArticles,
  type NewsArticle,
  type NewsCategory,
  type NewsTag,
} from '@/lib/news';
import { fetchActiveSponsoredPosts } from '@/lib/sponsored';
import { useTheme } from '@/providers/theme-provider';

/**
 * JORNAL MAESTRO PET — primeira página estilo jornal de verdade.
 * Nameplate + data da edição · manchete · chamadas secundárias · editorias
 * (com "ver tudo") · mais lidas · publicidade. Theme-aware e pt-BR.
 */
export default function NewsPortalScreen() {
  const { theme } = useTheme();

  const categoriesQuery = useQuery({ queryKey: qkNews.categories(), queryFn: fetchCategories });
  const articlesQuery = useQuery({ queryKey: qkNews.articles(), queryFn: () => fetchArticles({ limit: 30 }) });
  const featuredQuery = useQuery({
    queryKey: qkNews.articles(undefined, true),
    queryFn: () => fetchArticles({ featured: true, limit: 1 }),
  });
  const sponsoredQuery = useQuery({
    queryKey: ['news-sponsored-slot'],
    queryFn: () => fetchActiveSponsoredPosts(1),
  });
  // "Mais lidas" sobre o acervo INTEIRO (não só as 30 mais recentes).
  const mostReadQuery = useQuery({ queryKey: qkNews.mostRead(), queryFn: () => fetchMostReadArticles(5) });
  // Tags pra faixa "Explore por tema" no topo (item 2).
  const tagsQuery = useQuery({ queryKey: qkNews.tags(), queryFn: fetchTags });

  // ===== BUSCA (debounce 300ms; >=2 chars dispara) =====
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  const searching = searchTerm.length >= 2;
  const searchQ = useQuery({
    queryKey: qkNews.search(searchTerm),
    queryFn: () => searchArticles(searchTerm),
    enabled: searching,
  });
  const searchResults = searchQ.data ?? [];

  // ===== PULL-TO-REFRESH =====
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        articlesQuery.refetch(),
        featuredQuery.refetch(),
        categoriesQuery.refetch(),
        mostReadQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const articles = articlesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const tags = tagsQuery.data ?? [];
  const sponsored = sponsoredQuery.data?.[0] ?? null;

  const lead: NewsArticle | null = featuredQuery.data?.[0] ?? articles[0] ?? null;
  const rest = lead ? articles.filter((a) => a.id !== lead.id) : articles;
  const secondary = rest.slice(0, 2);
  const mostRead = mostReadQuery.data ?? [];

  // Editorias: categorias que têm matéria (fora a manchete), com até 3 cada.
  const editorias = categories
    .map((c) => ({ category: c, items: rest.filter((a) => a.category_id === c.id).slice(0, 3) }))
    .filter((e) => e.items.length > 0);

  // Matérias órfãs (sem categoria) — pra não sumirem de toda navegação por editoria.
  const semCategoria = rest.filter((a) => a.category_id === null).slice(0, 3);

  // Inclui categorias no gate pra evitar flash da faixa de pills/editorias.
  const loading = articlesQuery.isLoading || featuredQuery.isLoading || categoriesQuery.isLoading;

  const today = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const todayCap = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: '📰 Jornal Pet',
          headerShown: true,
          headerRight: () => (
            <Link href={'/news/saved' as never} asChild>
              <Pressable
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="Matérias salvas"
                style={{ paddingHorizontal: 6 }}
              >
                <Ionicons name="bookmark-outline" size={22} color={theme.text} />
              </Pressable>
            </Link>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 56 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.brand} colors={[theme.brand]} />
        }
      >
        <CenteredColumn maxWidth={640}>
          {/* ===== NAMEPLATE ===== */}
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <View style={{ height: 2, backgroundColor: theme.text, opacity: 0.85 }} />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 5,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9.5, letterSpacing: 1.5, color: theme.brand }}>
                JORNAL
              </Text>
              <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 9.5, letterSpacing: 0.3, color: theme.textDim }}>
                {todayCap}
              </Text>
            </View>
            <View style={{ height: 1, backgroundColor: theme.borderLight }} />

            <Text
              style={{
                fontFamily: FONTS.serifExtrabold,
                fontSize: 46,
                color: theme.text,
                letterSpacing: -0.5,
                textAlign: 'center',
                marginTop: 10,
              }}
            >
              Maestro Pet
            </Text>
            <Text
              style={{
                fontFamily: FONTS.bodyMedium,
                fontSize: 11.5,
                color: theme.textDim,
                textAlign: 'center',
                marginTop: 2,
                letterSpacing: 0.2,
              }}
            >
              Saúde, comportamento e a vida dos bichos — todo dia
            </Text>
            <View style={{ height: 3, backgroundColor: theme.brand, marginTop: 12 }} />
            <View style={{ height: 1, backgroundColor: theme.text, opacity: 0.6, marginTop: 2 }} />
          </View>

          {/* ===== BUSCA ===== */}
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.borderLight,
                borderRadius: 12,
                paddingHorizontal: 12,
                height: 44,
              }}
            >
              <Ionicons name="search" size={18} color={theme.textDim} />
              <TextInput
                value={searchInput}
                onChangeText={setSearchInput}
                placeholder="Buscar matéria…"
                placeholderTextColor={theme.textDim}
                style={{ flex: 1, fontFamily: FONTS.body, fontSize: 14, color: theme.text }}
                returnKeyType="search"
                autoCapitalize="none"
              />
              {searchInput.length > 0 ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => setSearchInput('')}
                  accessibilityRole="button"
                  accessibilityLabel="Limpar busca"
                >
                  <Ionicons name="close-circle" size={18} color={theme.textDim} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {searching ? (
            <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
              {searchQ.isLoading ? (
                <ActivityIndicator color={theme.brand} style={{ marginTop: 24 }} />
              ) : searchResults.length === 0 ? (
                <EmptyState
                  emoji="🔎"
                  title="Nada encontrado"
                  description={`Nenhuma matéria pra "${searchTerm}". Tente outras palavras.`}
                />
              ) : (
                <View style={{ gap: 12 }}>
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 11,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      color: theme.textDim,
                    }}
                  >
                    {searchResults.length} resultado{searchResults.length === 1 ? '' : 's'} pra "{searchTerm}"
                  </Text>
                  {searchResults.map((a) => (
                    <ArticleListCard key={a.id} article={a} />
                  ))}
                </View>
              )}
            </View>
          ) : (
          <>
          {tags.length > 0 ? <TagStrip tags={tags} /> : null}
          <View style={{ paddingHorizontal: 16 }}>
            {loading ? (
              <ActivityIndicator color={theme.brand} style={{ marginTop: 40 }} />
            ) : articles.length === 0 ? (
              <EmptyState
                emoji="📰"
                mozart="megafone"
                title="Em breve, notícias!"
                description="A redação está preparando as primeiras matérias do Jornal Maestro Pet."
              />
            ) : (
              <>
                {/* ===== MANCHETE ===== */}
                {lead ? (
                  <View style={{ marginTop: 16 }}>
                    <Eyebrow color={theme.brand}>● MANCHETE</Eyebrow>
                    <HeroCard article={lead} />
                  </View>
                ) : null}

                {/* ===== CHAMADAS SECUNDÁRIAS (compactas — sem cortar título) ===== */}
                {secondary.length > 0 ? (
                  <View style={{ gap: 12, marginTop: 18 }}>
                    {secondary.map((a) => (
                      <ArticleListCard key={a.id} article={a} />
                    ))}
                  </View>
                ) : null}

                {/* ===== PUBLICIDADE ===== */}
                {sponsored ? (
                  <View style={{ marginTop: 22 }}>
                    <AdLabel />
                    <SponsoredPostCard post={sponsored} />
                  </View>
                ) : null}

                {/* ===== EDITORIAS (nav rápida) ===== */}
                {categories.length > 0 ? (
                  <View style={{ marginTop: 22 }}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                    >
                      {categories.map((c) => (
                        <CategoryPill key={c.id} category={c} />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {/* ===== SEÇÕES POR EDITORIA ===== */}
                {editorias.map(({ category, items }) => (
                  <EditoriaSection key={category.id} category={category} items={items} />
                ))}

                {/* ===== GERAL (matérias sem categoria) ===== */}
                {semCategoria.length > 0 ? (
                  <View style={{ marginTop: 26 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 16 }}>📰</Text>
                      <Text style={{ fontFamily: FONTS.serif, fontSize: 18, color: theme.text, letterSpacing: -0.3 }}>
                        Geral
                      </Text>
                      <View style={{ flex: 1, height: 2, backgroundColor: theme.brand, opacity: 0.6 }} />
                    </View>
                    <View style={{ gap: 12, marginTop: 12 }}>
                      {semCategoria.map((a) => (
                        <ArticleListCard key={a.id} article={a} />
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* ===== MAIS LIDAS ===== */}
                {mostRead.length >= 3 ? (
                  <View style={{ marginTop: 28 }}>
                    <RuledHeader label="Mais lidas" color={theme.brand} />
                    <View style={{ marginTop: 10 }}>
                      {mostRead.map((a, i) => (
                        <MostReadRow key={a.id} article={a} rank={i + 1} />
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            )}
          </View>
          </>
          )}
        </CenteredColumn>
      </ScrollView>
    </View>
  );
}

function Eyebrow({ children, color }: { children: string; color: string }) {
  return (
    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10.5, letterSpacing: 1, color, marginBottom: 6 }}>
      {children}
    </Text>
  );
}

function RuledHeader({ label, color }: { label: string; color: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ fontFamily: FONTS.serif, fontSize: 19, color: theme.text, letterSpacing: -0.3 }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 2, backgroundColor: color, opacity: 0.85 }} />
    </View>
  );
}

function AdLabel() {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        fontFamily: FONTS.bodyBold,
        fontSize: 10.5,
        color: theme.textDim,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 8,
      }}
    >
      Publicidade
    </Text>
  );
}

function HeroCard({ article }: { article: NewsArticle }) {
  const { theme } = useTheme();
  const cat = article.category;
  const dateLabel = article.published_at
    ? format(new Date(article.published_at), "d 'de' MMM, yyyy", { locale: ptBR })
    : null;

  const hasCover = !!article.cover_url;
  return (
    <Link href={{ pathname: '/(app)/news/[slug]', params: { slug: article.slug } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={article.title}
        style={({ pressed }) => ({
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: cat?.color ?? theme.brand,
          opacity: pressed ? 0.96 : 1,
        })}
      >
        {/* Capa de revista: imagem grande + título serifado branco sobreposto */}
        <View style={{ width: '100%', aspectRatio: 4 / 3, position: 'relative' }}>
          {hasCover ? (
            <Image
              source={{ uri: article.cover_url! }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 96, opacity: 0.5 }}>{cat?.emoji ?? '📰'}</Text>
            </View>
          )}

          {/* Gradiente SUAVE (transparente em cima → escuro embaixo) pra
              legibilidade do título sobreposto, sem linha/barra dura. */}
          <LinearGradient
            colors={['rgba(8,6,4,0)', 'rgba(8,6,4,0.5)', 'rgba(8,6,4,0.9)']}
            locations={[0, 0.55, 1]}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            pointerEvents="none"
          />

          {/* Conteúdo sobreposto */}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 7 }}>
            {cat ? (
              <View style={{ flexDirection: 'row' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: cat.color,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ fontSize: 11 }}>{cat.emoji}</Text>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10.5, color: '#fff', letterSpacing: 0.4 }}>
                    {cat.name.toUpperCase()}
                  </Text>
                </View>
              </View>
            ) : null}
            <NewBadge publishedAt={article.published_at} />
            <Text
              style={{ fontFamily: FONTS.serifExtrabold, fontSize: 28, color: '#fff', lineHeight: 33, letterSpacing: -0.3 }}
              numberOfLines={4}
            >
              {article.title}
            </Text>
            {article.dek ? (
              <Text
                style={{ fontFamily: FONTS.body, fontSize: 14, color: 'rgba(255,255,255,0.92)', lineHeight: 20 }}
                numberOfLines={2}
              >
                {article.dek}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                {article.author_name}
              </Text>
              {dateLabel ? (
                <>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>·</Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                    {dateLabel}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function EditoriaSection({ category, items }: { category: NewsCategory; items: NewsArticle[] }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginTop: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 16 }}>{category.emoji}</Text>
        <Text style={{ fontFamily: FONTS.serif, fontSize: 18, color: theme.text, letterSpacing: -0.3 }}>
          {category.name}
        </Text>
        <View style={{ flex: 1, height: 2, backgroundColor: category.color, opacity: 0.7 }} />
        <Link href={{ pathname: '/(app)/news/category/[slug]', params: { slug: category.slug } }} asChild>
          <Pressable hitSlop={6}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11.5, color: category.color }}>ver tudo →</Text>
          </Pressable>
        </Link>
      </View>
      <View style={{ gap: 12, marginTop: 12 }}>
        {items.map((a) => (
          <ArticleListCard key={a.id} article={a} />
        ))}
      </View>
    </View>
  );
}

function MostReadRow({ article, rank }: { article: NewsArticle; rank: number }) {
  const { theme } = useTheme();
  return (
    <Link href={{ pathname: '/(app)/news/[slug]', params: { slug: article.slug } }} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.borderLight,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontFamily: FONTS.serif, fontSize: 28, color: theme.brand, width: 32, textAlign: 'center' }}>
          {rank}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodySemibold, fontSize: 14, color: theme.text, lineHeight: 19 }} numberOfLines={2}>
            {article.title}
          </Text>
          {article.category ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 2 }}>
              {article.category.emoji} {article.category.name}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

function CategoryPill({ category }: { category: NewsCategory }) {
  return (
    <Link href={{ pathname: '/(app)/news/category/[slug]', params: { slug: category.slug } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Categoria ${category.name}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 999,
          backgroundColor: `${category.color}1A`,
          borderWidth: 1,
          borderColor: `${category.color}40`,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ fontSize: 14 }}>{category.emoji}</Text>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: category.color }}>{category.name}</Text>
      </Pressable>
    </Link>
  );
}

/** Faixa "Explore por tema" — tags navegáveis no topo do portal (item 2). */
function TagStrip({ tags }: { tags: NewsTag[] }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginTop: 14 }}>
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 10.5,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: theme.textDim,
          paddingHorizontal: 16,
          marginBottom: 8,
        }}
      >
        Explore por tema
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 2 }}
      >
        {tags.map((t) => (
          <TagPill key={t.id} tag={t} />
        ))}
      </ScrollView>
    </View>
  );
}

function TagPill({ tag }: { tag: NewsTag }) {
  const { theme } = useTheme();
  return (
    <Link href={`/news/tag/${tag.slug}` as never} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Tema ${tag.name}`}
        style={({ pressed }) => ({
          paddingHorizontal: 13,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.borderLight,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: theme.text }}>#{tag.name}</Text>
      </Pressable>
    </Link>
  );
}
