import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Text, View } from 'react-native';

import { NewsForm } from '@/components/admin/news-form';
import { FONTS } from '@/lib/fonts';
import {
  adminDeleteArticle,
  adminUpdateArticle,
  fetchArticleByIdAdmin,
  qkNews,
  type NewsArticleInput,
} from '@/lib/news';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function EditNewsArticleScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [saving, setSaving] = useState(false);

  const isAdmin = !!session && session.user.email === ADMIN_EMAIL;

  const articleQuery = useQuery({
    queryKey: qkNews.adminArticle(id),
    queryFn: () => fetchArticleByIdAdmin(id),
    enabled: isAdmin && !!id,
  });

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;
  if (!id) return null;

  const article = articleQuery.data;

  const handleSubmit = async (input: NewsArticleInput) => {
    setSaving(true);
    try {
      await adminUpdateArticle(id, input);
      await Promise.all([
        qc.invalidateQueries({ queryKey: qkNews.adminList() }),
        qc.invalidateQueries({ queryKey: qkNews.adminArticle(id) }),
        qc.invalidateQueries({ queryKey: qkNews.article(input.slug) }),
        qc.invalidateQueries({ queryKey: ['news-articles'] }),
      ]);
      toast.success('Matéria salva');
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    try {
      await adminDeleteArticle(id);
      await Promise.all([
        qc.invalidateQueries({ queryKey: qkNews.adminList() }),
        qc.invalidateQueries({ queryKey: ['news-articles'] }),
      ]);
      toast.success('Matéria apagada');
      router.replace('/(app)/admin/news');
    } catch (e) {
      toast.error('Erro ao apagar', e instanceof Error ? e.message : 'Tente de novo');
    }
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      // window.confirm é síncrono no web — Alert.alert não renderiza botões lá.
      // eslint-disable-next-line no-alert
      const ok = typeof window !== 'undefined' && window.confirm('Apagar esta matéria? Não dá pra desfazer.');
      if (ok) void doDelete();
      return;
    }
    Alert.alert('Apagar matéria?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => void doDelete() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Editar matéria · Redação', headerShown: true }} />

      {articleQuery.isLoading ? (
        <ActivityIndicator color={theme.brand} style={{ padding: 40 }} />
      ) : articleQuery.isError ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#991B1B', padding: 16 }}>
          Erro: {articleQuery.error instanceof Error ? articleQuery.error.message : 'desconhecido'}
        </Text>
      ) : !article ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim, padding: 16 }}>
          Matéria não encontrada.
        </Text>
      ) : (
        <NewsForm
          initial={article}
          submitLabel="Salvar"
          onSubmit={handleSubmit}
          submitting={saving}
          onDelete={handleDelete}
        />
      )}
    </View>
  );
}
