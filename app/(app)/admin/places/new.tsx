import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { PlaceForm } from '@/components/admin/place-form';
import { adminCreatePlace, type PlaceAdminInput } from '@/lib/places-admin';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function NewAdminPlaceScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  const handleSubmit = async (input: PlaceAdminInput) => {
    setSaving(true);
    try {
      await adminCreatePlace(input, session.user.id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-places-list'] }),
        qc.invalidateQueries({ queryKey: ['places'] }),
      ]);
      toast.success('Lugar cadastrado!');
      router.replace('/(app)/admin/places' as never);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Novo lugar · Admin', headerShown: true }} />
      <PlaceForm submitLabel="Cadastrar lugar" onSubmit={handleSubmit} submitting={saving} />
    </View>
  );
}
