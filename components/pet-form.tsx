import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { SPECIES_OPTIONS } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { guessExtension, uploadToBucket } from '@/lib/storage';
import type { Species } from '@/lib/types';
import { petSchema, type PetInput } from '@/lib/validators';

import { Button } from './ui/button';
import { Input } from './ui/input';
import { TextArea } from './ui/text-area';

interface Props {
  userId: string;
  initial?: Partial<PetInput>;
  submitLabel: string;
  onSubmit: (data: PetInput) => Promise<void>;
}

export function PetForm({ userId, initial, submitLabel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [species, setSpecies] = useState<Species>(initial?.species ?? 'dog');
  const [breed, setBreed] = useState(initial?.breed ?? '');
  const [birthdate, setBirthdate] = useState(initial?.birthdate ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url ?? '');
  // Carteirinha
  const [microchipNumber, setMicrochipNumber] = useState(initial?.microchip_number ?? '');
  const [rgaNumber, setRgaNumber] = useState(initial?.rga_number ?? '');
  const [bloodType, setBloodType] = useState(initial?.blood_type ?? '');
  const [allergies, setAllergies] = useState(initial?.allergies ?? '');
  const [knownConditions, setKnownConditions] = useState(initial?.known_conditions ?? '');
  const [emergencyContactName, setEmergencyContactName] = useState(
    initial?.emergency_contact_name ?? '',
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    initial?.emergency_contact_phone ?? '',
  );
  const [preferredVetName, setPreferredVetName] = useState(initial?.preferred_vet_name ?? '');
  const [preferredVetPhone, setPreferredVetPhone] = useState(initial?.preferred_vet_phone ?? '');
  const [sinpatinhasId, setSinpatinhasId] = useState(initial?.sinpatinhas_id ?? '');
  const [carteirinhaExpanded, setCarteirinhaExpanded] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', 'Libere o acesso à galeria pra escolher uma foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const ext = guessExtension(asset.uri, 'jpg');
      const url = await uploadToBucket('avatars', userId, asset.uri, ext);
      setAvatarUrl(url);
    } catch (e) {
      Alert.alert('Erro no upload', e instanceof Error ? e.message : 'Tente outra foto.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async () => {
    const parsed = petSchema.safeParse({
      name,
      species,
      breed,
      birthdate,
      bio,
      avatar_url: avatarUrl,
      microchip_number: microchipNumber,
      rga_number: rgaNumber,
      blood_type: bloodType,
      allergies,
      known_conditions: knownConditions,
      emergency_contact_name: emergencyContactName,
      emergency_contact_phone: emergencyContactPhone,
      preferred_vet_name: preferredVetName,
      preferred_vet_phone: preferredVetPhone,
      sinpatinhas_id: sinpatinhasId,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) fe[issue.path[0] as string] = issue.message;
      setErrors(fe);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
    } catch (e) {
      Alert.alert('Erro ao salvar', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerClassName="px-4 pb-12" keyboardShouldPersistTaps="handled">
      <View className="mb-6 items-center">
        <Pressable
          onPress={pickAvatar}
          className="h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-brand-light"
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 112, height: 112 }} contentFit="cover" />
          ) : (
            <Ionicons name="camera" size={36} color="#C2410C" />
          )}
        </Pressable>
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#737373', marginTop: 8 }}>
          {uploadingAvatar ? 'Enviando...' : 'Toque pra adicionar uma foto'}
        </Text>
      </View>

      <View className="gap-3">
        <Input label="Nome" placeholder="Ex: Bidu" value={name} onChangeText={setName} error={errors.name} />

        <View>
          <Text
            style={{
              fontFamily: FONTS.bodySemibold,
              fontSize: 13,
              color: '#404040',
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
                  onPress={() => setSpecies(opt.value)}
                  className={`flex-row items-center gap-1.5 rounded-full px-3 py-2 ${
                    active ? 'bg-brand' : 'bg-neutral-100'
                  }`}
                >
                  <Text>{opt.emoji}</Text>
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 13,
                      color: active ? '#fff' : '#404040',
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Input label="Raça (opcional)" placeholder="Ex: Vira-lata caramelo" value={breed} onChangeText={setBreed} error={errors.breed} />
        <Input
          label="Data de nascimento (opcional)"
          placeholder="AAAA-MM-DD"
          value={birthdate}
          onChangeText={setBirthdate}
          error={errors.birthdate}
          hint="Formato: 2022-08-15"
        />
        <TextArea
          label="Bio (opcional)"
          placeholder="Conta um pouco sobre o pet"
          value={bio}
          onChangeText={setBio}
          error={errors.bio}
          rows={3}
        />

        {/* ============================================================
            CARTEIRINHA — seção colapsável com campos opcionais
            ============================================================ */}
        <Pressable
          onPress={() => setCarteirinhaExpanded((v) => !v)}
          style={{
            marginTop: 8,
            backgroundColor: '#FFEDD5',
            borderRadius: 14,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: 1,
            borderColor: '#FED7AA',
          }}
        >
          <Text style={{ fontSize: 22 }}>🪪</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#9A3412' }}>
              Carteirinha digital
            </Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 11,
                color: '#9A3412',
                opacity: 0.85,
                marginTop: 1,
              }}
            >
              Microchip, RGA, contato emergência, vet... tudo opcional
            </Text>
          </View>
          <Ionicons
            name={carteirinhaExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#9A3412"
          />
        </Pressable>

        {carteirinhaExpanded ? (
          <View style={{ gap: 12 }}>
            {/* Aviso de visibilidade pública (LGPD) — esses dados vão pra carteirinha
                pública via QR, incluindo telefone de terceiros (contato de
                emergência, vet). O tutor precisa saber + ter permissão da pessoa. */}
            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                backgroundColor: '#FEF3C7',
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: '#FCD34D',
              }}
            >
              <Text style={{ fontSize: 16 }}>👁️</Text>
              <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 12, color: '#78350F', lineHeight: 17 }}>
                Esses dados aparecem na <Text style={{ fontFamily: FONTS.bodyBold }}>carteirinha pública</Text> do
                seu pet (qualquer pessoa com o link/QR vê). Cadastre o telefone do contato de emergência ou do
                vet só com a permissão dessa pessoa.
              </Text>
            </View>
            <Input
              label="Número do microchip (opcional)"
              placeholder="Ex: 982000123456789"
              value={microchipNumber}
              onChangeText={setMicrochipNumber}
              error={errors.microchip_number}
              hint="15 dígitos do padrão internacional ISO 11784"
            />
            <Input
              label="RGA: Registro Animal (opcional)"
              placeholder="Ex: 123456"
              value={rgaNumber}
              onChangeText={setRgaNumber}
              error={errors.rga_number}
              hint="Número do registro municipal, se tiver"
            />

            {/* SinPatinhas — RG federal */}
            <View
              style={{
                backgroundColor: '#ECFDF5',
                borderRadius: 12,
                padding: 12,
                gap: 8,
                borderWidth: 1,
                borderColor: '#A7F3D0',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 18 }}>🇧🇷</Text>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#065F46', flex: 1 }}>
                  SinPatinhas, o RG federal do seu pet
                </Text>
              </View>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#047857', lineHeight: 17 }}>
                Registro oficial do governo federal (Ministério do Meio Ambiente), gratuito e
                voluntário. Se você já registrou, cole o número aqui e ele aparece na carteirinha do
                seu pet.
              </Text>
              <Input
                label="Número SinPatinhas (opcional)"
                placeholder="Ex: BR-2025-000123456"
                value={sinpatinhasId}
                onChangeText={setSinpatinhasId}
                error={errors.sinpatinhas_id}
                autoCapitalize="characters"
              />
              <Pressable
                onPress={() => {
                  const url = 'https://sinpatinhas.mma.gov.br/';
                  if (typeof window !== 'undefined' && window.open) {
                    window.open(url, '_blank');
                  } else {
                    Linking.openURL(url).catch(() => {});
                  }
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  alignSelf: 'flex-start',
                }}
              >
                <Ionicons name="open-outline" size={14} color="#065F46" />
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 12,
                    color: '#065F46',
                    textDecorationLine: 'underline',
                  }}
                >
                  Ainda não tem? Registrar no site oficial
                </Text>
              </Pressable>
            </View>

            <Input
              label="Tipo sanguíneo (opcional)"
              placeholder="Ex: DEA 1.1+"
              value={bloodType}
              onChangeText={setBloodType}
              error={errors.blood_type}
              hint="Pergunte ao seu vet se não souber"
            />
            <TextArea
              label="Alergias declaradas (opcional)"
              placeholder="Ex: Frango, alguns shampoos"
              value={allergies}
              onChangeText={setAllergies}
              error={errors.allergies}
              rows={2}
            />
            <TextArea
              label="Condições registradas (opcional)"
              placeholder="Ex: Cardiopatia, epilepsia controlada"
              value={knownConditions}
              onChangeText={setKnownConditions}
              error={errors.known_conditions}
              rows={2}
            />

            <View
              style={{
                height: 1,
                backgroundColor: '#E5E5E5',
                marginVertical: 4,
              }}
            />

            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                letterSpacing: 1.2,
                color: '#991B1B',
                textTransform: 'uppercase',
              }}
            >
              Contato de emergência
            </Text>
            <Input
              label="Nome"
              placeholder="Ex: João (marido)"
              value={emergencyContactName}
              onChangeText={setEmergencyContactName}
              error={errors.emergency_contact_name}
            />
            <Input
              label="Telefone"
              placeholder="Ex: +55 11 99999-9999"
              value={emergencyContactPhone}
              onChangeText={setEmergencyContactPhone}
              error={errors.emergency_contact_phone}
              keyboardType="phone-pad"
            />

            <View
              style={{
                height: 1,
                backgroundColor: '#E5E5E5',
                marginVertical: 4,
              }}
            />

            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                letterSpacing: 1.2,
                color: '#166534',
                textTransform: 'uppercase',
              }}
            >
              Veterinário(a) de confiança
            </Text>
            <Input
              label="Nome / Clínica"
              placeholder="Ex: Dra. Carla, Clínica Pata Amiga"
              value={preferredVetName}
              onChangeText={setPreferredVetName}
              error={errors.preferred_vet_name}
            />
            <Input
              label="Telefone"
              placeholder="Ex: +55 11 3333-3333"
              value={preferredVetPhone}
              onChangeText={setPreferredVetPhone}
              error={errors.preferred_vet_phone}
              keyboardType="phone-pad"
            />
          </View>
        ) : null}

        <View className="mt-2">
          <Button title={submitLabel} onPress={handleSubmit} loading={submitting} fullWidth />
        </View>
      </View>
    </ScrollView>
  );
}
