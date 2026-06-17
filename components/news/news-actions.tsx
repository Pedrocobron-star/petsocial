import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from 'react-native';

import { FONTS } from '@/lib/fonts';
import {
  fetchFollowedCategoryIds,
  isArticleSaved,
  isRecentArticle,
  qkNews,
  setCategoryFollow,
  toggleSaveArticle,
} from '@/lib/news';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

/**
 * Selo "Novo" — matéria publicada nas últimas 48h (item 5).
 * Pílula vermelha discreta; some sozinha quando a matéria envelhece.
 */
export function NewBadge({
  publishedAt,
  style,
}: {
  publishedAt: string | null | undefined;
  style?: ViewStyle;
}) {
  if (!isRecentArticle(publishedAt)) return null;
  return (
    <View
      style={[
        {
          backgroundColor: '#E0322B',
          paddingHorizontal: 7,
          paddingVertical: 2,
          borderRadius: 6,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9.5, color: '#fff', letterSpacing: 0.8 }}>
        NOVO
      </Text>
    </View>
  );
}

/**
 * Botão "Salvar / ler depois" de matéria (item 3). Toggle de bookmark com
 * estado otimista + toast. Só faz sentido logado (telas dentro do (app)).
 */
export function SaveArticleButton({ articleId }: { articleId: string }) {
  const { theme } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const savedQ = useQuery({
    queryKey: qkNews.articleSaved(articleId),
    queryFn: () => isArticleSaved(articleId),
  });
  const saved = savedQ.data ?? false;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !saved;
    qc.setQueryData(qkNews.articleSaved(articleId), next); // otimista
    try {
      await toggleSaveArticle(articleId, next);
      qc.invalidateQueries({ queryKey: qkNews.saved() });
      toast.success(next ? 'Salva!' : 'Removida', next ? 'Veja em Salvas.' : undefined);
    } catch (e: unknown) {
      qc.setQueryData(qkNews.articleSaved(articleId), !next); // rollback
      toast.error('Ops', e instanceof Error ? e.message : 'Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remover dos salvos' : 'Salvar matéria'}
      style={({ pressed }) => ({
        width: 52,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: saved ? theme.brandSurface : theme.surface,
        borderWidth: 1,
        borderColor: saved ? theme.brand : theme.borderLight,
        borderRadius: 14,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator size="small" color={theme.brand} />
      ) : (
        <Ionicons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={20}
          color={saved ? theme.brand : theme.text}
        />
      )}
    </Pressable>
  );
}

/**
 * Botão "Seguir editoria" (item 4). Seguir → recebe push quando sai matéria
 * nova nessa editoria (mesmo com o app fechado).
 */
export function FollowCategoryButton({
  categoryId,
  color,
}: {
  categoryId: string;
  color: string;
}) {
  const { theme } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const followedQ = useQuery({
    queryKey: qkNews.followedCategories(),
    queryFn: fetchFollowedCategoryIds,
  });
  const following = (followedQ.data ?? []).includes(categoryId);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !following;
    try {
      await setCategoryFollow(categoryId, next);
      qc.invalidateQueries({ queryKey: qkNews.followedCategories() });
      toast.success(
        next ? 'Seguindo!' : 'Deixou de seguir',
        next ? 'Você recebe um aviso quando sair matéria nova.' : undefined,
      );
    } catch (e: unknown) {
      toast.error('Ops', e instanceof Error ? e.message : 'Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={following ? 'Deixar de seguir editoria' : 'Seguir editoria'}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: following ? color : `${color}1A`,
        borderWidth: 1,
        borderColor: following ? color : `${color}55`,
        opacity: pressed ? 0.85 : 1,
        alignSelf: 'flex-start',
      })}
    >
      {busy ? (
        <ActivityIndicator size="small" color={following ? '#fff' : color} />
      ) : (
        <Ionicons
          name={following ? 'notifications' : 'notifications-outline'}
          size={15}
          color={following ? '#fff' : color}
        />
      )}
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: following ? '#fff' : color }}>
        {following ? 'Seguindo' : 'Seguir editoria'}
      </Text>
    </Pressable>
  );
}
