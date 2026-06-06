import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Redirect, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

// ----------------------------------------------------------------------------
// Tipos das RPCs
// ----------------------------------------------------------------------------

interface AdminStats {
  users: { total: number; new_7d: number; new_30d: number };
  pets: { total: number; new_7d: number; by_species: Record<string, number> | null };
  posts: { total: number; new_7d: number; new_24h: number };
  health: {
    vaccinations: number;
    symptoms: number;
    vet_visits: number;
    medications: number;
    parasite_treatments: number;
    diet_logs: number;
  };
  subscriptions: { active_pro: number; free: number };
  engagement: { likes_24h: number; comments_24h: number; follows_total: number };
  errors: { total_7d: number; last_24h: number };
  generated_at: string;
}

interface EngagementOverview {
  dau: number;
  wau: number;
  mau: number;
  avg_session_seconds_7d: number;
  total_sessions_7d: number;
  total_time_seconds_7d: number;
  signups_today: number;
  signups_7d: number;
  signups_30d: number;
  top_events_7d: { event_name: string; count: number }[];
  sponsored: {
    active_count: number;
    total_impressions: number;
    total_clicks: number;
  };
  generated_at: string;
}

interface LatestSignup {
  id: string;
  email: string;
  created_at: string;
  pet_count: number;
}

// ----------------------------------------------------------------------------
// Fetchers
// ----------------------------------------------------------------------------

async function fetchAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) throw error;
  return data as AdminStats;
}

async function fetchEngagement(): Promise<EngagementOverview> {
  const { data, error } = await supabase.rpc('admin_engagement_overview');
  if (error) throw error;
  return data as EngagementOverview;
}

async function fetchLatestSignups(limit = 10): Promise<LatestSignup[]> {
  const { data, error } = await supabase.rpc('admin_latest_signups', { limit_n: limit });
  if (error) throw error;
  return (data ?? []) as LatestSignup[];
}

// ----------------------------------------------------------------------------
// Admin overview screen — KPIs + navegação para subtelas
// ----------------------------------------------------------------------------

export default function AdminScreen() {
  const { session } = useSession();
  const { theme } = useTheme();

  // Gate duplo (client + server via SECURITY DEFINER nas RPCs)
  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  const statsQuery = useQuery({
    queryKey: ['admin-stats'],
    queryFn: fetchAdminStats,
    refetchInterval: 60_000,
  });
  const engagementQuery = useQuery({
    queryKey: ['admin-engagement'],
    queryFn: fetchEngagement,
    refetchInterval: 60_000,
  });
  const signupsQuery = useQuery({
    queryKey: ['admin-latest-signups'],
    queryFn: () => fetchLatestSignups(10),
    refetchInterval: 60_000,
  });

  const stats = statsQuery.data;
  const engagement = engagementQuery.data;
  const signups = signupsQuery.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Admin · Pet Social' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 60 }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: '#1A1410',
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: '#F59E0B',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="shield-checkmark" size={22} color="#1A1410" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#F59E0B', letterSpacing: 1 }}>
              ADMIN PANEL
            </Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FFFFFF', marginTop: 2 }}>
              Pet Social Overview
            </Text>
            {engagement ? (
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3', marginTop: 2 }}>
                Atualizado {format(parseISO(engagement.generated_at), 'HH:mm:ss', { locale: ptBR })}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Quick-nav cards */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <NavCard
            href="/(app)/admin/users"
            icon="people"
            label="Usuários"
            sub="Lista + drill-down"
            color="#1E40AF"
            bg="#DBEAFE"
          />
          <NavCard
            href="/(app)/admin/sponsored"
            icon="megaphone"
            label="Sponsored"
            sub={
              engagement
                ? `${engagement.sponsored.active_count} ativos`
                : 'CRUD + métricas'
            }
            color="#9A3412"
            bg="#FED7AA"
          />
          <NavCard
            href="/(app)/admin/engagement"
            icon="analytics"
            label="Engajamento"
            sub="Retention + top events"
            color="#166534"
            bg="#DCFCE7"
          />
          <NavCard
            href="/(app)/admin/activity"
            icon="pulse"
            label="Atividade"
            sub="Feed de eventos"
            color="#5B21B6"
            bg="#EDE9FE"
          />
          <NavCard
            href="/(app)/admin/recalls"
            icon="warning"
            label="Recalls"
            sub="Alertas de produtos"
            color="#991B1B"
            bg="#FEE2E2"
          />
          <NavCard
            href="/(app)/admin/offers"
            icon="pricetags"
            label="Ofertas"
            sub="Clube de vantagens"
            color="#92400E"
            bg="#FEF3C7"
          />
          <NavCard
            href="/(app)/admin/places"
            icon="location"
            label="Lugares"
            sub="Guia pet-friendly"
            color="#0E7490"
            bg="#CFFAFE"
          />
        </View>

        {/* Loading */}
        {statsQuery.isLoading || engagementQuery.isLoading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={theme.brand} />
          </View>
        ) : null}

        {/* Error */}
        {statsQuery.isError || engagementQuery.isError ? (
          <View
            style={{
              backgroundColor: '#FEE2E2',
              padding: 14,
              borderRadius: 12,
              flexDirection: 'row',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 16 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#991B1B' }}>
                Erro ao carregar stats
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#7F1D1D', marginTop: 2 }}>
                {statsQuery.error instanceof Error
                  ? statsQuery.error.message
                  : engagementQuery.error instanceof Error
                    ? engagementQuery.error.message
                    : 'RPC não disponível — rode supabase/admin-sponsored-and-analytics.sql'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Engagement KPIs */}
        {engagement ? (
          <>
            <SectionTitle title="Engajamento · Últimos 7 dias" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatCard label="DAU" value={engagement.dau} accent="#166534" bg="#DCFCE7" />
              <StatCard label="WAU" value={engagement.wau} accent="#1E40AF" bg="#DBEAFE" />
              <StatCard label="MAU" value={engagement.mau} accent="#9A3412" bg="#FED7AA" />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatCard
                label="Tempo médio"
                value={formatDuration(engagement.avg_session_seconds_7d)}
                accent="#5B21B6"
                bg="#EDE9FE"
              />
              <StatCard
                label="Sessions 7d"
                value={engagement.total_sessions_7d}
                accent="#9F1239"
                bg="#FCE7F3"
              />
              <StatCard
                label="Horas totais"
                value={`${Math.round(engagement.total_time_seconds_7d / 3600)}h`}
                accent="#92400E"
                bg="#FEF3C7"
              />
            </View>
          </>
        ) : null}

        {/* Signups */}
        {engagement ? (
          <>
            <SectionTitle title="Cadastros" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatCard label="Hoje" value={engagement.signups_today} accent="#166534" bg="#DCFCE7" />
              <StatCard label="7d" value={engagement.signups_7d} accent="#1E40AF" bg="#DBEAFE" />
              <StatCard label="30d" value={engagement.signups_30d} accent="#9A3412" bg="#FED7AA" />
            </View>
          </>
        ) : null}

        {/* Stats clássicos */}
        {stats ? (
          <>
            <SectionTitle title="Usuários totais" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatCard label="Total" value={stats.users.total} accent="#1E40AF" bg="#DBEAFE" />
              <StatCard label="Pets" value={stats.pets.total} accent="#166534" bg="#DCFCE7" />
              <StatCard label="Posts" value={stats.posts.total} accent="#5B21B6" bg="#EDE9FE" />
            </View>

            <SectionTitle title="Conteúdo & engajamento" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatCard label="Posts 24h" value={stats.posts.new_24h} accent="#9F1239" bg="#FCE7F3" />
              <StatCard
                label="Likes 24h"
                value={stats.engagement.likes_24h}
                accent="#9F1239"
                bg="#FCE7F3"
              />
              <StatCard
                label="Comments 24h"
                value={stats.engagement.comments_24h}
                accent="#1E40AF"
                bg="#DBEAFE"
              />
            </View>

            <SectionTitle title="Saúde · Registros" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <SmallStat label="💉 Vacinas" value={stats.health.vaccinations} />
              <SmallStat label="📝 Sintomas" value={stats.health.symptoms} />
              <SmallStat label="🩺 Consultas" value={stats.health.vet_visits} />
              <SmallStat label="🧪 Remédios" value={stats.health.medications} />
              <SmallStat label="💊 Parasitas" value={stats.health.parasite_treatments} />
              <SmallStat label="🥣 Dietas" value={stats.health.diet_logs} />
            </View>

            <SectionTitle title="Monetização" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatCard
                label="⭐ Pro ativos"
                value={stats.subscriptions.active_pro}
                accent="#92400E"
                bg="#FEF3C7"
              />
              <StatCard
                label="Free"
                value={stats.subscriptions.free}
                accent="#475569"
                bg="#F1F5F9"
              />
              <StatCard
                label="Conv. %"
                value={
                  stats.subscriptions.free > 0
                    ? `${((stats.subscriptions.active_pro / (stats.subscriptions.free + stats.subscriptions.active_pro)) * 100).toFixed(1)}%`
                    : '—'
                }
                accent="#166534"
                bg="#DCFCE7"
              />
            </View>
          </>
        ) : null}

        {/* Sponsored mini-overview */}
        {engagement ? (
          <>
            <SectionTitle title="Posts patrocinados" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatCard
                label="Ativos"
                value={engagement.sponsored.active_count}
                accent="#9A3412"
                bg="#FED7AA"
              />
              <StatCard
                label="Impressões"
                value={engagement.sponsored.total_impressions}
                accent="#1E40AF"
                bg="#DBEAFE"
              />
              <StatCard
                label="Clicks"
                value={engagement.sponsored.total_clicks}
                accent="#166534"
                bg="#DCFCE7"
              />
            </View>
            <Link href={'/(app)/admin/sponsored' as never} asChild>
              <Pressable
                style={{
                  backgroundColor: theme.brand,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#FFFFFF' }}>
                  Gerenciar sponsored posts
                </Text>
              </Pressable>
            </Link>
          </>
        ) : null}

        {/* Top eventos */}
        {engagement && engagement.top_events_7d.length > 0 ? (
          <>
            <SectionTitle title="Top eventos · 7 dias" />
            <View style={{ gap: 4 }}>
              {engagement.top_events_7d.slice(0, 10).map((e) => (
                <View
                  key={e.event_name}
                  style={{
                    backgroundColor: theme.surface,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}
                      numberOfLines={1}
                    >
                      {e.event_name}
                    </Text>
                  </View>
                  <Text
                    style={{ fontFamily: FONTS.display, fontSize: 14, color: theme.brand }}
                  >
                    {formatNumber(e.count)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Erros */}
        {stats ? (
          <>
            <SectionTitle title="Saúde do sistema" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatCard
                label="Erros 24h"
                value={stats.errors.last_24h}
                accent={stats.errors.last_24h > 0 ? '#991B1B' : '#166534'}
                bg={stats.errors.last_24h > 0 ? '#FEE2E2' : '#DCFCE7'}
              />
              <StatCard
                label="Erros 7d"
                value={stats.errors.total_7d}
                accent={stats.errors.total_7d > 0 ? '#991B1B' : '#166534'}
                bg={stats.errors.total_7d > 0 ? '#FEE2E2' : '#DCFCE7'}
              />
            </View>
          </>
        ) : null}

        {/* Latest signups */}
        {signups.length > 0 ? (
          <>
            <SectionTitle title="Últimos cadastros" />
            <View style={{ gap: 6 }}>
              {signups.map((s) => (
                <Link
                  key={s.id}
                  href={{ pathname: '/(app)/admin/users/[id]', params: { id: s.id } }}
                  asChild
                >
                  <Pressable
                    style={{
                      backgroundColor: theme.surface,
                      padding: 12,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: '#FED7AA',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#9A3412' }}>
                        {s.email.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}
                        numberOfLines={1}
                      >
                        {s.email}
                      </Text>
                      <Text
                        style={{
                          fontFamily: FONTS.body,
                          fontSize: 11,
                          color: theme.textDim,
                          marginTop: 2,
                        }}
                      >
                        {format(parseISO(s.created_at), "d MMM 'às' HH:mm", { locale: ptBR })} ·{' '}
                        {s.pet_count} {s.pet_count === 1 ? 'pet' : 'pets'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
                  </Pressable>
                </Link>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Components
// ----------------------------------------------------------------------------

function NavCard({
  href,
  icon,
  label,
  sub,
  color,
  bg,
}: {
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  color: string;
  bg: string;
}) {
  return (
    <Link href={href as never} asChild>
      <Pressable
        style={{
          width: '48%',
          backgroundColor: bg,
          padding: 14,
          borderRadius: 14,
          gap: 6,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={{ fontFamily: FONTS.display, fontSize: 16, color }}>{label}</Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color, opacity: 0.75 }}>{sub}</Text>
      </Pressable>
    </Link>
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
        marginTop: 8,
      }}
    >
      {title}
    </Text>
  );
}

function StatCard({
  label,
  value,
  accent,
  bg,
}: {
  label: string;
  value: number | string;
  accent: string;
  bg: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        gap: 4,
      }}
    >
      <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: accent }} numberOfLines={1}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </Text>
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 9,
          color: accent,
          textAlign: 'center',
          letterSpacing: 0.4,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: theme.borderLight,
      }}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>{label}</Text>
      <Text style={{ fontFamily: FONTS.display, fontSize: 14, color: theme.brand }}>
        {formatNumber(value)}
      </Text>
    </View>
  );
}

function formatNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 1) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
