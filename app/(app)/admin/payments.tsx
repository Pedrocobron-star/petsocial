import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';

import { fetchCaktoEvents, fetchCaktoRevenue, isAdminEmail, type CaktoEventRow } from '@/lib/admin';
import { FONTS } from '@/lib/fonts';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

function brl(n: number | null | undefined): string {
  if (n == null) return 'R$ 0';
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

function isRefund(e: CaktoEventRow): boolean {
  return /refund|charge|estorno|cancel/i.test(e.event || '');
}
function isSale(e: CaktoEventRow): boolean {
  return !!e.matched_user && (e.amount ?? 0) > 0 && !isRefund(e);
}

export default function AdminPaymentsScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const [search, setSearch] = useState('');

  const admin = isAdminEmail(session?.user.email);
  const revQ = useQuery({ queryKey: ['admin-cakto-revenue'], queryFn: fetchCaktoRevenue, enabled: admin });
  const evQ = useQuery({ queryKey: ['admin-cakto-events', search], queryFn: () => fetchCaktoEvents(200, search), enabled: admin });

  if (!session) return <Redirect href="/welcome" />;
  if (!admin) return <Redirect href="/(app)/(tabs)" />;

  const rev = revQ.data;
  const rows = evQ.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Pagamentos · Cakto' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={revQ.isFetching || evQ.isFetching}
            onRefresh={() => {
              revQ.refetch();
              evQ.refetch();
            }}
            tintColor={theme.brand}
          />
        }
      >
        {/* Resumo de receita */}
        {rev ? (
          <View style={{ backgroundColor: '#1A1410', borderRadius: 16, padding: 16, gap: 12 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#34D399', letterSpacing: 1 }}>RECEITA · CAKTO</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 28, color: '#fff' }}>{brl(rev.total_revenue)}</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#A3A3A3' }}>
              {rev.sales_count} {rev.sales_count === 1 ? 'venda' : 'vendas'} no total · ticket médio {brl(rev.avg_ticket)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <RevStat label="Hoje" value={brl(rev.rev_today)} color="#34D399" />
              <RevStat label="7 dias" value={brl(rev.rev_7d)} color="#60A5FA" />
              <RevStat label="30 dias" value={brl(rev.rev_30d)} color="#FBBF24" />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <RevStat label="Pro pagos ativos" value={String(rev.active_pro_paid)} color="#A78BFA" />
              <RevStat label="Estornos" value={String(rev.refunds)} color="#F87171" />
              <RevStat label="Vendas 30d" value={String(rev.sales_30d)} color="#34D399" />
            </View>
          </View>
        ) : revQ.isLoading ? (
          <ActivityIndicator color={theme.brand} style={{ marginTop: 20 }} />
        ) : null}

        {(revQ.isError || evQ.isError) ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#EF4444' }}>Erro ao carregar. Rode supabase/admin-payments.sql.</Text>
        ) : null}

        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
          Estorno do dinheiro é feito no painel do Cakto. Aqui você vê tudo e pode revogar o Pro do comprador (toque na transação).
        </Text>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por e-mail, pedido ou evento"
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

        {evQ.isLoading ? <ActivityIndicator color={theme.brand} style={{ marginTop: 16 }} /> : null}
        {!evQ.isLoading && rows.length === 0 ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted, textAlign: 'center', marginTop: 16 }}>
            Nenhuma transação ainda.
          </Text>
        ) : null}

        {rows.map((e) => {
          const refund = isRefund(e);
          const sale = isSale(e);
          const inner = (
            <View
              style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 12, gap: 6, borderWidth: 1, borderColor: theme.borderLight }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }} numberOfLines={1}>
                    {e.email || 'sem e-mail'}
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }} numberOfLines={1}>
                    {e.event || 'evento'}
                    {e.order_id ? ` · ${e.order_id}` : ''}
                  </Text>
                </View>
                <Text style={{ fontFamily: FONTS.display, fontSize: 15, color: refund ? '#F87171' : sale ? '#34D399' : theme.textMuted }}>
                  {refund ? '-' : ''}
                  {brl(e.amount)}
                </Text>
                {e.matched_user ? <Ionicons name="chevron-forward" size={16} color={theme.textDim} /> : null}
              </View>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textMuted }}>
                {format(parseISO(e.created_at), "d MMM 'às' HH:mm", { locale: ptBR })}
                {e.matched_user ? '' : ' · usuário não encontrado'}
              </Text>
            </View>
          );
          return e.matched_user ? (
            <Link key={e.id} href={{ pathname: '/(app)/admin/users/[id]', params: { id: e.matched_user } }} asChild>
              <Pressable>{inner}</Pressable>
            </Link>
          ) : (
            <View key={e.id}>{inner}</View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function RevStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 10, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: FONTS.display, fontSize: 15, color }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 8.5, color: '#A3A3A3', letterSpacing: 0.3, textAlign: 'center' }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
