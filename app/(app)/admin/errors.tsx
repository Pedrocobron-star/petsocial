import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';

import { fetchAdminErrors, isAdminEmail } from '@/lib/admin';
import { FONTS } from '@/lib/fonts';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

export default function AdminErrorsScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const admin = isAdminEmail(session?.user.email);
  const q = useQuery({
    queryKey: ['admin-errors', search],
    queryFn: () => fetchAdminErrors(200, search),
    enabled: admin,
    refetchInterval: 30_000,
  });

  if (!session) return <Redirect href="/welcome" />;
  if (!admin) return <Redirect href="/(app)/(tabs)" />;

  const rows = q.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Erros do app' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={theme.brand} />}
      >
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted }}>
          Erros capturados no app (atualiza sozinho a cada 30s). {rows.length} recentes. Toque pra ver o stack.
        </Text>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por mensagem ou rota"
          placeholderTextColor={theme.textDim}
          autoCapitalize="none"
          style={{
            backgroundColor: theme.surface,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontFamily: FONTS.body,
            fontSize: 14,
            color: theme.text,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        />

        {q.isLoading ? <ActivityIndicator color={theme.brand} style={{ marginTop: 24 }} /> : null}
        {q.isError ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#EF4444' }}>
            Erro ao carregar. Rode supabase/admin-ops-2.sql.
          </Text>
        ) : null}

        {!q.isLoading && rows.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 40, gap: 8 }}>
            <Ionicons name="shield-checkmark-outline" size={40} color="#22C55E" />
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: theme.textMuted }}>Nenhum erro registrado. 🎉</Text>
          </View>
        ) : null}

        {rows.map((e) => {
          const open = openId === e.id;
          return (
            <Pressable
              key={e.id}
              onPress={() => setOpenId(open ? null : e.id)}
              style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 12, gap: 6, borderWidth: 1, borderColor: theme.borderLight }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }} numberOfLines={open ? undefined : 2}>
                {e.message}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {e.route ? <Tag label={e.route} theme={theme} /> : null}
                {e.platform ? <Tag label={e.platform} theme={theme} /> : null}
                {e.app_version ? <Tag label={`v${e.app_version}`} theme={theme} /> : null}
              </View>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
                {format(parseISO(e.created_at), "d MMM 'às' HH:mm:ss", { locale: ptBR })}
                {e.email ? ` · ${e.email}` : ' · anônimo'}
              </Text>
              {open && e.stack ? (
                <View style={{ backgroundColor: theme.bg, borderRadius: 8, padding: 10, marginTop: 4 }}>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 10.5, color: theme.textMuted }} selectable>
                    {e.stack}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Tag({ label, theme }: { label: string; theme: ReturnType<typeof useTheme>['theme'] }) {
  return (
    <View style={{ backgroundColor: theme.brandSurface, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.brand }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
