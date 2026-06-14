import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { ModerationNotice, RulesCheckbox } from '@/components/listing-legal';
import { Button } from '@/components/ui/button';
import { DateTimePickerInput } from '@/components/ui/datetime-picker';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { TextArea } from '@/components/ui/text-area';
import { SPECIES_OPTIONS } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { getCurrentPosition, type Coords } from '@/lib/geo';
import { createLostReport } from '@/lib/queries';
import { guessExtension, uploadToBucket } from '@/lib/storage';
import type { LostReportKind, MediaType, Species } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

// Mesmos limites do create.tsx — até 10 mídias, vídeos de até 60s e 100 MB.
const MAX_MEDIA = 10;
const MAX_VIDEO_MB = 100;

interface PickedMedia {
  uri: string;
  type: MediaType;
}

export default function NewLostReportScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useSession();
  const { pets } = useActivePet();
  const userId = session?.user.id;

  // Query params permitem deep-link de avistamento ("Viu esse pet?" do detail).
  // Pré-preenche o form pra reduzir fricção de quem reporta um pet que viu.
  const params = useLocalSearchParams<{
    kind?: string;
    species?: string;
    breed?: string;
    color?: string;
  }>();
  const initialKind: LostReportKind = params.kind === 'found' ? 'found' : 'lost';
  const initialSpecies: Species | '' =
    params.species && ['dog', 'cat', 'rabbit', 'bird', 'fish', 'rodent', 'reptile', 'other'].includes(params.species)
      ? (params.species as Species)
      : '';

  const [kind, setKind] = useState<LostReportKind>(initialKind);
  const [linkedPetId, setLinkedPetId] = useState<string | null>(null);
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState<Species | ''>(initialSpecies);
  const [breed, setBreed] = useState(params.breed ?? '');
  const [color, setColor] = useState(params.color ?? '');
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<Date | null>(new Date());
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [media, setMedia] = useState<PickedMedia[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Hook tem que ser chamado SEMPRE — não pode vir depois de early return
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Não autenticado');
      // Sobe todas as mídias pro bucket público `posts`, preservando a ordem.
      const uploaded = await Promise.all(
        media.map(async (m) => {
          const ext = guessExtension(m.uri, m.type === 'video' ? 'mp4' : 'jpg');
          const url = await uploadToBucket('posts', userId, m.uri, ext);
          return { url, type: m.type };
        }),
      );
      const imageUrls = uploaded.filter((u) => u.type === 'image').map((u) => u.url);
      const videoUrl = uploaded.find((u) => u.type === 'video')?.url ?? null;
      const id = await createLostReport({
        pet_id: linkedPetId,
        reporter_user_id: userId,
        kind,
        pet_name: petName.trim() || null,
        species: species || null,
        breed: breed.trim() || null,
        color: color.trim() || null,
        last_seen_location: location.trim(),
        last_seen_at: lastSeenAt ? lastSeenAt.toISOString() : null,
        description: description.trim() || null,
        contact_info: contact.trim(),
        // photo_url = primeira foto pra manter compat com cards/listagens antigos.
        photo_url: imageUrls[0] ?? null,
        image_urls: imageUrls,
        video_url: videoUrl,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      });
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['lost-reports'] });
      router.replace({ pathname: '/lost-found/[id]' as never, params: { id } as never });
    },
    onError: (e) => Alert.alert('Erro', e instanceof Error ? e.message : 'Tente novamente.'),
  });

  const hasVideo = media.some((m) => m.type === 'video');

  const pickMedia = async () => {
    if (!userId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Libere o acesso à galeria.');
      return;
    }
    const remaining = MAX_MEDIA - media.length;
    if (remaining <= 0) {
      Alert.alert('Limite atingido', `Máximo de ${MAX_MEDIA} mídias.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
      videoMaxDuration: 60,
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (result.canceled) return;
    const picked: PickedMedia[] = [];
    let tooBig = 0;
    let extraVideo = 0;
    let videoTaken = hasVideo;
    for (const a of result.assets) {
      if (media.length + picked.length >= MAX_MEDIA) break;
      const type: MediaType = a.type === 'video' ? 'video' : 'image';
      if (type === 'video') {
        // Só 1 vídeo no total — ignora os extras.
        if (videoTaken) {
          extraVideo++;
          continue;
        }
        let bytes = a.fileSize ?? 0;
        if (!bytes) {
          try {
            bytes = (await fetch(a.uri).then((r) => r.blob())).size;
          } catch {
            bytes = 0;
          }
        }
        if (bytes && bytes > MAX_VIDEO_MB * 1024 * 1024) {
          tooBig++;
          continue;
        }
        videoTaken = true;
      }
      picked.push({ uri: a.uri, type });
    }
    if (tooBig > 0) {
      Alert.alert(
        'Vídeo muito pesado',
        `Limite de ${MAX_VIDEO_MB} MB por vídeo. Use um clipe mais curto ou em menor resolução (evite 4K).`,
      );
    }
    if (extraVideo > 0) {
      Alert.alert('Só 1 vídeo', 'Você pode adicionar apenas um vídeo por reporte.');
    }
    if (picked.length === 0) return;
    setMedia((cur) => [...cur, ...picked].slice(0, MAX_MEDIA));
  };

  const removeAt = (i: number) => setMedia((cur) => cur.filter((_, idx) => idx !== i));

  // Early return DEPOIS dos hooks pra cumprir rules-of-hooks
  if (!userId) return null;

  const handleSubmit = () => {
    if (!location.trim()) {
      Alert.alert('Local obrigatório', 'Informe onde foi visto pela última vez.');
      return;
    }
    if (!contact.trim()) {
      Alert.alert('Contato obrigatório', 'Informe um telefone ou email pra contato.');
      return;
    }
    if (kind === 'lost' && !linkedPetId && !petName.trim()) {
      Alert.alert('Nome do pet', 'Vincule um pet ou informe o nome.');
      return;
    }
    if (kind === 'found' && !species) {
      Alert.alert('Espécie', 'Informe a espécie do pet encontrado.');
      return;
    }
    if (!accepted) {
      Alert.alert('Aceite as regras', 'Marque que leu e concorda com as Regras de Anúncios de Animais.');
      return;
    }
    setSubmitting(true);
    createMutation.mutate(undefined, { onSettled: () => setSubmitting(false) });
  };

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-4 pb-12" keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: theme.text, marginBottom: 16 }}>
          Reportar pet
        </Text>

        <View className="mb-4 flex-row gap-2">
          <Pressable
            onPress={() => setKind('lost')}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 14,
              backgroundColor: kind === 'lost' ? '#FEE2E2' : theme.surface,
              borderWidth: 1,
              borderColor: kind === 'lost' ? '#dc2626' : theme.border,
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 24 }}>😢</Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: kind === 'lost' ? '#991B1B' : theme.textMuted }}>
              Perdi meu pet
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setKind('found')}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 14,
              backgroundColor: kind === 'found' ? '#DCFCE7' : theme.surface,
              borderWidth: 1,
              borderColor: kind === 'found' ? '#16a34a' : theme.border,
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 24 }}>🤝</Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: kind === 'found' ? '#166534' : theme.textMuted }}>
              Achei um pet
            </Text>
          </Pressable>
        </View>

        <View className="gap-3">
          {kind === 'lost' && pets.length > 0 ? (
            <View>
              <Text
                style={{
                  fontFamily: FONTS.bodySemibold,
                  fontSize: 13,
                  color: theme.textMuted,
                  marginBottom: 6,
                }}
              >
                É um dos seus pets cadastrados?
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <Pressable
                  onPress={() => setLinkedPetId(null)}
                  className="rounded-full px-3 py-2"
                  style={{ backgroundColor: linkedPetId === null ? theme.brand : theme.borderLight }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 12,
                      color: linkedPetId === null ? '#fff' : theme.textMuted,
                    }}
                  >
                    Não / outro
                  </Text>
                </Pressable>
                {pets.map((p) => {
                  const active = linkedPetId === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        setLinkedPetId(p.id);
                        setPetName(p.name);
                        setSpecies(p.species);
                        setBreed(p.breed ?? '');
                      }}
                      className="rounded-full px-3 py-2"
                      style={{ backgroundColor: active ? theme.brand : theme.borderLight }}
                    >
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 12,
                          color: active ? '#fff' : theme.textMuted,
                        }}
                      >
                        {p.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View>
            <Text
              style={{
                fontFamily: FONTS.bodySemibold,
                fontSize: 13,
                color: theme.textMuted,
                marginBottom: 6,
              }}
            >
              Fotos e vídeo (recomendado) · {media.length}/{MAX_MEDIA}
            </Text>
            {media.length === 0 ? (
              <Pressable
                onPress={pickMedia}
                style={{
                  height: 120,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: theme.border,
                  borderStyle: 'dashed',
                  backgroundColor: theme.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <Ionicons name="camera" size={28} color={theme.textDim} />
                <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: theme.textDim, marginTop: 4 }}>
                  Toque pra adicionar fotos ou vídeo
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 2 }}>
                  Até {MAX_MEDIA} mídias · 1 vídeo de até 60s
                </Text>
              </Pressable>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                {media.map((m, i) => (
                  <View key={`${m.uri}-${i}`} style={{ position: 'relative' }}>
                    <View
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: 12,
                        overflow: 'hidden',
                        backgroundColor: theme.borderLight,
                      }}
                    >
                      {m.type === 'image' ? (
                        <Image source={{ uri: m.uri }} style={{ width: 96, height: 96 }} contentFit="cover" />
                      ) : (
                        <ReportVideoThumb uri={m.uri} />
                      )}
                    </View>
                    <Pressable
                      onPress={() => removeAt(i)}
                      hitSlop={8}
                      accessibilityLabel="Remover mídia"
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: '#1A1410',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {media.length < MAX_MEDIA ? (
                  <Pressable
                    onPress={pickMedia}
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: theme.border,
                      borderStyle: 'dashed',
                      backgroundColor: theme.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                    }}
                  >
                    <Ionicons name="add" size={26} color={theme.textDim} />
                    <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>Mais</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            )}
          </View>

          <Input
            label="Nome (se souber)"
            placeholder="Ex: Bidu"
            value={petName}
            onChangeText={setPetName}
          />

          <View>
            <Text
              style={{
                fontFamily: FONTS.bodySemibold,
                fontSize: 13,
                color: theme.textMuted,
                marginBottom: 6,
              }}
            >
              Espécie
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {SPECIES_OPTIONS.map((opt) => {
                const active = species === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setSpecies(active ? '' : opt.value)}
                    className="flex-row items-center gap-1.5 rounded-full px-3 py-2"
                    style={{ backgroundColor: active ? theme.brand : theme.borderLight }}
                  >
                    <Text>{opt.emoji}</Text>
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 12,
                        color: active ? '#fff' : theme.textMuted,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Input label="Raça (opcional)" placeholder="Vira-lata caramelo" value={breed} onChangeText={setBreed} />
          <Input label="Cor / sinais" placeholder="Caramelo com mancha branca no peito" value={color} onChangeText={setColor} />

          <Input
            label="Onde foi visto pela última vez"
            placeholder="Rua, bairro, cidade"
            value={location}
            onChangeText={setLocation}
          />
          <Pressable
            onPress={async () => {
              setLocating(true);
              const c = await getCurrentPosition();
              setLocating(false);
              if (c) setCoords(c);
              else
                Alert.alert(
                  'Localização',
                  'Não consegui pegar sua localização (permissão negada ou indisponível). Sem problema — o endereço acima já ajuda.',
                );
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 2 }}
            accessibilityRole="button"
          >
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 12.5,
                color: coords ? '#15803d' : '#F97316',
              }}
            >
              {locating
                ? '📍 Localizando…'
                : coords
                  ? '✓ Localização capturada — aparece pra quem busca por perto'
                  : '📍 Usar minha localização (busca por proximidade)'}
            </Text>
          </Pressable>
          <DateTimePickerInput
            label="Quando foi visto pela última vez"
            value={lastSeenAt}
            onChange={setLastSeenAt}
          />
          <TextArea
            label="Descrição (opcional)"
            placeholder="Detalhes que ajudem a identificar — comportamento, coleira, etc."
            value={description}
            onChangeText={setDescription}
            rows={3}
          />
          <Input
            label="Contato (telefone ou email)"
            placeholder="(11) 99999-9999"
            value={contact}
            onChangeText={setContact}
            keyboardType="default"
          />

          <ModerationNotice variant="instant" />
          <RulesCheckbox checked={accepted} onToggle={() => setAccepted((v) => !v)} />

          <View className="mt-2">
            <Button title="Publicar reporte" onPress={handleSubmit} loading={submitting} fullWidth />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

// Thumbnail de vídeo na grade de seleção (mudo, com selo de play).
function ReportVideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
  });
  return (
    <View style={{ width: 96, height: 96 }}>
      <VideoView
        player={player}
        style={{ width: 96, height: 96 }}
        contentFit="cover"
        nativeControls={false}
      />
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
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: 'rgba(0,0,0,0.45)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="play" size={15} color="#fff" />
        </View>
      </View>
    </View>
  );
}
