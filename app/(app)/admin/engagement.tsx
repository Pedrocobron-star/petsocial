import { useQuery } from '@tanstack/react-query';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

interface TopEvent {
  event_name: string;
  total: number;
  unique_users: number;
}

interface HourBucket {
  hour_of_day: number;
  sessions: number;
}

interface Retention {
  d1_pct: number;
  d7_pct: number;
  d30_pct: number;
  cohort_size_60d: number;
}

async function fetchTopEvents(days: number): Promise<TopEvent[]> {
  const { data, error } = await supabase.rpc('admin_top_events', {
    p_days: days,
    p_limit: 30,
  });
  if (error) throw error;
  return (data ?? []) as TopEvent[];
}

async function fetchHeatmap(): Promise<HourBucket[]> {
  const { data, error } = await supabase.rpc('admin_engagement_by_hour');
  if (error) throw error;
  return (data ?? []) as HourBucket[];
}

async function fetchRetention(): Promise<Retention> {
  const { data, error } = await supabase.rpc('admin_retention');
  if (error) throw error;
  return data as Retention;
}

export default function AdminEngagementScreen() {
  const { session } = useSession();
  const { theme } = useTheme();

  const isAdmin = !!session && session.user.email === ADMIN_EMAIL;

  const topQuery = useQuery({ queryKey: ['admin-top-events', 7], queryFn: () => fetchTopEvents(7), enabled: isAdmin });
  const heatmapQuery = useQuery({ queryKey: ['admin-heatmap'], queryFn: fetchHeatmap, enabled: isAdmin });
  const retentionQuery = useQuery({ queryKey: ['admin-retention'], queryFn: fetchRetention, enabled: isAdmin });

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  const topEvents = topQuery.data ?? [];
  const heatmap = heatmapQuery.data ?? [];
  const retention = retentionQuery.data;

  // Normaliza heatmap pra 24 horas (preenche zeros)
  const hours: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour_of_day: h,
    sessions: heatmap.find((b) => b.hour_of_day === h)?.sessions ?? 0,
  }));
  const maxHourSessions = Math.max(1, ...hours.map((h) => h.sessions));

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Engajamento · Admin', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 60 }}>
        {/* Retention */}
        <SectionTitle title="Retenção" />
        {retentionQuery.isLoading ? (
          <ActivityIndicator color={theme.brand} />
        ) : retention ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <RetCard label="D1" pct={retention.d1_pct} />
            <RetCard label="D7" pct={retention.d7_pct} />
            <RetCard label="D30" pct={retention.d30_pct} />
          </View>
        ) : null}
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
          Cohort (signups últimos 60d): {retention?.cohort_size_60d ?? 0} usuários
        </Text>

        {/* Heatmap */}
        <SectionTitle title="Sessões por hora do dia · 30 dias" />
        {heatmapQuery.isLoading ? (
          <ActivityIndicator color={theme.brand} />
        ) : (
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: theme.borderLight,
              flexDirection: 'row',
              gap: 2,
              alignItems: 'flex-end',
              height: 110,
            }}
          >
            {hours.map((h) => {
              const heightPct = (h.sessions / maxHourSessions) * 100;
              return (
                <View key={h.hour_of_day} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                  <View
                    style={{
                      width: '100%',
                      height: `${Math.max(2, heightPct)}%`,
                      backgroundColor: h.sessions > 0 ? '#F97316' : '#E5E5E5',
                      borderRadius: 3,
                      opacity: h.sessions > 0 ? 0.4 + (heightPct / 100) * 0.6 : 0.3,
                    }}
                  />
                  <Text
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 8,
                      color: theme.textDim,
                    }}
                  >
                    {h.hour_of_day}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Top events */}
        <SectionTitle title="Top eventos · 7 dias" />
        {topQuery.isLoading ? (
          <ActivityIndicator color={theme.brand} />
        ) : topEvents.length === 0 ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
            Sem eventos registrados ainda. O analytics_events começa a popular conforme o app é usado.
          </Text>
        ) : (
          <View style={{ gap: 4 }}>
            {topEvents.map((e, i) => {
              const maxTotal = topEvents[0]?.total ?? 1;
              const widthPct = (Number(e.total) / Number(maxTotal)) * 100;
              return (
                <View
                  key={e.event_name}
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: 10,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                    gap: 6,
                  }}
                >
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 10,
                        color: theme.textDim,
                        width: 22,
                      }}
                    >
                      #{i + 1}
                    </Text>
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
                    <Text style={{ fontFamily: FONTS.display, fontSize: 13, color: theme.brand }}>
                      {Number(e.total).toLocaleString('pt-BR')}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 4,
                      backgroundColor: '#FED7AA',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${widthPct}%`,
                        height: '100%',
                        backgroundColor: '#F97316',
                      }}
                    />
                  </View>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>
                    {Number(e.unique_users).toLocaleString('pt-BR')} usuários únicos
                  </Text>
                </View>
              );
            })}
          </View>
        )}
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
        marginTop: 4,
      }}
    >
      {title}
    </Text>
  );
}

function RetCard({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 30 ? '#166534' : pct >= 15 ? '#92400E' : '#991B1B';
  const bg = pct >= 30 ? '#DCFCE7' : pct >= 15 ? '#FEF3C7' : '#FEE2E2';
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        padding: 14,
        borderRadius: 14,
        alignItems: 'center',
        gap: 4,
      }}
    >
      <Text style={{ fontFamily: FONTS.display, fontSize: 24, color }}>{pct.toFixed(1)}%</Text>
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 10,
          color,
          letterSpacing: 0.5,
        }}
      >
        {label} retention
      </Text>
    </View>
  );
}
