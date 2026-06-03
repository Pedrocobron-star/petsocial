import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { SponsoredForm } from '@/components/admin/sponsored-form';
import { adminCreateSponsoredPost, type SponsoredPostInput } from '@/lib/sponsored';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function NewSponsoredPostScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  const handleSubmit = async (input: SponsoredPostInput) => {
    setSaving(true);
    try {
      const created = await adminCreateSponsoredPost(input);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-sponsored-list'] }),
        qc.invalidateQueries({ queryKey: ['sponsored-active'] }),
      ]);
      toast.success('Sponsored post criado');
      router.replace({ pathname: '/(app)/admin/sponsored/[id]', params: { id: created.id } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Novo sponsored · Admin', headerShown: true }} />
      <SponsoredForm submitLabel="Criar sponsored post" onSubmit={handleSubmit} submitting={saving} />
    </View>
  );
}
