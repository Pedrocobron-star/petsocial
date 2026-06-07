import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { NewsForm } from '@/components/admin/news-form';
import { adminCreateArticle, qkNews, type NewsArticleInput } from '@/lib/news';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function NewNewsArticleScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  const handleSubmit = async (input: NewsArticleInput) => {
    setSaving(true);
    try {
      await adminCreateArticle(input);
      await qc.invalidateQueries({ queryKey: qkNews.adminList() });
      toast.success('Matéria criada');
      router.replace('/(app)/admin/news');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Nova matéria · Redação', headerShown: true }} />
      <NewsForm submitLabel="Criar matéria" onSubmit={handleSubmit} submitting={saving} />
    </View>
  );
}
