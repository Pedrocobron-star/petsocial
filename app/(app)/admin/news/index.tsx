import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Redirect, Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { CenteredColumn } from '@/components/ui/centered-column';
import { EmptyState } from '@/components/empty-state';
import { FONTS } from '@/lib/fonts';
import { fetchAllArticlesAdmin, qkNews, type NewsArticle } from '@/lib/news';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

/**
 * REDAÇÃO — painel da agenda editorial. As matérias ficam agrupadas por estado:
 *   📅 Programadas (agendadas, ordenadas pela data de saída — próxima primeiro)
 *   📝 Rascunhos
 *   ✅ Publicadas (mais recentes primeiro)
 * Assim o Pedro vê de relance o que VAI sair e o que JÁ saiu.
 */
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

  const articles = useMemo(() => query.data ?? [], [query.data]);

  const groups = useMemo(() => {
    const scheduled = articles
      .filter((a) => a.status === 'scheduled')
      .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''));
    const drafts = articles
      .filter((a) => a.status === 'draft')
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const published = articles
      .filter((a) => a.status === 'published')
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));
    return { scheduled, drafts, published };
  }, [articles]);

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Redação · Jornal Pet', headerShown: true }} />

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
          action={<Button title="+ Nova matéria" onPress={() => router.push('/(app)/admin/news/new')} />}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingVertical: 16, paddingBottom: 100 }}>
          <CenteredColumn maxWidth={640}>
            <View style={{ paddingHorizontal: 16, gap: 14 }}>
              {/* Resumo + ação */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <StatCard label="Programadas" value={groups.scheduled.length} tint="#FEF3C7" tintText="#92400E" />
                <StatCard label="Rascunhos" value={groups.drafts.length} tint={theme.borderLight} tintText={theme.textMuted} />
                <StatCard label="Publicadas" value={groups.published.length} tint="#DCFCE7" tintText="#166534" />
              </View>
              <Button title="+ Nova matéria" onPress={() => router.push('/(app)/admin/news/new')} fullWidth />

              {/* 📅 PROGRAMADAS — agenda */}
              {groups.scheduled.length > 0 ? (
                <View style={{ gap: 10 }}>
                  <SectionHeader emoji="📅" label="Programadas" hint="próxima a sair no topo" color="#92400E" />
                  {groups.scheduled.map((a) => (
                    <ScheduledRow key={a.id} article={a} />
                  ))}
                </View>
              ) : null}

              {/* 📝 RASCUNHOS */}
              {groups.drafts.length > 0 ? (
                <View style={{ gap: 10 }}>
                  <SectionHeader emoji="📝" label="Rascunhos" color={theme.textMuted} />
                  {groups.drafts.map((a) => (
                    <ArticleRow key={a.id} article={a} />
                  ))}
                </View>
              ) : null}

              {/* ✅ PUBLICADAS */}
              {groups.published.length > 0 ? (
                <View style={{ gap: 10 }}>
                  <SectionHeader emoji="✅" label="Publicadas" hint="recentes primeiro" color="#166534" />
                  {groups.published.map((a) => (
                    <ArticleRow key={a.id} article={a} />
                  ))}
                </View>
              ) : null}
            </View>
          </CenteredColumn>
        </ScrollView>
      )}
    </View>
  );
}

function StatCard({ label, value, tint, tintText }: { label: string; value: number; tint: string; tintText: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: tint, borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: tintText }}>{value}</Text>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10.5, color: tintText, letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

function SectionHeader({ emoji, label, hint, color }: { emoji: string; label: string; hint?: string; color: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: theme.text, letterSpacing: -0.3 }}>{label}</Text>
      {hint ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>· {hint}</Text>
      ) : null}
      <View style={{ flex: 1, height: 2, backgroundColor: color, opacity: 0.5 }} />
    </View>
  );
}

/** Linha de matéria programada — destaque tipo agenda (data/hora na esquerda). */
function ScheduledRow({ article }: { article: NewsArticle }) {
  const { theme } = useTheme();
  const when = article.scheduled_at ? new Date(article.scheduled_at) : null;
  const dd = when ? format(when, 'dd', { locale: ptBR }) : '--';
  const mon = when ? format(when, 'MMM', { locale: ptBR }) : '';
  const hm = when ? format(when, 'HH:mm', { locale: ptBR }) : '';
  return (
    <Link href={{ pathname: '/(app)/admin/news/[id]', params: { id: article.id } }} asChild>
      <Pressable
        style={{
          flexDirection: 'row',
          gap: 12,
          backgroundColor: theme.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#FCD34D',
          padding: 12,
          alignItems: 'center',
        }}
      >
        {/* Rail de data (estilo agenda/calendário) */}
        <View
          style={{
            width: 56,
            borderRadius: 10,
            backgroundColor: '#FEF3C7',
            paddingVertical: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#92400E', lineHeight: 24 }}>{dd}</Text>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: '#92400E', textTransform: 'uppercase' }}>
            {mon}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="time-outline" size={13} color="#92400E" />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#92400E' }}>{hm}</Text>
            {article.notify_on_publish ? <Ionicons name="notifications" size={12} color={theme.brand} /> : null}
            {article.is_featured ? <Ionicons name="star" size={12} color={theme.brand} /> : null}
          </View>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }} numberOfLines={2}>
            {article.title}
          </Text>
          {article.category ? (
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: theme.textMuted }}>
              {article.category.emoji} {article.category.name}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
      </Pressable>
    </Link>
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
            {article.is_featured ? <Ionicons name="star" size={13} color={theme.brand} /> : null}
          </View>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }} numberOfLines={2}>
            {article.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {article.category ? (
              <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: theme.textMuted }}>
                {article.category.emoji} {article.category.name}
              </Text>
            ) : (
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>Sem categoria</Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="eye-outline" size={12} color={theme.textDim} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>{article.view_count}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>
            {article.status === 'published' && article.published_at
              ? `Publicada ${format(new Date(article.published_at), "d 'de' MMM, yyyy", { locale: ptBR })}`
              : `Atualizada ${format(new Date(article.updated_at), "d 'de' MMM, yyyy", { locale: ptBR })}`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
      </Pressable>
    </Link>
  );
}

function StatusBadge({ status }: { status: NewsArticle['status'] }) {
  const { theme } = useTheme();
  const conf =
    status === 'published'
      ? { bg: '#DCFCE7', color: '#166534', label: 'Publicada' }
      : status === 'scheduled'
        ? { bg: '#FEF3C7', color: '#92400E', label: 'Agendada' }
        : { bg: theme.borderLight, color: theme.textDim, label: 'Rascunho' };
  return (
    <View style={{ backgroundColor: conf.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color: conf.color, letterSpacing: 0.4 }}>
        {conf.label.toUpperCase()}
      </Text>
    </View>
  );
}
