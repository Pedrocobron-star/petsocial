import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { RecallForm } from '@/components/admin/recall-form';
import { adminCreateRecall, type RecallInput } from '@/lib/recalls';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function NewRecallScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  const handleSubmit = async (input: RecallInput) => {
    setSaving(true);
    try {
      await adminCreateRecall(input);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['admin-recalls-list'] }),
        qc.invalidateQueries({ queryKey: ['recall-matches'] }),
      ]);
      toast.success('Recall criado');
      router.replace('/(app)/admin/recalls' as never);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Novo recall · Admin', headerShown: true }} />
      <RecallForm submitLabel="Criar recall" onSubmit={handleSubmit} submitting={saving} />
    </View>
  );
}
