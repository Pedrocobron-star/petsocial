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

interface ActivityRow {
  id: number;
  user_id: string | null;
  email: string | null;
  display_name: string | null;
  event_name: string;
  props: Record<string, unknown>;
  platform: string | null;
  occurred_at: string;
}

async function fetchActivity(): Promise<ActivityRow[]> {
  const { data, error } = await supabase.rpc('admin_recent_activity', { p_limit: 200 });
  if (error) throw error;
  return (data ?? []) as ActivityRow[];
}

export default function AdminActivityScreen() {
  const { session } = useSession();
  const { theme } = useTheme();

  const isAdmin = !!session && session.user.email === ADMIN_EMAIL;

  const query = useQuery({
    queryKey: ['admin-activity'],
    queryFn: fetchActivity,
    refetchInterval: 15_000, // ao vivo, a cada 15s
    enabled: isAdmin,
  });

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  const rows = query.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Atividade · Admin', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 60 }}>
        <View
          style={{
            backgroundColor: '#1A1410',
            padding: 12,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 4,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#22C55E',
            }}
          />
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#FFFFFF', flex: 1 }}>
            Ao vivo · atualiza a cada 15s
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3' }}>
            {rows.length} eventos
          </Text>
        </View>

        {query.isLoading ? (
          <ActivityIndicator color={theme.brand} style={{ padding: 30 }} />
        ) : null}

        {query.isError ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#991B1B' }}>
            {query.error instanceof Error ? query.error.message : 'Erro'}
          </Text>
        ) : null}

        {rows.map((r) => (
          <ActivityCard key={r.id} row={r} />
        ))}

        {rows.length === 0 && !query.isLoading ? (
          <View
            style={{
              padding: 30,
              alignItems: 'center',
              backgroundColor: theme.surface,
              borderRadius: 14,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 32 }}>📡</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 14, color: theme.text }}>
              Aguardando eventos
            </Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 11,
                color: theme.textDim,
                textAlign: 'center',
              }}
            >
              Conforme usuários usarem o app, eventos aparecem aqui em tempo real
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function ActivityCard({ row }: { row: ActivityRow }) {
  const { theme } = useTheme();
  const platformIcon =
    row.platform === 'web' ? '💻' : row.platform === 'ios' ? '📱' : row.platform === 'android' ? '🤖' : '·';
  const userLabel = row.display_name || row.email?.split('@')[0] || 'anon';

  const inner = (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 10,
        padding: 10,
        gap: 4,
        borderWidth: 1,
        borderColor: theme.borderLight,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontFamily: FONTS.body, fontSize: 13 }}>{platformIcon}</Text>
        <Text
          style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text, flex: 1 }}
          numberOfLines={1}
        >
          {row.event_name}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>
          {format(parseISO(row.occurred_at), 'HH:mm:ss', { locale: ptBR })}
        </Text>
      </View>
      <Text
        style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.brand }}
        numberOfLines={1}
      >
        {userLabel}
      </Text>
      {Object.keys(row.props ?? {}).length > 0 ? (
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 10,
            color: theme.textDim,
          }}
          numberOfLines={2}
        >
          {JSON.stringify(row.props)}
        </Text>
      ) : null}
    </View>
  );

  if (row.user_id) {
    return (
      <Link href={{ pathname: '/(app)/admin/users/[id]', params: { id: row.user_id } }} asChild>
        <Pressable>{inner}</Pressable>
      </Link>
    );
  }
  return inner;
}
