import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import {
  adminAppRatingsSummary,
  adminListAppRatings,
  qkRatings,
  type AppRatingRow,
} from '@/lib/app-rating';
import { FONTS } from '@/lib/fonts';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';
const STAR_GOLD = '#F59E0B';

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= n ? 'star' : 'star-outline'} size={size} color={STAR_GOLD} />
      ))}
    </View>
  );
}

export default function AdminRatingsScreen() {
  const { theme } = useTheme();
  const { session } = useSession();
  const isAdmin = session?.user.email === ADMIN_EMAIL;

  const summaryQuery = useQuery({
    queryKey: qkRatings.summary,
    queryFn: adminAppRatingsSummary,
    enabled: isAdmin,
  });
  const listQuery = useQuery({
    queryKey: qkRatings.list,
    queryFn: () => adminListAppRatings(200),
    enabled: isAdmin,
  });

  if (!session) return <Redirect href="/welcome" />;
  if (!isAdmin) return <Redirect href="/(app)/(tabs)" />;

  const summary = summaryQuery.data;
  const rows = listQuery.data ?? [];
  const dist = summary
    ? [
        { star: 5, count: summary.c5 },
        { star: 4, count: summary.c4 },
        { star: 3, count: summary.c3 },
        { star: 2, count: summary.c2 },
        { star: 1, count: summary.c1 },
      ]
    : [];
  const maxCount = Math.max(1, ...dist.map((d) => d.count));

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Avaliações · Admin' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
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
              backgroundColor: STAR_GOLD,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="star" size={22} color="#1A1410" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: STAR_GOLD, letterSpacing: 1 }}>
              FEEDBACK
            </Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FFFFFF', marginTop: 2 }}>
              Avaliações do app
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3', marginTop: 2 }}>
              O que os tutores acham do Maestro Pet
            </Text>
          </View>
        </View>

        {/* Resumo */}
        {summary ? (
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.borderLight,
              flexDirection: 'row',
              gap: 16,
            }}
          >
            <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 92 }}>
              <Text style={{ fontFamily: FONTS.display, fontSize: 40, color: theme.text }}>
                {summary.avg_rating != null ? summary.avg_rating.toFixed(1) : '—'}
              </Text>
              <Stars n={Math.round(summary.avg_rating ?? 0)} size={16} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 4 }}>
                {summary.total} {summary.total === 1 ? 'avaliação' : 'avaliações'}
              </Text>
            </View>
            <View style={{ flex: 1, justifyContent: 'center', gap: 5 }}>
              {dist.map((d) => (
                <View key={d.star} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: theme.textDim, width: 28 }}>
                    {d.star}★
                  </Text>
                  <View
                    style={{
                      flex: 1,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.borderLight,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${(d.count / maxCount) * 100}%`,
                        height: '100%',
                        backgroundColor: STAR_GOLD,
                      }}
                    />
                  </View>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, width: 22, textAlign: 'right' }}>
                    {d.count}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {(summaryQuery.isLoading || listQuery.isLoading) && rows.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={theme.textDim} />
          </View>
        ) : null}

        {/* Lista */}
        {rows.map((r: AppRatingRow) => (
          <View
            key={r.id}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: theme.borderLight,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Stars n={r.rating} size={15} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
                {format(parseISO(r.created_at), "d 'de' MMM, HH:mm", { locale: ptBR })}
              </Text>
            </View>
            {r.comment ? (
              <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: theme.text, lineHeight: 20 }}>
                “{r.comment}”
              </Text>
            ) : null}
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
              {r.user_name || r.user_email || 'Tutor'}
            </Text>
          </View>
        ))}

        {!listQuery.isLoading && rows.length === 0 ? (
          <EmptyState
            emoji="⭐"
            mozart="curioso"
            title="Nenhuma avaliação ainda"
            description="Quando os tutores avaliarem o app, as notas e comentários aparecem aqui."
          />
        ) : null}
      </ScrollView>
    </View>
  );
}
