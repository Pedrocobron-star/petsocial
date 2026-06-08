import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

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
import type { LostReportKind, Species } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

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
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Hook tem que ser chamado SEMPRE — não pode vir depois de early return
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Não autenticado');
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
        photo_url: photoUrl || null,
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

  const pickPhoto = async () => {
    if (!userId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Libere o acesso à galeria.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const ext = guessExtension(asset.uri, 'jpg');
      const url = await uploadToBucket('avatars', userId, asset.uri, ext);
      setPhotoUrl(url);
    } catch (e) {
      Alert.alert('Erro no upload', e instanceof Error ? e.message : 'Tente outra foto.');
    } finally {
      setUploading(false);
    }
  };

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
              Foto (recomendado)
            </Text>
            <Pressable
              onPress={pickPhoto}
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
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <>
                  <Ionicons name="camera" size={28} color={theme.textDim} />
                  <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: theme.textDim, marginTop: 4 }}>
                    {uploading ? 'Enviando...' : 'Toque pra adicionar foto'}
                  </Text>
                </>
              )}
            </Pressable>
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

          <View className="mt-2">
            <Button title="Publicar reporte" onPress={handleSubmit} loading={submitting} fullWidth />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
