import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { PremiumBadge } from '@/components/premium-badge';
import { adminGrantPro, adminRevokePro, PRO_GRANT_PRESETS } from '@/lib/admin';
import { FONTS } from '@/lib/fonts';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

interface UserDetail {
  user: {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    last_seen_at: string | null;
  } | null;
  pets: { id: string; name: string; species: string; breed: string | null; created_at: string }[];
  stats: {
    sessions_count: number;
    total_minutes: number;
    total_events: number;
    posts_count: number;
    pets_count: number;
  };
  recent_sessions: {
    id: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    platform: string | null;
  }[];
  recent_events: {
    id: number;
    event_name: string;
    props: Record<string, unknown>;
    platform: string | null;
    occurred_at: string;
  }[];
  subscription: {
    status: string | null;
    plan: string | null;
    current_period_end: string | null;
    granted_by_admin: boolean | null;
    granted_by_admin_email: string | null;
    granted_at: string | null;
  } | null;
}

async function fetchUserDetail(userId: string): Promise<UserDetail> {
  const { data, error } = await supabase.rpc('admin_user_detail', { p_user_id: userId });
  if (error) throw error;
  return data as UserDetail;
}

export default function AdminUserDetailScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);

  const isAdmin = !!session && session.user.email === ADMIN_EMAIL;

  const query = useQuery({
    queryKey: ['admin-user-detail', id],
    queryFn: () => fetchUserDetail(id),
    staleTime: 30_000,
    enabled: isAdmin && !!id,
  });

  const detail = query.data;
  const isPro = detail?.subscription?.status === 'active';

  const grantMutation = useMutation({
    mutationFn: ({ days, label }: { days: number | null; label: string }) =>
      adminGrantPro(id, days).then(() => label),
    onSuccess: async (label) => {
      await qc.invalidateQueries({ queryKey: ['admin-user-detail', id] });
      toast.success(`Pro concedido (${label})`);
      setPendingPreset(null);
    },
    onError: (e) => {
      toast.error('Erro ao conceder', e instanceof Error ? e.message : 'Tente de novo');
      setPendingPreset(null);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => adminRevokePro(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-user-detail', id] });
      toast.success('Pro revogado');
    },
    onError: (e) => {
      toast.error('Erro ao revogar', e instanceof Error ? e.message : 'Tente de novo');
    },
  });

  const onGrant = (days: number | null, label: string) => {
    const desc =
      days === null
        ? 'Vai conceder Pet Pro PERMANENTE (sem expiração). Tem certeza?'
        : `Vai conceder Pet Pro por ${label}.`;
    Alert.alert('Conceder Pet Pro?', desc, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Conceder',
        onPress: () => {
          setPendingPreset(label);
          grantMutation.mutate({ days, label });
        },
      },
    ]);
  };

  const onRevoke = () => {
    Alert.alert('Revogar Pet Pro?', 'O usuário volta pro plano gratuito imediatamente.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Revogar', style: 'destructive', onPress: () => revokeMutation.mutate() },
    ]);
  };

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;
  if (!id) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Usuário · Admin', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        {query.isLoading ? (
          <ActivityIndicator color={theme.brand} style={{ padding: 30 }} />
        ) : null}

        {query.isError ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#991B1B' }}>
            {query.error instanceof Error ? query.error.message : 'Erro'}
          </Text>
        ) : null}

        {detail?.user ? (
          <>
            {/* Header com identidade */}
            <View
              style={{
                backgroundColor: '#1A1410',
                borderRadius: 16,
                padding: 16,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#F97316',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#FFFFFF' }}>
                    {(detail.user.display_name ?? detail.user.email).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FFFFFF' }}>
                    {detail.user.display_name || detail.user.email.split('@')[0]}
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#A3A3A3', marginTop: 2 }}>
                    {detail.user.email}
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: '#A3A3A3', marginTop: 4 }}>
                    Cadastro: {format(parseISO(detail.user.created_at), 'd MMM yyyy', { locale: ptBR })}
                    {detail.user.last_sign_in_at
                      ? ` · Último login: ${format(parseISO(detail.user.last_sign_in_at), 'd MMM HH:mm', { locale: ptBR })}`
                      : ''}
                  </Text>
                </View>
              </View>
              {detail.user.bio ? (
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#D4D4D4', marginTop: 6 }}>
                  {detail.user.bio}
                </Text>
              ) : null}
            </View>

            {/* Stats */}
            <SectionTitle title="Estatísticas" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Stat label="Pets" value={detail.stats.pets_count} bg="#DCFCE7" color="#166534" />
              <Stat label="Posts" value={detail.stats.posts_count} bg="#DBEAFE" color="#1E40AF" />
              <Stat label="Sessions" value={detail.stats.sessions_count} bg="#EDE9FE" color="#5B21B6" />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Stat
                label="Tempo total"
                value={`${detail.stats.total_minutes}m`}
                bg="#FED7AA"
                color="#9A3412"
              />
              <Stat
                label="Eventos"
                value={detail.stats.total_events}
                bg="#FCE7F3"
                color="#9F1239"
              />
              <Stat
                label="Plano"
                value={isPro ? '⭐ Pro' : 'Free'}
                bg="#FEF3C7"
                color="#92400E"
              />
            </View>

            {/* Card de Pet Pro: grant / revoke / status */}
            <SectionTitle title="Pet Pro" />
            <View
              style={{
                backgroundColor: isPro ? '#FEF3C7' : theme.surface,
                borderRadius: 14,
                padding: 14,
                gap: 12,
                borderWidth: 1,
                borderColor: isPro ? '#F59E0B' : theme.borderLight,
              }}
            >
              {isPro ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <PremiumBadge size={20} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#92400E' }}>
                        Pet Pro ativo
                      </Text>
                      <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#92400E' }}>
                        Plano: {detail.subscription?.plan ?? '—'}
                        {detail.subscription?.current_period_end
                          ? ` · Expira em ${format(
                              parseISO(detail.subscription.current_period_end),
                              "d MMM yyyy",
                              { locale: ptBR },
                            )}`
                          : ' · Permanente'}
                      </Text>
                      {detail.subscription?.granted_by_admin ? (
                        <Text
                          style={{ fontFamily: FONTS.body, fontSize: 10, color: '#92400E', marginTop: 2 }}
                        >
                          Concedido por {detail.subscription.granted_by_admin_email ?? 'admin'}
                          {detail.subscription.granted_at
                            ? ` em ${format(parseISO(detail.subscription.granted_at), 'd MMM yyyy', { locale: ptBR })}`
                            : ''}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={onRevoke}
                      disabled={revokeMutation.isPending}
                      style={{
                        flex: 1,
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: '#FEE2E2',
                        alignItems: 'center',
                        opacity: revokeMutation.isPending ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#991B1B' }}>
                        {revokeMutation.isPending ? 'Revogando...' : 'Revogar Pro'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onGrant(null, 'Permanente')}
                      disabled={grantMutation.isPending}
                      style={{
                        flex: 1,
                        padding: 10,
                        borderRadius: 10,
                        backgroundColor: '#F59E0B',
                        alignItems: 'center',
                        opacity: grantMutation.isPending ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#FFFFFF' }}>
                        Tornar permanente
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.text }}>
                    Conceder Pet Pro pra este usuário. Útil pra beta testers, influencers,
                    premiações ou recompensas.
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {PRO_GRANT_PRESETS.map((p) => (
                      <Pressable
                        key={p.label}
                        onPress={() => onGrant(p.days, p.label)}
                        disabled={grantMutation.isPending}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 10,
                          backgroundColor: p.days === null ? '#F59E0B' : '#FED7AA',
                          opacity:
                            grantMutation.isPending && pendingPreset !== p.label ? 0.4 : 1,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: FONTS.bodyBold,
                            fontSize: 12,
                            color: p.days === null ? '#FFFFFF' : '#9A3412',
                          }}
                        >
                          {pendingPreset === p.label
                            ? 'Concedendo...'
                            : p.days === null
                              ? '⭐ ' + p.label
                              : p.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* Pets */}
            {detail.pets.length > 0 ? (
              <>
                <SectionTitle title="Pets" />
                <View style={{ gap: 6 }}>
                  {detail.pets.map((p) => (
                    <View
                      key={p.id}
                      style={{
                        backgroundColor: theme.surface,
                        padding: 10,
                        borderRadius: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        borderWidth: 1,
                        borderColor: theme.borderLight,
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>{speciesEmoji(p.species)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}
                        >
                          {p.name}
                        </Text>
                        <Text
                          style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}
                        >
                          {p.breed ?? p.species} · {format(parseISO(p.created_at), 'd MMM yyyy', { locale: ptBR })}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {/* Sessions */}
            {detail.recent_sessions.length > 0 ? (
              <>
                <SectionTitle title="Sessões recentes" />
                <View style={{ gap: 4 }}>
                  {detail.recent_sessions.map((s) => (
                    <View
                      key={s.id}
                      style={{
                        backgroundColor: theme.surface,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        borderWidth: 1,
                        borderColor: theme.borderLight,
                      }}
                    >
                      <Ionicons
                        name={s.ended_at ? 'time-outline' : 'radio'}
                        size={14}
                        color={s.ended_at ? theme.textDim : '#16A34A'}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.text }}>
                          {format(parseISO(s.started_at), "d MMM 'às' HH:mm", { locale: ptBR })}
                          {s.platform ? ` · ${s.platform}` : ''}
                        </Text>
                      </View>
                      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: theme.brand }}>
                        {s.duration_seconds
                          ? formatDuration(s.duration_seconds)
                          : 'ao vivo'}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {/* Eventos */}
            {detail.recent_events.length > 0 ? (
              <>
                <SectionTitle title="Últimos eventos" />
                <View style={{ gap: 3 }}>
                  {detail.recent_events.map((e) => (
                    <View
                      key={e.id}
                      style={{
                        backgroundColor: theme.surface,
                        paddingHorizontal: 10,
                        paddingVertical: 7,
                        borderRadius: 8,
                        gap: 2,
                        borderWidth: 1,
                        borderColor: theme.borderLight,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={{
                            fontFamily: FONTS.bodyBold,
                            fontSize: 12,
                            color: theme.text,
                            flex: 1,
                          }}
                          numberOfLines={1}
                        >
                          {e.event_name}
                        </Text>
                        <Text
                          style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}
                        >
                          {format(parseISO(e.occurred_at), 'd MMM HH:mm', { locale: ptBR })}
                        </Text>
                      </View>
                      {Object.keys(e.props ?? {}).length > 0 ? (
                        <Text
                          style={{
                            fontFamily: FONTS.body,
                            fontSize: 10,
                            color: theme.textDim,
                            fontVariant: ['tabular-nums'],
                          }}
                          numberOfLines={1}
                        >
                          {JSON.stringify(e.props)}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        fontFamily: FONTS.bodyBold,
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: theme.brand,
        marginTop: 6,
      }}
    >
      {title}
    </Text>
  );
}

function Stat({
  label,
  value,
  bg,
  color,
}: {
  label: string;
  value: number | string;
  bg: string;
  color: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        padding: 11,
        borderRadius: 12,
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Text style={{ fontFamily: FONTS.display, fontSize: 18, color }} numberOfLines={1}>
        {value}
      </Text>
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 9,
          color,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function speciesEmoji(species: string): string {
  switch (species) {
    case 'dog':
      return '🐶';
    case 'cat':
      return '🐱';
    case 'rabbit':
      return '🐰';
    case 'bird':
      return '🦜';
    case 'fish':
      return '🐠';
    case 'hamster':
      return '🐹';
    default:
      return '🐾';
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
