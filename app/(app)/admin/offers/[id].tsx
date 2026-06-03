import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { OfferForm } from '@/components/admin/offer-form';
import { FONTS } from '@/lib/fonts';
import { adminDeleteOffer, adminFetchOffer, adminUpdateOffer, type OfferInput } from '@/lib/offers';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function EditOfferScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [saving, setSaving] = useState(false);

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;
  if (!id) return null;

  const query = useQuery({
    queryKey: ['admin-offer', id],
    queryFn: () => adminFetchOffer(id),
  });
  const offer = query.data;

  const handleSubmit = async (input: OfferInput) => {
    setSaving(true);
    try {
      await adminUpdateOffer(id, input);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-offers-list'] }),
        qc.invalidateQueries({ queryKey: ['admin-offer', id] }),
        qc.invalidateQueries({ queryKey: ['active-offers'] }),
      ]);
      toast.success('Salvo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Apagar oferta?', 'Não pode desfazer. Some da aba de vantagens.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminDeleteOffer(id);
            await Promise.all([
              qc.invalidateQueries({ queryKey: ['admin-offers-list'] }),
              qc.invalidateQueries({ queryKey: ['active-offers'] }),
            ]);
            toast.success('Apagado');
            router.replace('/(app)/admin/offers' as never);
          } catch (e) {
            toast.error('Erro ao apagar', e instanceof Error ? e.message : 'Tente de novo');
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: 'Editar oferta · Admin',
          headerShown: true,
          headerRight: () => (
            <Pressable onPress={handleDelete} hitSlop={8} style={{ paddingHorizontal: 12 }}>
              <Ionicons name="trash" size={20} color="#9F1239" />
            </Pressable>
          ),
        }}
      />

      {query.isLoading ? <ActivityIndicator color={theme.brand} style={{ padding: 30 }} /> : null}
      {query.isError ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#991B1B', padding: 16 }}>
          Erro: {query.error instanceof Error ? query.error.message : 'desconhecido'}
        </Text>
      ) : null}

      {offer ? (
        <OfferForm
          initial={offer}
          submitLabel="Salvar alterações"
          onSubmit={handleSubmit}
          submitting={saving}
        />
      ) : null}
    </View>
  );
}
