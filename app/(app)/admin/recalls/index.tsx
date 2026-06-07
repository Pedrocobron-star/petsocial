import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Redirect, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import {
  adminListRecalls,
  RECALL_CATEGORY_LABEL,
  RECALL_SEVERITY_LABEL,
  type Recall,
} from '@/lib/recalls';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function AdminRecallsListScreen() {
  const { session } = useSession();
  const { theme } = useTheme();

  const isAdmin = !!session && session.user.email === ADMIN_EMAIL;

  const query = useQuery({
    queryKey: ['admin-recalls-list'],
    queryFn: adminListRecalls,
    refetchOnMount: 'always',
    enabled: isAdmin,
  });
  const recalls = query.data ?? [];

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Recalls · Admin', headerShown: true }} />
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
          <Ionicons name="warning" size={22} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#FFFFFF' }}>
              Alertas de recall
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3', marginTop: 2 }}>
              {recalls.length} {recalls.length === 1 ? 'cadastrado' : 'cadastrados'}
            </Text>
          </View>
          <Link href="/(app)/admin/recalls/new" asChild>
            <Pressable
              style={{
                backgroundColor: '#F59E0B',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="add" size={16} color="#1A1410" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#1A1410' }}>Novo</Text>
            </Pressable>
          </Link>
        </View>

        {query.isLoading ? <ActivityIndicator color={theme.brand} style={{ padding: 30 }} /> : null}

        {query.isError ? (
          <View style={{ backgroundColor: '#FEE2E2', padding: 14, borderRadius: 12, gap: 4 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#991B1B' }}>
              Erro ao carregar
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#7F1D1D' }}>
              {query.error instanceof Error
                ? query.error.message
                : 'Verifique se rodou supabase/sinpatinhas-and-recalls.sql'}
            </Text>
          </View>
        ) : null}

        {recalls.length === 0 && !query.isLoading ? (
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
            <Text style={{ fontSize: 38 }}>⚠️</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: theme.text }}>
              Nenhum recall ainda
            </Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 12,
                color: theme.textDim,
                textAlign: 'center',
              }}
            >
              Cadastre recalls de Anvisa/MAPA/fabricantes. O app cruza com a ração, antiparasitário e
              medicação dos tutores.
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          {recalls.map((r) => (
            <RecallRow key={r.id} recall={r} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function RecallRow({ recall }: { recall: Recall }) {
  const { theme } = useTheme();
  const sevColor =
    recall.severity === 'high'
      ? { bg: '#FEE2E2', fg: '#991B1B' }
      : recall.severity === 'medium'
        ? { bg: '#FEF3C7', fg: '#92400E' }
        : { bg: '#F1F5F9', fg: '#475569' };

  return (
    <Link href={{ pathname: '/(app)/admin/recalls/[id]', params: { id: recall.id } }} asChild>
      <Pressable
        style={{
          backgroundColor: theme.surface,
          borderRadius: 12,
          padding: 12,
          gap: 6,
          borderWidth: 1,
          borderColor: theme.borderLight,
          opacity: recall.active ? 1 : 0.55,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              backgroundColor: sevColor.bg,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 6,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color: sevColor.fg }}>
              {RECALL_SEVERITY_LABEL[recall.severity].toUpperCase()}
            </Text>
          </View>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
            {RECALL_CATEGORY_LABEL[recall.category]} · {recall.source}
          </Text>
          {!recall.active ? (
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: theme.textDim }}>
              · inativo
            </Text>
          ) : null}
        </View>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }} numberOfLines={1}>
          {recall.title}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }} numberOfLines={1}>
          Marca: {recall.brand}
          {recall.product_name ? ` · ${recall.product_name}` : ''}
          {recall.published_at
            ? ` · ${format(parseISO(recall.published_at), 'd MMM yyyy', { locale: ptBR })}`
            : ''}
        </Text>
      </Pressable>
    </Link>
  );
}
