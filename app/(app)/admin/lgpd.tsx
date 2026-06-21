import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

import { fetchLgpdRequests, isAdminEmail, type LgpdRequestRow } from '@/lib/admin';
import { FONTS } from '@/lib/fonts';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

export default function AdminLgpdScreen() {
  const { session } = useSession();
  const { theme } = useTheme();

  const admin = isAdminEmail(session?.user.email);
  const q = useQuery({ queryKey: ['admin-lgpd'], queryFn: () => fetchLgpdRequests(300), enabled: admin });

  if (!session) return <Redirect href="/welcome" />;
  if (!admin) return <Redirect href="/(app)/(tabs)" />;

  const rows = q.data ?? [];
  const exports = rows.filter((r) => r.kind === 'export').length;
  const deletes = rows.filter((r) => r.kind === 'delete').length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'LGPD · Pedidos' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={theme.brand} />}
      >
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted }}>
          Trilha dos pedidos de exportar e excluir conta (compliance LGPD). No app os pedidos são atendidos na hora (self-service); este é o registro pra comprovar.
        </Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat label="Exportações" value={exports} color="#2563EB" bg="#DBEAFE" />
          <Stat label="Exclusões" value={deletes} color="#991B1B" bg="#FEE2E2" />
          <Stat label="Total" value={rows.length} color="#166534" bg="#DCFCE7" />
        </View>

        {q.isLoading ? <ActivityIndicator color={theme.brand} style={{ marginTop: 24 }} /> : null}
        {q.isError ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#EF4444' }}>Erro ao carregar. Rode supabase/admin-lgpd.sql.</Text>
        ) : null}
        {!q.isLoading && rows.length === 0 ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted, textAlign: 'center', marginTop: 16 }}>
            Nenhum pedido de LGPD ainda.
          </Text>
        ) : null}

        {rows.map((r) => (
          <Row key={r.id} r={r} theme={theme} />
        ))}
      </ScrollView>
    </View>
  );
}

function Row({ r, theme }: { r: LgpdRequestRow; theme: ReturnType<typeof useTheme>['theme'] }) {
  const isDelete = r.kind === 'delete';
  return (
    <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: theme.borderLight }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDelete ? '#FEE2E2' : '#DBEAFE', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={isDelete ? 'trash' : 'download'} size={16} color={isDelete ? '#991B1B' : '#2563EB'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }} numberOfLines={1}>
          {r.email || 'sem e-mail'}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textMuted }}>
          {isDelete ? 'Excluir conta' : 'Exportar dados'} · {format(parseISO(r.requested_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}
        </Text>
        {r.notes ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }} numberOfLines={2}>
            {r.notes}
          </Text>
        ) : null}
      </View>
      <View style={{ backgroundColor: r.status === 'completed' ? '#DCFCE7' : '#FEF3C7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: r.status === 'completed' ? '#166534' : '#92400E' }}>
          {r.status === 'completed' ? 'ATENDIDO' : 'PENDENTE'}
        </Text>
      </View>
    </View>
  );
}

function Stat({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 12, padding: 12, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: FONTS.display, fontSize: 22, color }}>{value}</Text>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color, letterSpacing: 0.4, textAlign: 'center' }}>{label.toUpperCase()}</Text>
    </View>
  );
}
