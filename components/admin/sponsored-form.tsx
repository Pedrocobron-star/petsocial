import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { SponsoredPostCard } from '@/components/sponsored-post-card';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { guessExtension, uploadToBucket } from '@/lib/storage';
import { type SponsoredPost, type SponsoredPostInput } from '@/lib/sponsored';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

/**
 * Formulário compartilhado de Sponsored Post (criar OU editar).
 *
 * Mostra preview ao vivo do card como vai aparecer no feed.
 * Suporta upload de avatar do anunciante + imagem do post (bucket `sponsored`).
 */
export function SponsoredForm({
  initial,
  submitLabel,
  onSubmit,
  submitting,
}: {
  initial?: Partial<SponsoredPost>;
  submitLabel: string;
  onSubmit: (input: SponsoredPostInput) => Promise<void>;
  submitting?: boolean;
}) {
  const { theme } = useTheme();
  const { session } = useSession();
  const toast = useToast();
  const userId = session?.user.id;

  const [sponsorName, setSponsorName] = useState(initial?.sponsor_name ?? '');
  const [sponsorHandle, setSponsorHandle] = useState(initial?.sponsor_handle ?? '');
  const [sponsorAvatarUrl, setSponsorAvatarUrl] = useState(initial?.sponsor_avatar_url ?? '');
  const [sponsorVerified, setSponsorVerified] = useState(initial?.sponsor_verified ?? false);
  const [content, setContent] = useState(initial?.content ?? '');
  const [mediaUrl, setMediaUrl] = useState(initial?.media_url ?? '');
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? 'Saiba mais');
  const [ctaUrl, setCtaUrl] = useState(initial?.cta_url ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [priority, setPriority] = useState(String(initial?.priority ?? 0));
  const [startsAt, setStartsAt] = useState(
    initial?.starts_at ? toLocalInput(initial.starts_at) : toLocalInput(new Date().toISOString()),
  );
  const [endsAt, setEndsAt] = useState(initial?.ends_at ? toLocalInput(initial.ends_at) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const pickAndUpload = async (kind: 'avatar' | 'media') => {
    if (!userId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
      aspect: kind === 'avatar' ? [1, 1] : [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    try {
      if (kind === 'avatar') setUploadingAvatar(true);
      else setUploadingMedia(true);
      const ext = guessExtension(uri, 'jpg');
      const url = await uploadToBucket('sponsored', userId, uri, ext);
      if (kind === 'avatar') setSponsorAvatarUrl(url);
      else setMediaUrl(url);
      toast.success(kind === 'avatar' ? 'Avatar carregado' : 'Imagem carregada');
    } catch (e) {
      toast.error('Erro no upload', e instanceof Error ? e.message : 'Tente de novo');
    } finally {
      setUploadingAvatar(false);
      setUploadingMedia(false);
    }
  };

  const handleSubmit = async () => {
    if (!sponsorName.trim()) {
      toast.error('Nome do anunciante obrigatório');
      return;
    }
    if (!mediaUrl) {
      toast.error('Imagem do post obrigatória');
      return;
    }
    if (!ctaUrl.trim() || !/^https?:\/\//i.test(ctaUrl)) {
      toast.error('URL do botão precisa começar com http(s)://');
      return;
    }
    try {
      await onSubmit({
        sponsor_name: sponsorName.trim(),
        sponsor_handle: sponsorHandle.trim() || null,
        sponsor_avatar_url: sponsorAvatarUrl || null,
        sponsor_verified: sponsorVerified,
        content: content.trim() || null,
        media_url: mediaUrl,
        media_kind: 'image',
        cta_label: ctaLabel.trim() || 'Saiba mais',
        cta_url: ctaUrl.trim(),
        active,
        priority: Number(priority) || 0,
        starts_at: fromLocalInput(startsAt),
        ends_at: endsAt ? fromLocalInput(endsAt) : null,
        notes: notes.trim() || null,
      });
    } catch (e) {
      toast.error('Erro ao salvar', e instanceof Error ? e.message : 'Tente novamente');
    }
  };

  // Preview live do card
  const previewPost: SponsoredPost = {
    id: 'preview',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    active,
    starts_at: fromLocalInput(startsAt),
    ends_at: endsAt ? fromLocalInput(endsAt) : null,
    sponsor_name: sponsorName || 'Marca exemplo',
    sponsor_handle: sponsorHandle || null,
    sponsor_avatar_url: sponsorAvatarUrl || null,
    sponsor_verified: sponsorVerified,
    content: content || null,
    media_url: mediaUrl || 'https://placehold.co/600x600/F97316/FFFFFF/png?text=Imagem',
    media_kind: 'image',
    cta_label: ctaLabel || 'Saiba mais',
    cta_url: ctaUrl || 'https://example.com',
    priority: Number(priority) || 0,
    impressions_count: 0,
    clicks_count: 0,
    target_audience: {},
    notes: null,
    created_by: userId ?? null,
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Preview */}
      <SectionTitle title="Preview" />
      <View style={{ marginHorizontal: -16, alignItems: 'center' }}>
        <SponsoredPostCard post={previewPost} />
      </View>

      {/* Anunciante */}
      <SectionTitle title="Anunciante" />
      <Field
        label="Nome do anunciante *"
        value={sponsorName}
        onChange={setSponsorName}
        placeholder="Marca, loja, perfil"
      />
      <Field
        label="@handle (opcional)"
        value={sponsorHandle ?? ''}
        onChange={setSponsorHandle}
        placeholder="@petshop, @vetclinic"
        autoCapitalize="none"
      />
      <UploadButton
        label="Avatar do anunciante"
        url={sponsorAvatarUrl}
        loading={uploadingAvatar}
        onPick={() => pickAndUpload('avatar')}
        onClear={() => setSponsorAvatarUrl('')}
      />
      <Toggle
        label="Selo de verificado (✓ azul)"
        value={sponsorVerified}
        onChange={setSponsorVerified}
      />

      {/* Conteúdo do post */}
      <SectionTitle title="Post" />
      <UploadButton
        label="Imagem principal *"
        url={mediaUrl}
        loading={uploadingMedia}
        onPick={() => pickAndUpload('media')}
        onClear={() => setMediaUrl('')}
      />
      <Field
        label="Caption (opcional)"
        value={content ?? ''}
        onChange={setContent}
        placeholder="Texto que aparece acima do botão"
        multiline
      />

      {/* CTA */}
      <SectionTitle title="Botão de ação (CTA)" />
      <Field
        label="Texto do botão *"
        value={ctaLabel}
        onChange={setCtaLabel}
        placeholder="Saiba mais, Compre agora, Visite"
      />
      <Field
        label="URL de destino *"
        value={ctaUrl}
        onChange={setCtaUrl}
        placeholder="https://site-da-marca.com/promo"
        autoCapitalize="none"
        keyboardType="url"
      />

      {/* Orquestração */}
      <SectionTitle title="Quando exibir" />
      <Toggle label="Ativo (aparece no feed)" value={active} onChange={setActive} />
      <Field
        label="Início (YYYY-MM-DD HH:mm)"
        value={startsAt}
        onChange={setStartsAt}
        placeholder="2026-01-01 09:00"
      />
      <Field
        label="Fim (deixa vazio = sem expiração)"
        value={endsAt}
        onChange={setEndsAt}
        placeholder="2026-12-31 23:59"
      />
      <Field
        label="Prioridade (maior = aparece primeiro)"
        value={priority}
        onChange={setPriority}
        keyboardType="number-pad"
      />

      {/* Notas internas */}
      <SectionTitle title="Notas internas (só admin vê)" />
      <Field
        label="Notas"
        value={notes ?? ''}
        onChange={setNotes}
        placeholder="Valor pago, contato do anunciante, etc"
        multiline
      />

      <Button title={submitLabel} onPress={handleSubmit} loading={submitting} fullWidth />
    </ScrollView>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function SectionTitle({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        fontFamily: FONTS.bodyBold,
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: theme.brand,
        marginTop: 8,
      }}
    >
      {title}
    </Text>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  autoCapitalize = 'sentences',
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'url';
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textDim}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.borderLight,
          borderRadius: 10,
          padding: 12,
          fontFamily: FONTS.body,
          fontSize: 14,
          color: theme.text,
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? 'top' : 'auto',
        }}
      />
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.borderLight,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 10,
      }}
    >
      <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: theme.text }}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: '#F97316', false: '#D4D4D8' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function UploadButton({
  label,
  url,
  loading,
  onPick,
  onClear,
}: {
  label: string;
  url: string | null;
  loading: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>{label}</Text>
      {url ? (
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 10,
            padding: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: theme.borderLight,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              backgroundColor: '#F5F3F0',
              overflow: 'hidden',
            }}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(globalThis as any).document ? (
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : null}
          </View>
          <Text
            style={{ flex: 1, fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}
            numberOfLines={2}
          >
            {url}
          </Text>
          <Pressable onPress={onClear} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color="#9F1239" />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={onPick}
          disabled={loading}
          style={{
            backgroundColor: theme.surface,
            borderWidth: 2,
            borderColor: theme.borderLight,
            borderStyle: 'dashed',
            borderRadius: 10,
            padding: 18,
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Ionicons name={loading ? 'cloud-upload' : 'image'} size={22} color={theme.brand} />
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.brand }}>
            {loading ? 'Enviando...' : 'Escolher arquivo'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ----------------------------------------------------------------------------
// Helpers de data — converte ISO ↔ "YYYY-MM-DD HH:mm" pro input
// ----------------------------------------------------------------------------

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  // Aceita "YYYY-MM-DD HH:mm" ou "YYYY-MM-DDTHH:mm"
  const cleaned = local.replace(' ', 'T');
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}
