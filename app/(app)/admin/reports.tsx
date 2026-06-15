import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { adminDeleteAdoption } from '@/lib/adoption';
import {
  adminBanUser,
  adminDeleteComment,
  adminDeleteLostReport,
  adminDeletePost,
  adminResolveReport,
  fetchAdminReports,
  qkAdminReports,
  REPORT_KIND_LABELS,
  REPORT_REASON_LABELS,
  type AdminReport,
  type ReportStatus,
} from '@/lib/admin-reports';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/providers/theme-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

const FILTERS: { key: ReportStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'Abertas' },
  { key: 'reviewed', label: 'Revisadas' },
  { key: 'actioned', label: 'Tratadas' },
  { key: 'dismissed', label: 'Descartadas' },
  { key: 'all', label: 'Todas' },
];

export default function AdminReportsScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const router = useRouter();

  const [filter, setFilter] = useState<ReportStatus | 'all'>('open');
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = !!session && session.user.email === ADMIN_EMAIL;
  const query = useQuery({
    queryKey: qkAdminReports(filter),
    queryFn: () => fetchAdminReports(filter),
    refetchOnMount: 'always',
    enabled: isAdmin,
  });
  const reports = query.data ?? [];

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-reports'] });

  const run = async (id: string, fn: () => Promise<void>, okMsg: string) => {
    setBusyId(id);
    try {
      await fn();
      await invalidate();
      toast.success(okMsg);
    } catch (e) {
      toast.error('Não consegui', e instanceof Error ? e.message : 'Tenta de novo');
    } finally {
      setBusyId(null);
    }
  };

  const onResolve = (r: AdminReport, status: ReportStatus, label: string) =>
    run(r.id, () => adminResolveReport(r.id, status), label);

  const onDelete = (r: AdminReport) => {
    const KIND_LABEL: Record<string, string> = {
      post: 'post',
      comment: 'comentário',
      lost_report: 'reporte de Achados',
      adoption_listing: 'anúncio de adoção',
    };
    const deleteFn: () => Promise<unknown> =
      r.target_kind === 'post'
        ? () => adminDeletePost(r.target_id)
        : r.target_kind === 'comment'
          ? () => adminDeleteComment(r.target_id)
          : r.target_kind === 'lost_report'
            ? () => adminDeleteLostReport(r.target_id)
            : r.target_kind === 'adoption_listing'
              ? () => adminDeleteAdoption(r.target_id)
              : () => Promise.reject(new Error(`Tipo não removível: ${r.target_kind}`));
    Alert.alert(
      `Remover ${KIND_LABEL[r.target_kind] ?? 'conteúdo'}?`,
      'Hard-delete. Não dá pra desfazer. As denúncias deste alvo viram "tratadas".',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () =>
            run(
              r.id,
              async () => {
                await deleteFn();
              },
              'Conteúdo removido',
            ),
        },
      ],
    );
  };

  const onBan = (r: AdminReport) => {
    Alert.alert(
      'Banir usuário?',
      'Ele não consegue mais publicar no app. (Desbanir é via admin_ban_user(false) — UI no detalhe do usuário vem depois.)',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Banir',
          style: 'destructive',
          onPress: () =>
            run(r.id, () => adminBanUser(r.target_id, true, `denúncia: ${r.reason}`), 'Usuário banido'),
        },
      ],
    );
  };

  const openTarget = (r: AdminReport) => {
    if (r.target_kind === 'post') router.push(`/(app)/post/${r.target_id}` as never);
    else if (r.target_kind === 'user') router.push(`/(app)/admin/users/${r.target_id}` as never);
    else if (r.target_kind === 'pet') router.push(`/(app)/pet/${r.target_id}` as never);
    else if (r.target_kind === 'lost_report') router.push(`/(app)/lost-found/${r.target_id}` as never);
    else if (r.target_kind === 'adoption_listing') router.push(`/(app)/adoption/${r.target_id}` as never);
    else toast.info('Sem tela direta', `Alvo do tipo "${REPORT_KIND_LABELS[r.target_kind]}"`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Denúncias · Moderação', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
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
          <Ionicons name="shield-checkmark" size={22} color="#F87171" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#FFFFFF' }}>
              Fila de denúncias
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3', marginTop: 2 }}>
              {reports.length} {reports.length === 1 ? 'denúncia' : 'denúncias'} · {filter}
            </Text>
          </View>
        </View>

        {/* Filtros */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? theme.brand : theme.surface,
                  borderWidth: 1,
                  borderColor: active ? theme.brand : theme.borderLight,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 12,
                    color: active ? '#fff' : theme.textDim,
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {query.isLoading ? <ActivityIndicator color={theme.brand} style={{ padding: 30 }} /> : null}

        {query.isError ? (
          <View style={{ backgroundColor: '#FEE2E2', padding: 14, borderRadius: 12, gap: 4 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#991B1B' }}>
              Erro ao carregar
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#7F1D1D' }}>
              {query.error instanceof Error
                ? query.error.message
                : 'Rode supabase/admin-moderation.sql'}
            </Text>
          </View>
        ) : null}

        {reports.length === 0 && !query.isLoading && !query.isError ? (
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
            <Text style={{ fontSize: 38 }}>🛡️</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: theme.text }}>
              Nada por aqui
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, textAlign: 'center' }}>
              Nenhuma denúncia {filter === 'open' ? 'aberta' : `com status "${filter}"`}.
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          {reports.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              busy={busyId === r.id}
              onOpenTarget={() => openTarget(r)}
              onDelete={() => onDelete(r)}
              onBan={() => onBan(r)}
              onResolve={onResolve}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function ReportRow({
  report: r,
  busy,
  onOpenTarget,
  onDelete,
  onBan,
  onResolve,
}: {
  report: AdminReport;
  busy: boolean;
  onOpenTarget: () => void;
  onDelete: () => void;
  onBan: () => void;
  onResolve: (r: AdminReport, status: ReportStatus, label: string) => void;
}) {
  const { theme } = useTheme();
  const canDelete = ['post', 'comment', 'lost_report', 'adoption_listing'].includes(r.target_kind);
  const canBan = r.target_kind === 'user';
  const statusColor: Record<ReportStatus, string> = {
    open: '#B45309',
    reviewed: '#1D4ED8',
    actioned: '#166534',
    dismissed: '#6B7280',
  };

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: r.status === 'open' ? '#FCA5A5' : theme.borderLight,
      }}
    >
      {/* topo: motivo + status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            backgroundColor: '#FEF2F2',
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Ionicons name="flag" size={12} color="#B91C1C" />
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#B91C1C' }}>
            {REPORT_REASON_LABELS[r.reason] ?? r.reason}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: statusColor[r.status], textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {r.status}
        </Text>
      </View>

      {/* alvo */}
      <Pressable
        onPress={onOpenTarget}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: theme.bg,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
        }}
      >
        <Ionicons name="open-outline" size={15} color={theme.brand} />
        <Text style={{ flex: 1, fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>
          {REPORT_KIND_LABELS[r.target_kind]} denunciado
          {r.target_reports_count > 1 ? `  ·  ${r.target_reports_count} denúncias` : ''}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={theme.textDim} />
      </Pressable>

      {r.notes ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.text, lineHeight: 17 }} numberOfLines={4}>
          “{r.notes}”
        </Text>
      ) : null}

      <Text style={{ fontFamily: FONTS.body, fontSize: 10.5, color: theme.textDim }}>
        Por {r.reporter_name || r.reporter_email || 'anônimo'} ·{' '}
        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
      </Text>

      {/* ações destrutivas */}
      {(canDelete || canBan) && r.status !== 'actioned' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {canDelete ? (
            <Pressable
              onPress={onDelete}
              disabled={busy}
              style={{
                flex: 1,
                backgroundColor: '#FEE2E2',
                borderRadius: 10,
                paddingVertical: 9,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Ionicons name="trash" size={15} color="#991B1B" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: '#991B1B' }}>
                Remover conteúdo
              </Text>
            </Pressable>
          ) : null}
          {canBan ? (
            <Pressable
              onPress={onBan}
              disabled={busy}
              style={{
                flex: 1,
                backgroundColor: '#1A1410',
                borderRadius: 10,
                paddingVertical: 9,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Ionicons name="ban" size={15} color="#F87171" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: '#F87171' }}>
                Banir autor
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* triagem de status */}
      {r.status !== 'dismissed' && r.status !== 'actioned' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {r.status === 'open' ? (
            <Pressable
              onPress={() => onResolve(r, 'reviewed', 'Marcada como revisada')}
              disabled={busy}
              style={{ flex: 1, backgroundColor: theme.bg, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: theme.borderLight, opacity: busy ? 0.5 : 1 }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.textDim }}>Revisado</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => onResolve(r, 'dismissed', 'Denúncia descartada')}
            disabled={busy}
            style={{ flex: 1, backgroundColor: theme.bg, borderRadius: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: theme.borderLight, opacity: busy ? 0.5 : 1 }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.textDim }}>Descartar</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
