import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { DateTimePickerInput } from '@/components/ui/datetime-picker';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { TextArea } from '@/components/ui/text-area';
import { MEETUP_CATEGORIES } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { fetchMeetup, qk, updateMeetup } from '@/lib/queries';
import type { MeetupCategory } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';
import { AppThemeProvider } from '@/providers/app-theme-provider';
import { useTheme } from '@/providers/theme-provider';

export default function EditMeetupScreen() {
  return (
    <AppThemeProvider app="meetups">
      <EditMeetupInner />
    </AppThemeProvider>
  );
}

function EditMeetupInner() {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { activePet } = useActivePet();

  const meetupQuery = useQuery({
    queryKey: qk.meetup(id),
    queryFn: () => fetchMeetup(id, activePet!.id),
    enabled: !!id && !!activePet,
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [category, setCategory] = useState<MeetupCategory>('social');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const m = meetupQuery.data;
    if (m && !loaded) {
      setTitle(m.title);
      setDescription(m.description ?? '');
      setLocationName(m.location_name);
      setStartsAt(new Date(m.starts_at));
      setCategory(m.category);
      setLoaded(true);
    }
  }, [meetupQuery.data, loaded]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await updateMeetup(id, {
        title: title.trim(),
        description: description.trim() || null,
        location_name: locationName.trim(),
        starts_at: startsAt!.toISOString(),
        category,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.meetup(id) });
      qc.invalidateQueries({ queryKey: ['meetups'] });
      router.back();
    },
    onError: (e) => Alert.alert('Erro', e instanceof Error ? e.message : 'Tente novamente.'),
  });

  const handleSubmit = () => {
    const fe: Record<string, string> = {};
    if (title.trim().length < 3) fe.title = 'Título muito curto';
    if (locationName.trim().length < 2) fe.location_name = 'Informe o local';
    if (!startsAt) fe.starts_at = 'Escolha data e horário';
    if (Object.keys(fe).length > 0) {
      setErrors(fe);
      return;
    }
    setErrors({});
    updateMutation.mutate();
  };

  if (!meetupQuery.data) return null;

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-4 pb-12" keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#1A1410', marginBottom: 16 }}>
          Editar encontro
        </Text>
        <View className="gap-3">
          <View>
            <Text style={{ fontFamily: FONTS.bodySemibold, fontSize: 13, color: '#404040', marginBottom: 6 }}>
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
                      active ? '' : 'bg-neutral-100'
                    }`}
                    style={active ? { backgroundColor: theme.accent.color } : undefined}
                  >
                    <Text>{opt.emoji}</Text>
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 13,
                        color: active ? theme.accent.onAccent : '#404040',
                      }}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Input label="Título" value={title} onChangeText={setTitle} error={errors.title} />
          <Input
            label="Local"
            value={locationName}
            onChangeText={setLocationName}
            error={errors.location_name}
          />
          <DateTimePickerInput
            label="Quando"
            value={startsAt}
            onChange={setStartsAt}
            error={errors.starts_at}
          />
          <TextArea label="Descrição" value={description} onChangeText={setDescription} rows={3} />
          <View className="mt-2">
            <Button
              title="Salvar alterações"
              onPress={handleSubmit}
              loading={updateMutation.isPending}
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
