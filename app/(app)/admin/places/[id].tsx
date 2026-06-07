import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { PlaceForm } from '@/components/admin/place-form';
import { FONTS } from '@/lib/fonts';
import { adminDeletePlace, adminFetchPlace, adminUpdatePlace, type PlaceAdminInput } from '@/lib/places-admin';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function EditAdminPlaceScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [saving, setSaving] = useState(false);

  const isAdmin = !!session && session.user.email === ADMIN_EMAIL;

  const query = useQuery({ queryKey: ['admin-place', id], queryFn: () => adminFetchPlace(id), enabled: isAdmin && !!id });
  const place = query.data;

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;
  if (!id) return null;

  const handleSubmit = async (input: PlaceAdminInput) => {
    setSaving(true);
    try {
      await adminUpdatePlace(id, input);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-places-list'] }),
        qc.invalidateQueries({ queryKey: ['admin-place', id] }),
        qc.invalidateQueries({ queryKey: ['places'] }),
      ]);
      toast.success('Salvo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Apagar lugar?', 'Não pode desfazer. Some do guia de lugares.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminDeletePlace(id);
            await qc.invalidateQueries({ queryKey: ['admin-places-list'] });
            toast.success('Apagado');
            router.replace('/(app)/admin/places' as never);
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
          title: 'Editar lugar · Admin',
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
      {place ? (
        <PlaceForm initial={place} submitLabel="Salvar alterações" onSubmit={handleSubmit} submitting={saving} />
      ) : null}
    </View>
  );
}
