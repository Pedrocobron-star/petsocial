import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Redirect, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { adminListSponsoredPosts, type SponsoredListRow, type SponsoredStatus } from '@/lib/sponsored';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function AdminSponsoredListScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const qc = useQueryClient();

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  const query = useQuery({
    queryKey: ['admin-sponsored-list'],
    queryFn: adminListSponsoredPosts,
    refetchOnMount: 'always',
  });

  const posts = query.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Sponsored · Admin', headerShown: true }} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
        {/* Resumo */}
        <View
          style={{
            backgroundColor: '#1A1410',
            borderRadius: 14,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Ionicons name="megaphone" size={22} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#FFFFFF' }}>
              Posts patrocinados
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3', marginTop: 2 }}>
              {posts.length} {posts.length === 1 ? 'post' : 'posts'} cadastrados
            </Text>
          </View>
          <Link href="/(app)/admin/sponsored/new" asChild>
            <Pressable
              style={{
                backgroundColor: '#F59E0B',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="add" size={16} color="#1A1410" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#1A1410' }}>
                Novo
              </Text>
            </Pressable>
          </Link>
        </View>

        {query.isLoading ? (
          <ActivityIndicator color={theme.brand} style={{ padding: 30 }} />
        ) : null}

        {query.isError ? (
          <View
            style={{
              backgroundColor: '#FEE2E2',
              padding: 14,
              borderRadius: 12,
              gap: 4,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#991B1B' }}>
              Erro ao carregar
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#7F1D1D' }}>
              {query.error instanceof Error ? query.error.message : 'Verifique se o SQL foi aplicado'}
            </Text>
          </View>
        ) : null}

        {posts.length === 0 && !query.isLoading ? (
          <View
            style={{
              backgroundColor: theme.surface,
              padding: 24,
              borderRadius: 14,
              alignItems: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            <Text style={{ fontSize: 38 }}>📢</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: theme.text }}>
              Nenhum sponsored ainda
            </Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 12,
                color: theme.textDim,
                textAlign: 'center',
              }}
            >
              Cria o primeiro post patrocinado pra começar a monetizar o feed
            </Text>
            <Link href="/(app)/admin/sponsored/new" asChild>
              <Pressable
                style={{
                  backgroundColor: theme.brand,
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 999,
                  marginTop: 6,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#FFFFFF' }}>
                  Criar primeiro
                </Text>
              </Pressable>
            </Link>
          </View>
        ) : null}

        {/* Lista */}
        <View style={{ gap: 8 }}>
          {posts.map((p) => (
            <SponsoredRow key={p.id} post={p} />
          ))}
        </View>

        {/* Refresh */}
        {posts.length > 0 ? (
          <Pressable
            onPress={() => qc.invalidateQueries({ queryKey: ['admin-sponsored-list'] })}
            style={{
              padding: 10,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
              marginTop: 8,
            }}
          >
            <Ionicons name="refresh" size={14} color={theme.textDim} />
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
              Recarregar
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SponsoredRow({ post }: { post: SponsoredListRow }) {
  const { theme } = useTheme();
  return (
    <Link
      href={{ pathname: '/(app)/admin/sponsored/[id]', params: { id: post.id } }}
      asChild
    >
      <Pressable
        style={{
          backgroundColor: theme.surface,
          borderRadius: 12,
          padding: 12,
          flexDirection: 'row',
          gap: 12,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        {/* Thumb */}
        {post.media_url ? (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              backgroundColor: '#F5F3F0',
              overflow: 'hidden',
            }}
          >
            <SponsoredThumb url={post.media_url} />
          </View>
        ) : (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              backgroundColor: '#FED7AA',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="megaphone" size={22} color="#9A3412" />
          </View>
        )}

        {/* Info */}
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text, flex: 1 }}
              numberOfLines={1}
            >
              {post.sponsor_name}
            </Text>
            <StatusPill status={post.status} />
          </View>
          {post.content ? (
            <Text
              style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}
              numberOfLines={1}
            >
              {post.content}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Mini icon="eye" value={post.impressions_count} />
            <Mini icon="hand-left" value={post.clicks_count} />
            <Mini icon="trending-up" value={`${post.ctr_pct}%`} />
          </View>
          <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>
            {format(parseISO(post.starts_at), 'd MMM', { locale: ptBR })} →{' '}
            {post.ends_at
              ? format(parseISO(post.ends_at), 'd MMM yyyy', { locale: ptBR })
              : 'sem fim'}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
      </Pressable>
    </Link>
  );
}

function SponsoredThumb({ url }: { url: string }) {
  // Simples: img tag no web, fallback de cor sólida em RN
  return (
    <View style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(globalThis as any).document ? (
        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : null}
    </View>
  );
}

function StatusPill({ status }: { status: SponsoredStatus }) {
  const conf = {
    active: { bg: '#DCFCE7', color: '#166534', label: 'Ativo' },
    scheduled: { bg: '#DBEAFE', color: '#1E40AF', label: 'Agendado' },
    expired: { bg: '#F1F5F9', color: '#475569', label: 'Expirado' },
    paused: { bg: '#FEF3C7', color: '#92400E', label: 'Pausado' },
  }[status];
  return (
    <View
      style={{
        backgroundColor: conf.bg,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
      }}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color: conf.color }}>
        {conf.label.toUpperCase()}
      </Text>
    </View>
  );
}

function Mini({
  icon,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number | string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name={icon} size={10} color="#9A3412" />
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: '#9A3412' }}>{value}</Text>
    </View>
  );
}
