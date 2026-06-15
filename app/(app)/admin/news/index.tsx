import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Redirect, Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { FONTS } from '@/lib/fonts';
import { fetchAllArticlesAdmin, qkNews, type NewsArticle } from '@/lib/news';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function AdminNewsListScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const router = useRouter();

  const isAdmin = !!session && session.user.email === ADMIN_EMAIL;

  const query = useQuery({
    queryKey: qkNews.adminList(),
    queryFn: fetchAllArticlesAdmin,
    refetchOnMount: 'always',
    enabled: isAdmin,
  });

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  const articles = query.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Notícias · Redação', headerShown: true }} />

      {query.isLoading ? (
        <ActivityIndicator color={theme.brand} style={{ padding: 40 }} />
      ) : query.isError ? (
        <View style={{ padding: 16 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#991B1B' }}>
            Erro ao carregar matérias
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 4 }}>
            {query.error instanceof Error ? query.error.message : 'Tente novamente'}
          </Text>
        </View>
      ) : articles.length === 0 ? (
        <EmptyState
          emoji="📰"
          title="Nenhuma matéria ainda"
          description="Crie a primeira matéria do portal para começar a publicar conteúdo."
          action={
            <Button
              title="+ Nova matéria"
              onPress={() => router.push('/(app)/admin/news/new')}
            />
          }
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
          <Button
            title="+ Nova matéria"
            onPress={() => router.push('/(app)/admin/news/new')}
            fullWidth
          />
          <View style={{ gap: 10 }}>
            {articles.map((article) => (
              <ArticleRow key={article.id} article={article} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function ArticleRow({ article }: { article: NewsArticle }) {
  const { theme } = useTheme();
  return (
    <Link href={{ pathname: '/(app)/admin/news/[id]', params: { id: article.id } }} asChild>
      <Pressable
        style={{
          backgroundColor: theme.surface,
          borderRadius: 14,
          padding: 14,
          flexDirection: 'row',
          gap: 12,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StatusBadge status={article.status} />
            {article.is_featured ? (
              <Ionicons name="star" size={13} color={theme.brand} />
            ) : null}
          </View>
          <Text
            style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}
            numberOfLines={2}
          >
            {article.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {article.category ? (
              <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: theme.textMuted }}>
                {article.category.emoji} {article.category.name}
              </Text>
            ) : (
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
                Sem categoria
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="eye-outline" size={12} color={theme.textDim} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
                {article.view_count}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>
              Atualizada {format(new Date(article.updated_at), "d 'de' MMM, yyyy", { locale: ptBR })}
            </Text>
            {article.status === 'scheduled' && article.scheduled_at ? (
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: '#92400E' }}>
                · sai {format(new Date(article.scheduled_at), "d/MM 'às' HH:mm", { locale: ptBR })}
              </Text>
            ) : null}
            {article.notify_on_publish ? (
              <Ionicons name="notifications" size={11} color={theme.brand} />
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
      </Pressable>
    </Link>
  );
}

function StatusBadge({ status }: { status: NewsArticle['status'] }) {
  const { theme } = useTheme();
  // Publicada/Agendada = badges semânticos (verde/âmbar, fixos OK). Rascunho é
  // chrome neutro → usa theme.* pra não destoar do card escuro no dark mode.
  const conf =
    status === 'published'
      ? { bg: '#DCFCE7', color: '#166534', label: 'Publicada' }
      : status === 'scheduled'
        ? { bg: '#FEF3C7', color: '#92400E', label: 'Agendada' }
        : { bg: theme.borderLight, color: theme.textDim, label: 'Rascunho' };
  return (
    <View
      style={{
        backgroundColor: conf.bg,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
      }}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color: conf.color, letterSpacing: 0.4 }}>
        {conf.label.toUpperCase()}
      </Text>
    </View>
  );
}
