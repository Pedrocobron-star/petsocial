import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { MOZART } from '@/lib/mozart';
import {
  createMozartPost,
  deleteMozartPost,
  fetchMozartPosts,
  qkMozartPosts,
  runMozartPublishNow,
  updateMozartPost,
  type MozartPost,
} from '@/lib/mozart-posts';
import { guessExtension, uploadToBucket } from '@/lib/storage';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

const STATUS_META: Record<MozartPost['status'], { label: string; bg: string; color: string }> = {
  draft: { label: 'RASCUNHO', bg: '#E5E5E5', color: '#525252' },
  scheduled: { label: 'AGENDADA', bg: '#FEF3C7', color: '#92400E' },
  published: { label: 'PUBLICADA', bg: '#DCFCE7', color: '#166534' },
};

export default function AdminMozartPostsScreen() {
  const { theme } = useTheme();
  const { session } = useSession();
  const isAdmin = session?.user.email === ADMIN_EMAIL;

  const listQuery = useQuery({ queryKey: qkMozartPosts, queryFn: fetchMozartPosts, enabled: isAdmin });
  const [editing, setEditing] = useState<MozartPost | 'new' | null>(null);

  if (!session) return <Redirect href="/welcome" />;
  if (!isAdmin) return <Redirect href="/(app)/(tabs)" />;

  const posts = listQuery.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Posts do Mozart · Admin' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 80 }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: '#1A1410',
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Image source={{ uri: MOZART.megafone }} style={{ width: 46, height: 46 }} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#FBBF24', letterSpacing: 1 }}>
              FEED OFICIAL
            </Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FFFFFF', marginTop: 2 }}>
              Posts do Mozart
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3', marginTop: 2 }}>
              Posta no feed pelo perfil oficial. Aparece pra todos.
            </Text>
          </View>
        </View>

        <Button title="+ Novo post do Mozart" onPress={() => setEditing('new')} fullWidth />

        {listQuery.isLoading ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <ActivityIndicator color={theme.textDim} />
          </View>
        ) : null}

        {posts.map((p) => {
          const meta = STATUS_META[p.status];
          const when =
            p.status === 'scheduled' && p.scheduled_at
              ? `sai ${format(parseISO(p.scheduled_at), "d/MM 'às' HH:mm", { locale: ptBR })}`
              : p.status === 'published' && p.published_at
                ? `publicado ${format(parseISO(p.published_at), "d/MM 'às' HH:mm", { locale: ptBR })}`
                : 'rascunho';
          return (
            <Pressable
              key={p.id}
              onPress={() => setEditing(p)}
              style={{
                backgroundColor: theme.surface,
                borderRadius: 14,
                padding: 12,
                borderWidth: 1,
                borderColor: theme.borderLight,
                flexDirection: 'row',
                gap: 12,
              }}
            >
              {p.media_url ? (
                <Image
                  source={{ uri: p.media_url }}
                  style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: theme.bg }}
                  contentFit="cover"
                />
              ) : null}
              <View style={{ flex: 1, gap: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: meta.bg, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 5 }}>
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color: meta.color, letterSpacing: 0.4 }}>
                      {meta.label}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>{when}</Text>
                </View>
                <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: theme.text, lineHeight: 18 }} numberOfLines={3}>
                  {p.caption}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {!listQuery.isLoading && posts.length === 0 ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, textAlign: 'center', padding: 20 }}>
            Nenhum post do Mozart ainda. Crie o primeiro acima 👆
          </Text>
        ) : null}
      </ScrollView>

      <MozartPostModal target={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function MozartPostModal({ target, onClose }: { target: MozartPost | 'new' | null; onClose: () => void }) {
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  const existing = target && target !== 'new' ? target : null;
  const isPublished = existing?.status === 'published';

  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<'draft' | 'now' | 'schedule'>('now');
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');

  useEffect(() => {
    if (!target) return;
    const base = new Date(Date.now() + 60 * 60 * 1000);
    setSchedDate(`${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`);
    setSchedTime(`${pad2(base.getHours())}:${pad2(base.getMinutes())}`);
    if (existing) {
      setCaption(existing.caption);
      setMediaUrl(existing.media_url);
      setMode(existing.status === 'scheduled' ? 'schedule' : 'draft');
      if (existing.scheduled_at) {
        const d = new Date(existing.scheduled_at);
        setSchedDate(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
        setSchedTime(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
      }
    } else {
      setCaption('');
      setMediaUrl(null);
      setMode('now');
    }
  }, [target, existing]);

  async function pickImage() {
    if (!userId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const ext = guessExtension(asset.uri, 'jpg');
      const url = await uploadToBucket('posts', userId, asset.uri, ext);
      setMediaUrl(url);
    } catch (e) {
      toast.error('Erro no upload', e instanceof Error ? e.message : 'Tenta outra imagem');
    } finally {
      setUploading(false);
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const clean = caption.trim();
      if (!clean) throw new Error('Escreva a legenda do post');
      let status: MozartPost['status'] = 'draft';
      let scheduled_at: string | null = null;
      if (mode === 'now') {
        status = 'scheduled';
        scheduled_at = new Date().toISOString();
      } else if (mode === 'schedule') {
        const dt = new Date(`${schedDate}T${schedTime}`);
        if (Number.isNaN(dt.getTime())) throw new Error('Data/hora inválida');
        if (dt.getTime() <= Date.now()) throw new Error('Escolha um horário no futuro');
        status = 'scheduled';
        scheduled_at = dt.toISOString();
      }
      if (existing) {
        await updateMozartPost(existing.id, { caption: clean, media_url: mediaUrl, status, scheduled_at });
      } else {
        await createMozartPost({ caption: clean, media_url: mediaUrl, status, scheduled_at });
      }
      if (mode === 'now') {
        try {
          await runMozartPublishNow();
        } catch {
          // O post JÁ foi gravado como scheduled+agora; só a publicação imediata
          // falhou. Não engole: avisa que sai no próximo ciclo do dispatch.
          throw new Error('Post salvo, mas a publicação imediata falhou — ele sai no próximo ciclo (até 5 min).');
        }
      }
    },
    onSuccess: () => {
      toast.success(
        mode === 'now' ? 'Mozart postou no feed! 🐾' : mode === 'schedule' ? 'Post agendado' : 'Rascunho salvo',
      );
      qc.invalidateQueries({ queryKey: qkMozartPosts });
      onClose();
    },
    onError: (e) => toast.error('Erro ao salvar', e instanceof Error ? e.message : 'Tenta de novo'),
  });

  const delMut = useMutation({
    mutationFn: () => deleteMozartPost(existing!.id),
    onSuccess: () => {
      toast.success('Removido da lista', 'Posts já publicados continuam no feed');
      qc.invalidateQueries({ queryKey: qkMozartPosts });
      onClose();
    },
    onError: () => toast.error('Erro ao remover'),
  });

  const busy = saveMut.isPending || delMut.isPending || uploading;

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <ScrollView
          style={{ maxHeight: '92%' }}
          contentContainerStyle={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            padding: 20,
            paddingBottom: 34,
            gap: 14,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: theme.text }}>
              {existing ? 'Post do Mozart' : 'Novo post do Mozart'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textDim} />
            </Pressable>
          </View>

          {isPublished ? (
            <View style={{ backgroundColor: '#DCFCE7', borderRadius: 10, padding: 10 }}>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#166534' }}>
                Este post já está no feed. Dá pra removê-lo da lista, mas ele continua publicado.
              </Text>
            </View>
          ) : null}

          <TextInput
            value={caption}
            onChangeText={setCaption}
            multiline
            editable={!busy && !isPublished}
            placeholder="O que o Mozart vai dizer hoje? 🐾"
            placeholderTextColor={theme.textDim}
            style={{
              minHeight: 100,
              maxHeight: 180,
              borderWidth: 1,
              borderColor: theme.borderLight,
              borderRadius: 12,
              padding: 12,
              fontFamily: FONTS.body,
              fontSize: 14,
              color: theme.text,
              backgroundColor: theme.bg,
              textAlignVertical: 'top',
            }}
          />

          {/* Imagem */}
          {mediaUrl ? (
            <View>
              <Image
                source={{ uri: mediaUrl }}
                style={{ width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: theme.bg }}
                contentFit="cover"
              />
              {!isPublished ? (
                <Pressable
                  onPress={() => setMediaUrl(null)}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    borderRadius: 16,
                    padding: 5,
                  }}
                >
                  <Ionicons name="trash" size={16} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          ) : !isPublished ? (
            <Pressable
              onPress={pickImage}
              disabled={busy}
              style={{
                borderWidth: 1,
                borderColor: theme.borderLight,
                borderStyle: 'dashed',
                borderRadius: 12,
                paddingVertical: 18,
                alignItems: 'center',
                gap: 6,
                backgroundColor: theme.bg,
              }}
            >
              {uploading ? (
                <ActivityIndicator color={theme.brand} />
              ) : (
                <>
                  <Ionicons name="image-outline" size={22} color={theme.brand} />
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: theme.brand }}>
                    Adicionar imagem (opcional)
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}

          {!isPublished ? (
            <>
              {/* Quando */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>Quando</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: theme.bg,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                    padding: 4,
                    gap: 4,
                  }}
                >
                  <Seg label="Rascunho" on={mode === 'draft'} onPress={() => setMode('draft')} theme={theme} />
                  <Seg label="Publicar agora" on={mode === 'now'} onPress={() => setMode('now')} theme={theme} />
                  <Seg label="Agendar" on={mode === 'schedule'} onPress={() => setMode('schedule')} theme={theme} />
                </View>
              </View>

              {mode === 'schedule' ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    value={schedDate}
                    onChangeText={setSchedDate}
                    placeholder="AAAA-MM-DD"
                    placeholderTextColor={theme.textDim}
                    autoCapitalize="none"
                    style={inputStyle(theme, 1.4)}
                  />
                  <TextInput
                    value={schedTime}
                    onChangeText={setSchedTime}
                    placeholder="HH:MM"
                    placeholderTextColor={theme.textDim}
                    autoCapitalize="none"
                    style={inputStyle(theme, 1)}
                  />
                </View>
              ) : null}

              <Button
                title={mode === 'now' ? 'Publicar agora 🐾' : mode === 'schedule' ? 'Agendar post' : 'Salvar rascunho'}
                onPress={() => saveMut.mutate()}
                loading={saveMut.isPending}
                disabled={busy}
                fullWidth
              />
            </>
          ) : null}

          {existing ? (
            <Button
              title="Remover da lista"
              variant="danger"
              onPress={() => delMut.mutate()}
              loading={delMut.isPending}
              disabled={busy}
              fullWidth
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Seg({
  label,
  on,
  onPress,
  theme,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center', backgroundColor: on ? theme.brand : 'transparent' }}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: on ? '#fff' : theme.textDim }}>{label}</Text>
    </Pressable>
  );
}

function inputStyle(theme: ReturnType<typeof useTheme>['theme'], flex: number) {
  return {
    flex,
    borderWidth: 1,
    borderColor: theme.borderLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: theme.text,
    backgroundColor: theme.bg,
  } as const;
}
