import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';

import { CsvButton } from '@/components/admin/csv-button';
import { Button } from '@/components/ui/button';
import { adminUnbanUser, fetchBannedUsers, isAdminEmail, type AdminBannedRow } from '@/lib/admin';
import { downloadCsv } from '@/lib/csv';
import { FONTS } from '@/lib/fonts';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

export default function AdminBannedUsersScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const admin = isAdminEmail(session?.user.email);
  const q = useQuery({
    queryKey: ['admin-banned', search],
    queryFn: () => fetchBannedUsers(200, search),
    enabled: admin,
  });

  const unban = useMutation({
    mutationFn: (userId: string) => adminUnbanUser(userId),
    onSuccess: () => {
      toast.success('Usuário desbanido', 'Ele já pode publicar de novo.');
      qc.invalidateQueries({ queryKey: ['admin-banned'] });
    },
    onError: () => toast.error('Não consegui desbanir', 'Tenta de novo.'),
  });

  if (!session) return <Redirect href="/welcome" />;
  if (!admin) return <Redirect href="/(app)/(tabs)" />;

  const rows = q.data ?? [];

  const confirmUnban = (u: AdminBannedRow) => {
    Alert.alert('Desbanir usuário?', `${u.email ?? u.display_name ?? 'Usuário'} volta a poder publicar, comentar e mandar DM.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desbanir', onPress: () => unban.mutate(u.id) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Banidos' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={theme.brand} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted }}>
            Banidos não publicam, comentam nem mandam DM. {rows.length} {rows.length === 1 ? 'banido' : 'banidos'}.
          </Text>
          {rows.length > 0 ? <CsvButton onPress={() => downloadCsv('banidos.csv', rows.map((r) => ({ email: r.email, nome: r.display_name, banido_em: r.banned_at, motivo: r.banned_reason })))} theme={theme} /> : null}
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por e-mail ou nome"
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
            <Ionicons name="happy-outline" size={40} color={theme.textDim} />
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: theme.textMuted }}>Ninguém banido. 🎉</Text>
          </View>
        ) : null}

        {rows.map((u) => (
          <View
            key={u.id}
            style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: theme.borderLight }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }} numberOfLines={1}>
                  {u.display_name || u.email || 'Usuário'}
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }} numberOfLines={1}>
                  {u.email}
                </Text>
              </View>
              <Link href={{ pathname: '/(app)/admin/users/[id]', params: { id: u.id } }} asChild>
                <Pressable style={{ padding: 6 }}>
                  <Ionicons name="open-outline" size={18} color={theme.textMuted} />
                </Pressable>
              </Link>
            </View>
            <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textMuted }}>
              Banido em {format(parseISO(u.banned_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}
              {u.banned_reason ? ` · ${u.banned_reason}` : ''}
            </Text>
            <Button title="Desbanir" variant="secondary" onPress={() => confirmUnban(u)} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
