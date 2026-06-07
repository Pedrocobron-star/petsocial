import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { PetAvatar } from '@/components/pet-avatar';
import { PetPicker } from '@/components/pet-picker';
import { Button } from '@/components/ui/button';
import { DateTimePickerInput } from '@/components/ui/datetime-picker';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { TextArea } from '@/components/ui/text-area';
import { MEETUP_CATEGORIES } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { placeKindMeta } from '@/lib/places-meta';
import { fetchPlaces } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { MeetupCategory } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';

export default function NewMeetupScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { pets, activePet, setActivePet } = useActivePet();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [placeSearch, setPlaceSearch] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [category, setCategory] = useState<MeetupCategory>('social');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const placesQuery = useQuery({
    queryKey: ['places-pick', placeSearch],
    queryFn: () => fetchPlaces({ search: placeSearch.trim() }),
    enabled: placeSearch.trim().length >= 2,
  });

  if (!activePet) return null;

  const handleSubmit = async () => {
    const fe: Record<string, string> = {};
    if (title.trim().length < 3) fe.title = 'Título muito curto';
    if (locationName.trim().length < 2) fe.location_name = 'Informe o local';
    if (!startsAt) fe.starts_at = 'Escolha data e horário';
    else if (startsAt.getTime() < Date.now() - 1000 * 60 * 5) fe.starts_at = 'Escolha uma data futura';

    if (Object.keys(fe).length > 0) {
      setErrors(fe);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('meetups')
        .insert({
          host_pet_id: activePet.id,
          title: title.trim(),
          description: description.trim() || null,
          location_name: locationName.trim(),
          starts_at: startsAt!.toISOString(),
          category,
          ...(placeId ? { place_id: placeId } : {}),
        })
        .select('id')
        .single();
      if (error) throw error;
      const id = (data as { id: string }).id;

      const { error: rsvpError } = await supabase
        .from('meetup_rsvps')
        .insert({ meetup_id: id, pet_id: activePet.id, status: 'going' });
      if (rsvpError) throw rsvpError;

      await qc.invalidateQueries({ queryKey: ['meetups'] });
      router.replace({ pathname: '/meetup/[id]', params: { id } });
    } catch (e) {
      Alert.alert('Erro ao criar', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-4 pb-12" keyboardShouldPersistTaps="handled">
        {pets.length > 1 ? (
          <View className="mb-4">
            <Text style={{ fontFamily: FONTS.bodySemibold, fontSize: 13, color: '#404040', marginBottom: 6 }}>
              Host
            </Text>
            <View className="-mx-4">
              <PetPicker pets={pets} selectedId={activePet.id} onSelect={setActivePet} />
            </View>
          </View>
        ) : (
          <View className="mb-4 flex-row items-center gap-3 rounded-2xl bg-white p-3">
            <PetAvatar pet={activePet} size={40} />
            <View>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#737373' }}>Host</Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#1A1410' }}>
                {activePet.name}
              </Text>
            </View>
          </View>
        )}
        <View className="gap-3">
          <View>
            <Text
              style={{
                fontFamily: FONTS.bodySemibold,
                fontSize: 13,
                color: '#404040',
                marginBottom: 6,
              }}
            >
              Categoria
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {MEETUP_CATEGORIES.map((opt) => {
                const active = category === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setCategory(opt.value)}
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
          <Input
            label="Título"
            placeholder="Ex: Encontro no parque dos pets"
            value={title}
            onChangeText={setTitle}
            error={errors.title}
          />
          <Input
            label="Local"
            placeholder="Ex: Parque Ibirapuera, portão 3"
            value={locationName}
            onChangeText={setLocationName}
            error={errors.location_name}
          />

          {/* Vincular a um lugar pet-friendly do guia (opcional) */}
          {placeId ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#DCFCE7',
                borderRadius: 10,
                padding: 10,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#15803D', flex: 1 }}>
                📍 Vinculado a um lugar do guia
              </Text>
              <Pressable onPress={() => setPlaceId(null)} hitSlop={6}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#15803D' }}>
                  trocar
                </Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Input
                label="📍 É num lugar do guia? (opcional)"
                placeholder="Buscar parque, restaurante, café..."
                value={placeSearch}
                onChangeText={setPlaceSearch}
              />
              {placeSearch.trim().length >= 2 && (placesQuery.data?.length ?? 0) > 0 ? (
                <View style={{ gap: 6, marginTop: 6 }}>
                  {placesQuery.data!.slice(0, 5).map((p) => {
                    const m = placeKindMeta(p.kind);
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => {
                          setPlaceId(p.id);
                          setLocationName(`${p.name}${p.city ? ' — ' + p.city : ''}`);
                          setPlaceSearch('');
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          padding: 8,
                          borderRadius: 8,
                          backgroundColor: '#F5F5F4',
                        }}
                      >
                        <Text style={{ fontSize: 18 }}>{m.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            numberOfLines={1}
                            style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#1A1410' }}
                          >
                            {p.name}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{ fontFamily: FONTS.body, fontSize: 11, color: '#737373' }}
                          >
                            {m.label} · {p.address}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          )}
          <DateTimePickerInput
            label="Quando"
            value={startsAt}
            onChange={setStartsAt}
            error={errors.starts_at}
            minimumDate={new Date()}
          />
          <TextArea
            label="Descrição (opcional)"
            placeholder="Detalhes do encontro"
            value={description}
            onChangeText={setDescription}
            rows={3}
          />
          <View className="mt-2">
            <Button title="Criar encontro" onPress={handleSubmit} loading={submitting} fullWidth />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
