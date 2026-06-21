import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { fetchAuditLog, isAdminEmail, type AdminAuditRow } from '@/lib/admin';
import { FONTS } from '@/lib/fonts';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const ACTION_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  delete: { icon: 'trash', color: '#EF4444' },
  ban: { icon: 'ban', color: '#EF4444' },
  unban: { icon: 'checkmark-circle', color: '#22C55E' },
  update: { icon: 'create', color: '#3B82F6' },
  create: { icon: 'add-circle', color: '#22C55E' },
  grant: { icon: 'star', color: '#F59E0B' },
  revoke: { icon: 'remove-circle', color: '#F59E0B' },
};

export default function AdminAuditLogScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const [openId, setOpenId] = useState<string | null>(null);

  const admin = isAdminEmail(session?.user.email);
  const q = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => fetchAuditLog(200),
    enabled: admin,
  });

  if (!session) return <Redirect href="/welcome" />;
  if (!admin) return <Redirect href="/(app)/(tabs)" />;

  const rows = q.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Log de auditoria' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={theme.brand} />}
      >
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted }}>
          Tudo que foi feito pelo painel (banir, apagar, conceder Pro, editar). Rede de segurança contra erro humano.
        </Text>

        {q.isLoading ? <ActivityIndicator color={theme.brand} style={{ marginTop: 24 }} /> : null}
        {q.isError ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#EF4444' }}>Erro ao carregar.</Text>
        ) : null}
        {!q.isLoading && rows.length === 0 ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted, marginTop: 16, textAlign: 'center' }}>
            Nenhuma ação registrada ainda.
          </Text>
        ) : null}

        {rows.map((r) => (
          <AuditRow key={r.id} row={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} theme={theme} />
        ))}
      </ScrollView>
    </View>
  );
}

function AuditRow({
  row,
  open,
  onToggle,
  theme,
}: {
  row: AdminAuditRow;
  open: boolean;
  onToggle: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const m = ACTION_META[row.action] ?? { icon: 'ellipse', color: theme.textMuted };
  const hasMeta = row.meta && Object.keys(row.meta).length > 0;
  return (
    <Pressable
      onPress={hasMeta ? onToggle : undefined}
      style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: theme.borderLight }}
    >
      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: `${m.color}22`, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={m.icon} size={16} color={m.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
          {row.action} · {row.entity}
        </Text>
        {row.entity_id ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }} numberOfLines={1}>
            {row.entity_id}
          </Text>
        ) : null}
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
          {row.admin_email ?? 'admin'} · {format(parseISO(row.created_at), "d MMM 'às' HH:mm", { locale: ptBR })}
        </Text>
        {open && hasMeta ? (
          <View style={{ backgroundColor: theme.bg, borderRadius: 8, padding: 8, marginTop: 6 }}>
            <Text style={{ fontFamily: FONTS.body, fontSize: 10.5, color: theme.textMuted }} selectable>
              {JSON.stringify(row.meta, null, 2)}
            </Text>
          </View>
        ) : null}
      </View>
      {hasMeta ? <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textDim} /> : null}
    </Pressable>
  );
}
