import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { fetchFounderOverview, fetchFounders, isAdminEmail, type FounderRow } from '@/lib/admin';
import { FONTS } from '@/lib/fonts';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

type Filter = 'todos' | 'ativos' | 'expirados';

export default function AdminFounderPromoScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const [filter, setFilter] = useState<Filter>('todos');

  const admin = isAdminEmail(session?.user.email);
  const overviewQ = useQuery({ queryKey: ['admin-founder-overview'], queryFn: fetchFounderOverview, enabled: admin });
  const listQ = useQuery({ queryKey: ['admin-founders'], queryFn: () => fetchFounders(120), enabled: admin });

  if (!session) return <Redirect href="/welcome" />;
  if (!admin) return <Redirect href="/(app)/(tabs)" />;

  const ov = overviewQ.data;
  const all = listQ.data ?? [];
  const rows = all.filter((f) => (filter === 'ativos' ? f.pro_active : filter === 'expirados' ? !f.pro_active : true));
  const pct = ov ? Math.round((ov.taken / ov.limit) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Promo Fundadores' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={overviewQ.isFetching || listQ.isFetching}
            onRefresh={() => {
              overviewQ.refetch();
              listQ.refetch();
            }}
            tintColor={theme.brand}
          />
        }
      >
        {/* Card de resumo */}
        {ov ? (
          <View style={{ backgroundColor: '#1A1410', borderRadius: 16, padding: 16, gap: 12 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#F59E0B', letterSpacing: 1 }}>MEMBROS FUNDADORES</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 26, color: '#fff' }}>
              {ov.taken}/{ov.limit} <Text style={{ fontSize: 15, color: '#A3A3A3' }}>usados ({pct}%)</Text>
            </Text>
            {/* barra */}
            <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <View style={{ width: `${Math.min(100, pct)}%`, height: 8, backgroundColor: '#F59E0B' }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <MiniStat label="Restam" value={ov.remaining} color="#FBBF24" />
              <MiniStat label="Pro ativos" value={ov.pro_active} color="#34D399" />
              <MiniStat label="Expirados" value={ov.expired} color="#F87171" />
            </View>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3' }}>
              Número exibido ao público: #{ov.display_count} (real + 14, pra dar momento de largada).
            </Text>
          </View>
        ) : overviewQ.isLoading ? (
          <ActivityIndicator color={theme.brand} style={{ marginTop: 20 }} />
        ) : null}

        {overviewQ.isError ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#EF4444' }}>Erro ao carregar. Rode supabase/admin-ops-2.sql.</Text>
        ) : null}

        {/* Filtro */}
        <View style={{ flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 999, padding: 4 }}>
          {(['todos', 'ativos', 'expirados'] as Filter[]).map((f) => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? theme.brand : 'transparent', alignItems: 'center' }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: active ? '#fff' : theme.textMuted }}>
                  {f === 'todos' ? 'Todos' : f === 'ativos' ? 'Pro ativo' : 'Expirados'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {listQ.isLoading ? <ActivityIndicator color={theme.brand} style={{ marginTop: 16 }} /> : null}

        {rows.map((f) => (
          <FounderRowView key={f.id} f={f} theme={theme} />
        ))}
        {!listQ.isLoading && rows.length === 0 ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted, textAlign: 'center', marginTop: 16 }}>
            Nenhum fundador {filter === 'ativos' ? 'com Pro ativo' : filter === 'expirados' ? 'expirado' : ''} ainda.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 10, alignItems: 'center' }}>
      <Text style={{ fontFamily: FONTS.display, fontSize: 20, color }}>{value}</Text>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color: '#A3A3A3', letterSpacing: 0.4 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

function FounderRowView({ f, theme }: { f: FounderRow; theme: ReturnType<typeof useTheme>['theme'] }) {
  return (
    <Link href={{ pathname: '/(app)/admin/users/[id]', params: { id: f.id } }} asChild>
      <Pressable
        style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: theme.borderLight }}
      >
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: theme.brandSurface, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 13, color: theme.brand }}>{f.founder_number}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }} numberOfLines={1}>
            {f.display_name || f.email || 'Usuário'}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }} numberOfLines={1}>
            {f.pro_until ? `Pro até ${format(parseISO(f.pro_until), 'd MMM yyyy', { locale: ptBR })}` : 'sem Pro'}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: f.pro_active ? '#DCFCE7' : '#FEE2E2',
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: f.pro_active ? '#166534' : '#991B1B' }}>
            {f.pro_active ? 'ATIVO' : 'EXPIRADO'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
      </Pressable>
    </Link>
  );
}
