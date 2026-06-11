import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Redirect, Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import {
  adminAwardMonthlyManual,
  fetchMonthlyChampions,
  fetchPtLeaderboard,
  fetchReferralMonitor,
  previousMonthStart,
  qkMonthlyChampions,
  qkPtLeaderboard,
  qkReferralMonitor,
  type PtLeader,
} from '@/lib/admin-economy';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/providers/theme-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function AdminEconomyScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const isAdmin = !!session && session.user.email === ADMIN_EMAIL;
  const ptQ = useQuery({ queryKey: qkPtLeaderboard, queryFn: () => fetchPtLeaderboard(30), enabled: isAdmin });
  const champQ = useQuery({ queryKey: qkMonthlyChampions, queryFn: () => fetchMonthlyChampions(12), enabled: isAdmin });
  const refQ = useQuery({ queryKey: qkReferralMonitor, queryFn: () => fetchReferralMonitor(30), enabled: isAdmin });

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  const awardManual = (u: PtLeader) => {
    const month = previousMonthStart();
    Alert.alert(
      'Premiar campeão manual?',
      `${u.display_name || u.email} ganha 1 mês de Pet Pro pelo mês ${month.slice(0, 7)} (+ DM do Mozart).`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Premiar',
          onPress: async () => {
            setBusy(true);
            try {
              await adminAwardMonthlyManual(month, u.user_id);
              await qc.invalidateQueries({ queryKey: qkMonthlyChampions });
              toast.success('Campeão premiado', '1 mês de Pro concedido');
            } catch (e) {
              toast.error('Não consegui', e instanceof Error ? e.message : 'Tenta de novo');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Economia · Admin', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 100 }}>
        <View style={{ backgroundColor: '#1A1410', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name="trophy" size={22} color="#FBBF24" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#FFFFFF' }}>Economia de Tutor</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3', marginTop: 2 }}>
              Pontos · Campeões mensais · Referral
            </Text>
          </View>
        </View>

        {/* ----- Ranking de Pontos de Tutor ----- */}
        <Section title="Ranking de Pontos de Tutor" hint="Total vitalício do ledger. Use “Premiar” pra dar o mês anterior a um tutor legítimo (quando o gate deixou sem campeão).">
          {ptQ.isLoading ? <ActivityIndicator color={theme.brand} /> : null}
          {ptQ.data?.length === 0 ? <Empty text="Ninguém pontuou ainda." /> : null}
          {(ptQ.data ?? []).map((u, i) => (
            <View key={u.user_id} style={rowStyle(theme)}>
              <Text style={{ fontFamily: FONTS.display, fontSize: 15, color: theme.textDim, width: 26 }}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }} numberOfLines={1}>
                  {u.display_name || u.email || 'Tutor'}
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 10.5, color: theme.textDim }}>
                  {u.entries} lançamentos · último {u.last_at ? format(parseISO(u.last_at), 'd MMM', { locale: ptBR }) : '—'}
                </Text>
              </View>
              <Text style={{ fontFamily: FONTS.display, fontSize: 15, color: '#16A34A', marginRight: 8 }}>{u.total_pt}</Text>
              <Pressable
                onPress={() => awardManual(u)}
                disabled={busy}
                style={{ backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, opacity: busy ? 0.5 : 1 }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10.5, color: '#92400E' }}>🏆 Premiar</Text>
              </Pressable>
            </View>
          ))}
        </Section>

        {/* ----- Campeões mensais ----- */}
        <Section title="Campeões mensais" hint="Histórico do prêmio. Quando ninguém passa no gate anti-Sybil, fica registrado o motivo (note).">
          {champQ.isLoading ? <ActivityIndicator color={theme.brand} /> : null}
          {champQ.data?.length === 0 ? <Empty text="Nenhum mês fechado ainda." /> : null}
          {(champQ.data ?? []).map((c) => (
            <View key={c.month_start} style={rowStyle(theme)}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
                  {format(parseISO(c.month_start), "MMMM 'de' yyyy", { locale: ptBR })}
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: c.user_id ? '#16A34A' : '#B45309', marginTop: 1 }} numberOfLines={2}>
                  {c.user_id ? `🏆 ${c.display_name || c.email}` : `Sem campeão — ${c.note ?? '?'}`}
                </Text>
              </View>
              {c.user_id ? (
                <Text style={{ fontFamily: FONTS.display, fontSize: 13, color: theme.textDim }}>{c.points} pt</Text>
              ) : null}
            </View>
          ))}
        </Section>

        {/* ----- Monitor de referral ----- */}
        <Section title="Monitor de referral" hint="Indicadores e quantos indicados converteram/estão pendentes. Muitos convertidos em pouco tempo = possível cluster Sybil.">
          {refQ.isLoading ? <ActivityIndicator color={theme.brand} /> : null}
          {refQ.data?.length === 0 ? <Empty text="Nenhuma indicação ainda." /> : null}
          {(refQ.data ?? []).map((r) => {
            const hot = r.converted >= 8;
            return (
              <View key={r.referrer_id} style={rowStyle(theme)}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }} numberOfLines={1}>
                    {hot ? '⚠️ ' : ''}{r.display_name || r.email || 'Tutor'}
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 10.5, color: theme.textDim }}>
                    último prêmio {r.last_reward ? format(parseISO(r.last_reward), 'd MMM', { locale: ptBR }) : '—'}
                  </Text>
                </View>
                <View style={{ alignItems: 'center', paddingHorizontal: 6 }}>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 14, color: hot ? '#B91C1C' : '#16A34A' }}>{r.converted}</Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 8.5, color: theme.textDim }}>convertidos</Text>
                </View>
                <View style={{ alignItems: 'center', paddingHorizontal: 6 }}>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 14, color: '#B45309' }}>{r.pending}</Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 8.5, color: theme.textDim }}>pendentes</Text>
                </View>
              </View>
            );
          })}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: theme.brand }}>
        {title}
      </Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, lineHeight: 15 }}>{hint}</Text>
      <View style={{ gap: 6 }}>{children}</View>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, paddingVertical: 8 }}>{text}</Text>
  );
}

function rowStyle(theme: { surface: string; borderLight: string }) {
  return {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.borderLight,
  };
}
