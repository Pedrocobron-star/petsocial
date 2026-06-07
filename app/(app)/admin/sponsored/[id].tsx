import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { SponsoredForm } from '@/components/admin/sponsored-form';
import { FONTS } from '@/lib/fonts';
import {
  adminDeleteSponsoredPost,
  adminFetchSponsoredPost,
  adminSponsoredMetrics,
  adminUpdateSponsoredPost,
  type SponsoredPostInput,
} from '@/lib/sponsored';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function EditSponsoredPostScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [saving, setSaving] = useState(false);

  const isAdmin = !!session && session.user.email === ADMIN_EMAIL;

  const postQuery = useQuery({
    queryKey: ['admin-sponsored-post', id],
    queryFn: () => adminFetchSponsoredPost(id),
    enabled: isAdmin && !!id,
  });
  const metricsQuery = useQuery({
    queryKey: ['admin-sponsored-metrics', id],
    queryFn: () => adminSponsoredMetrics(id),
    refetchInterval: 30_000,
    enabled: isAdmin && !!id,
  });

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;
  if (!id) return null;

  const post = postQuery.data;
  const metrics = metricsQuery.data;

  const handleSubmit = async (input: SponsoredPostInput) => {
    setSaving(true);
    try {
      await adminUpdateSponsoredPost(id, input);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-sponsored-list'] }),
        qc.invalidateQueries({ queryKey: ['admin-sponsored-post', id] }),
        qc.invalidateQueries({ queryKey: ['sponsored-active'] }),
      ]);
      toast.success('Salvo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Apagar sponsored post?',
      'Não pode desfazer. Métricas históricas ficam, mas o post some do feed e do painel.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminDeleteSponsoredPost(id);
              await Promise.all([
                qc.invalidateQueries({ queryKey: ['admin-sponsored-list'] }),
                qc.invalidateQueries({ queryKey: ['sponsored-active'] }),
              ]);
              toast.success('Apagado');
              router.replace('/(app)/admin/sponsored' as never);
            } catch (e) {
              toast.error('Erro ao apagar', e instanceof Error ? e.message : 'Tente de novo');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: 'Editar sponsored · Admin',
          headerShown: true,
          headerRight: () => (
            <Pressable onPress={handleDelete} hitSlop={8} style={{ paddingHorizontal: 12 }}>
              <Ionicons name="trash" size={20} color="#9F1239" />
            </Pressable>
          ),
        }}
      />

      {/* Métricas no topo (acima do form via ScrollView do form) */}
      {metrics ? (
        <View
          style={{
            backgroundColor: '#1A1410',
            padding: 14,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'space-around',
          }}
        >
          <Metric label="Impr" value={metrics.total_impressions} accent="#3B82F6" />
          <Metric label="Clicks" value={metrics.total_clicks} accent="#22C55E" />
          <Metric label="CTR" value={`${metrics.ctr_pct}%`} accent="#F97316" />
          <Metric
            label="Users ún."
            value={metrics.unique_users_impressions}
            accent="#A78BFA"
          />
        </View>
      ) : null}

      {postQuery.isLoading ? (
        <ActivityIndicator color={theme.brand} style={{ padding: 30 }} />
      ) : null}

      {postQuery.isError ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#991B1B', padding: 16 }}>
          Erro: {postQuery.error instanceof Error ? postQuery.error.message : 'desconhecido'}
        </Text>
      ) : null}

      {post ? (
        <SponsoredForm
          initial={post}
          submitLabel="Salvar alterações"
          onSubmit={handleSubmit}
          submitting={saving}
        />
      ) : null}
    </View>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: accent }}>{value}</Text>
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 9,
          color: '#A3A3A3',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
