import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { OfferForm } from '@/components/admin/offer-form';
import { adminCreateOffer, type OfferInput } from '@/lib/offers';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function NewOfferScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  const handleSubmit = async (input: OfferInput) => {
    setSaving(true);
    try {
      await adminCreateOffer(input);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-offers-list'] }),
        qc.invalidateQueries({ queryKey: ['active-offers'] }),
      ]);
      toast.success('Oferta criada');
      router.replace('/(app)/admin/offers' as never);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Nova oferta · Admin', headerShown: true }} />
      <OfferForm submitLabel="Criar oferta" onSubmit={handleSubmit} submitting={saving} />
    </View>
  );
}
