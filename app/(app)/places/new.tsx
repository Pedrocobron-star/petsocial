import { useMutation } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { createPlace } from '@/lib/queries';
import type { PlaceKind } from '@/lib/types';
import { AppThemeProvider } from '@/providers/app-theme-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const KINDS: { value: PlaceKind; label: string; emoji: string }[] = [
  { value: 'vet', label: 'Veterinário', emoji: '🩺' },
  { value: 'pet_shop', label: 'Pet Shop', emoji: '🛍️' },
  { value: 'grooming', label: 'Banho & Tosa', emoji: '🛁' },
  { value: 'hotel', label: 'Hotel', emoji: '🏨' },
  { value: 'daycare', label: 'Creche', emoji: '🐕' },
  { value: 'park', label: 'Parque', emoji: '🌳' },
  { value: 'restaurant', label: 'Restaurante', emoji: '🍽️' },
  { value: 'cafe', label: 'Café', emoji: '☕' },
  { value: 'event', label: 'Evento', emoji: '🎉' },
  { value: 'beach', label: 'Praia', emoji: '🏖️' },
  { value: 'training', label: 'Adestrador', emoji: '🎓' },
  { value: 'other', label: 'Outro', emoji: '📍' },
];

export default function NewPlaceScreen() {
  return (
    <AppThemeProvider app="places">
      <NewPlaceInner />
    </AppThemeProvider>
  );
}

function NewPlaceInner() {
  const { theme } = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const toast = useToast();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<PlaceKind>('pet_shop');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');

  const createMut = useMutation({
    mutationFn: () =>
      createPlace({
        added_by_user_id: session!.user.id,
        name: name.trim(),
        kind,
        address: address.trim(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
        hours: hours.trim() || undefined,
        description: description.trim() || undefined,
      }),
    onSuccess: (place) => {
      toast.success('Lugar adicionado!');
      router.replace({ pathname: '/places/[id]' as never, params: { id: place.id } as never });
    },
    onError: () => toast.error('Não foi possível salvar'),
  });

  const valid = name.trim().length > 1 && address.trim().length > 3;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: 'Novo lugar' }} />
      <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim }}>
        Compartilhe um vet, pet shop ou parque legal para ajudar outros tutores 🐾
      </Text>

      <Field label="Nome *" value={name} onChange={setName} placeholder="ex: VetSP Clínica Veterinária" />

      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.textDim }}>Tipo</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {KINDS.map((k) => {
          const active = kind === k.value;
          return (
            <Pressable
              key={k.value}
              onPress={() => setKind(k.value)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active ? theme.accent.color : theme.borderLight,
              }}
            >
              <Text style={{ fontSize: 14 }}>{k.emoji}</Text>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                  color: active ? theme.accent.onAccent : theme.text,
                }}
              >
                {k.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Field
        label="Endereço *"
        value={address}
        onChange={setAddress}
        placeholder="Rua, número, bairro"
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 2 }}>
          <Field label="Cidade" value={city} onChange={setCity} placeholder="São Paulo" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="UF" value={state} onChange={setState} placeholder="SP" />
        </View>
      </View>
      <Field label="Telefone" value={phone} onChange={setPhone} placeholder="(11) 90000-0000" />
      <Field label="Website / Instagram" value={website} onChange={setWebsite} placeholder="exemplo.com" />
      <Field label="Horário" value={hours} onChange={setHours} placeholder="Seg-Sex 9h-18h" />
      <Field label="Descrição" value={description} onChange={setDescription} placeholder="O que esse lugar tem de especial?" multiline />

      <View style={{ marginTop: 8 }}>
        <Button
          title="Adicionar lugar"
          onPress={() => createMut.mutate()}
          disabled={!valid}
          loading={createMut.isPending}
          fullWidth
        />
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.textDim, marginBottom: 4 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textDim}
        multiline={multiline}
        style={{
          backgroundColor: theme.borderLight,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontFamily: FONTS.body,
          fontSize: 14,
          color: theme.text,
          minHeight: multiline ? 70 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}
