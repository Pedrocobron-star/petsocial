import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import {
  createAdoptionListing,
  SEX_LABEL,
  SIZE_LABEL,
  SPECIES_META,
  type AdoptionSex,
  type AdoptionSize,
  type AdoptionSpecies,
} from '@/lib/adoption';
import { FONTS } from '@/lib/fonts';
import { guessExtension, uploadToBucket } from '@/lib/storage';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

// Até 10 fotos + 1 vídeo (mesmos limites do create.tsx).
const MAX_PHOTOS = 10;
const MAX_VIDEO_MB = 100;

export default function NewAdoptionScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;

  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<AdoptionSpecies>('dog');
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState<AdoptionSex>('unknown');
  const [ageLabel, setAgeLabel] = useState('');
  const [size, setSize] = useState<AdoptionSize | ''>('');
  const [city, setCity] = useState('');
  const [uf, setUf] = useState('');
  const [description, setDescription] = useState('');
  const [vaccinated, setVaccinated] = useState(false);
  const [neutered, setNeutered] = useState(false);
  const [specialNeeds, setSpecialNeeds] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [saving, setSaving] = useState(false);

  if (!session) return <Redirect href="/welcome" />;
  if (!userId) return null;

  const pickImage = async () => {
    if (images.length >= MAX_PHOTOS) {
      toast.info('Limite de fotos', `Máximo ${MAX_PHOTOS} fotos.`);
      return;
    }
    const remaining = MAX_PHOTOS - images.length;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (res.canceled || res.assets.length === 0) return;
    setUploading(true);
    try {
      const slice = res.assets.slice(0, remaining);
      const urls = await Promise.all(
        slice.map((asset) => uploadToBucket('posts', userId, asset.uri, guessExtension(asset.uri))),
      );
      setImages((prev) => [...prev, ...urls].slice(0, MAX_PHOTOS));
    } catch (e) {
      toast.error('Erro ao subir foto', e instanceof Error ? e.message : '');
    } finally {
      setUploading(false);
    }
  };

  const pickVideo = async () => {
    if (videoUrl) {
      toast.info('Só 1 vídeo', 'Você pode adicionar apenas um vídeo por anúncio.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 60,
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    // Rejeita vídeo pesado (mesmo teto do create.tsx).
    let bytes = asset.fileSize ?? 0;
    if (!bytes) {
      try {
        bytes = (await fetch(asset.uri).then((r) => r.blob())).size;
      } catch {
        bytes = 0;
      }
    }
    if (bytes && bytes > MAX_VIDEO_MB * 1024 * 1024) {
      toast.info(
        'Vídeo muito pesado',
        `Limite de ${MAX_VIDEO_MB} MB. Use um clipe mais curto ou em menor resolução (evite 4K).`,
      );
      return;
    }
    setUploadingVideo(true);
    try {
      const url = await uploadToBucket('posts', userId, asset.uri, guessExtension(asset.uri, 'mp4'));
      setVideoUrl(url);
    } catch (e) {
      toast.error('Erro ao subir vídeo', e instanceof Error ? e.message : '');
    } finally {
      setUploadingVideo(false);
    }
  };

  const onSubmit = async () => {
    if (name.trim().length < 2) {
      toast.error('Dê um nome', 'Como o pet se chama?');
      return;
    }
    if (description.trim().length < 10) {
      toast.error('Conte mais', 'Descreva o pet, temperamento e por que está pra adoção.');
      return;
    }
    if (images.length === 0) {
      toast.error('Adicione uma foto', 'Anúncios sem foto não são publicados — uma foto aumenta muito a chance de adoção.');
      return;
    }
    setSaving(true);
    try {
      const listing = await createAdoptionListing(userId, {
        pet_name: name.trim(),
        species,
        breed: breed.trim() || null,
        sex,
        age_label: ageLabel.trim() || null,
        size: size || null,
        city: city.trim() || null,
        uf: uf.trim().toUpperCase() || null,
        description: description.trim(),
        vaccinated,
        neutered,
        special_needs: specialNeeds.trim() || null,
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        image_urls: images,
        video_url: videoUrl,
      });
      await qc.invalidateQueries({ queryKey: ['adoption-listings'] });
      toast.success('Anúncio publicado! 🏠', 'Obrigado por ajudar a achar um lar.');
      router.replace({ pathname: '/(app)/adoption/[id]', params: { id: listing.id } } as never);
    } catch (e) {
      toast.error('Erro ao publicar', e instanceof Error ? e.message : 'Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Anunciar pra adoção', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {/* Fotos e vídeo */}
        <Section title={`Fotos e vídeo · ${images.length}/${MAX_PHOTOS}`} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {images.map((u, i) => (
            <View key={i} style={{ position: 'relative' }}>
              <Image source={{ uri: u }} style={{ width: 84, height: 84, borderRadius: 12 }} contentFit="cover" />
              <Pressable
                onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  backgroundColor: '#1A1410',
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ))}
          {/* Vídeo (1 só) */}
          {videoUrl ? (
            <View style={{ position: 'relative' }}>
              <View style={{ width: 84, height: 84, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
                <AdoptionVideoThumb uri={videoUrl} />
              </View>
              <Pressable
                onPress={() => setVideoUrl(null)}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  backgroundColor: '#1A1410',
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ) : null}
          {images.length < MAX_PHOTOS ? (
            <Pressable
              onPress={pickImage}
              disabled={uploading}
              style={{
                width: 84,
                height: 84,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: theme.border,
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                opacity: uploading ? 0.5 : 1,
              }}
            >
              <Ionicons name={uploading ? 'cloud-upload' : 'camera'} size={22} color={theme.textDim} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>
                {uploading ? '...' : 'Foto'}
              </Text>
            </Pressable>
          ) : null}
          {!videoUrl ? (
            <Pressable
              onPress={pickVideo}
              disabled={uploadingVideo}
              style={{
                width: 84,
                height: 84,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: theme.border,
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                opacity: uploadingVideo ? 0.5 : 1,
              }}
            >
              <Ionicons name={uploadingVideo ? 'cloud-upload' : 'videocam'} size={22} color={theme.textDim} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>
                {uploadingVideo ? '...' : 'Vídeo'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Section title="Sobre o pet" />
        <Field label="Nome *" value={name} onChange={setName} placeholder="Ex: Pingo" />
        <ChipRow
          label="Espécie"
          options={(Object.keys(SPECIES_META) as AdoptionSpecies[]).map((s) => ({ value: s, label: `${SPECIES_META[s].emoji} ${SPECIES_META[s].label}` }))}
          value={species}
          onChange={(v) => setSpecies(v as AdoptionSpecies)}
        />
        <Field label="Raça (ou SRD)" value={breed} onChange={setBreed} placeholder="Ex: Vira-lata, Poodle" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <ChipRow
              label="Sexo"
              options={(Object.keys(SEX_LABEL) as AdoptionSex[]).map((s) => ({ value: s, label: SEX_LABEL[s] }))}
              value={sex}
              onChange={(v) => setSex(v as AdoptionSex)}
            />
          </View>
        </View>
        <Field label="Idade" value={ageLabel} onChange={setAgeLabel} placeholder="Ex: Filhote, 2 anos, Adulto" />
        <ChipRow
          label="Porte"
          options={(Object.keys(SIZE_LABEL) as AdoptionSize[]).map((s) => ({ value: s, label: SIZE_LABEL[s] }))}
          value={size}
          onChange={(v) => setSize(v as AdoptionSize)}
        />

        <Section title="Saúde" />
        <Toggle label="Vacinado" value={vaccinated} onChange={setVaccinated} />
        <Toggle label="Castrado" value={neutered} onChange={setNeutered} />
        <Field label="Cuidados especiais (opcional)" value={specialNeeds} onChange={setSpecialNeeds} placeholder="Ex: precisa de medicação contínua" multiline />

        <Section title="Onde está" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 3 }}>
            <Field label="Cidade" value={city} onChange={setCity} placeholder="Ex: São Paulo" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="UF" value={uf} onChange={setUf} placeholder="SP" autoCapitalize="characters" />
          </View>
        </View>

        <Section title="Descrição *" />
        <Field
          label="Conte sobre o pet, temperamento e por que está pra adoção"
          value={description}
          onChange={setDescription}
          placeholder="Ex: Pingo é dócil, brincalhão, se dá bem com crianças e outros cães..."
          multiline
        />

        <Section title="Contato" />
        <Field label="Seu nome" value={contactName} onChange={setContactName} placeholder="Quem cuida do pet" />
        <Field label="WhatsApp (com DDD)" value={contactPhone} onChange={setContactPhone} placeholder="11 99999-9999" keyboardType="phone-pad" />

        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            backgroundColor: '#FEF2F2',
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: '#FECACA',
          }}
        >
          <Text style={{ fontSize: 16 }}>💛</Text>
          <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 11, color: '#991B1B', lineHeight: 16 }}>
            Adoção é responsável. Combine uma visita, oriente sobre castração e vacinas. O Maestro Pet só conecta — a entrega é com você.
          </Text>
        </View>

        <Button title="Publicar anúncio" onPress={onSubmit} loading={saving} fullWidth />
      </ScrollView>
    </View>
  );
}

// ----------------------------------------------------------------------------

// Thumbnail do vídeo selecionado (mudo, com selo de play).
function AdoptionVideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
  });
  return (
    <View style={{ width: 84, height: 84 }}>
      <VideoView player={player} style={{ width: 84, height: 84 }} contentFit="cover" nativeControls={false} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: 'rgba(0,0,0,0.45)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="play" size={14} color="#fff" />
        </View>
      </View>
    </View>
  );
}

function Section({ title }: { title: string }) {
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
  keyboardType?: 'default' | 'phone-pad';
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

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((opt) => {
          const isActive = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: isActive ? '#F97316' : '#FFEDD5',
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: isActive ? '#FFFFFF' : '#9A3412' }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
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
      <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: theme.text }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: '#F97316', false: '#D4D4D8' }} thumbColor="#FFFFFF" />
    </View>
  );
}
