import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { DateTimePickerInput } from '@/components/ui/datetime-picker';
import { Input } from '@/components/ui/input';
import { TextArea } from '@/components/ui/text-area';
import { FONTS } from '@/lib/fonts';
import {
  addPetMilestone,
  deletePetMilestone,
  fetchPet,
  fetchPetMilestones,
  fetchPostsByPet,
  fetchVaccinations,
  qk,
} from '@/lib/queries';
import { guessExtension, uploadToBucket } from '@/lib/storage';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/providers/toast-provider';

interface TimelineEvent {
  id: string;
  date: string;
  emoji: string;
  title: string;
  description?: string;
  photo_url?: string | null;
  source: 'manual' | 'auto';
  color: string;
  manualId?: string;
}

function toISODate(s: string): string {
  if (s.length === 10 && s[4] === '-') return s;
  return s.slice(0, 10);
}

export default function PetDiaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { activePet } = useActivePet();
  const qc = useQueryClient();
  const toast = useToast();

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });
  const milestonesQuery = useQuery({
    queryKey: qk.milestones(id),
    queryFn: () => fetchPetMilestones(id),
    enabled: !!id,
  });
  const postsQuery = useQuery({
    queryKey: qk.petPosts(id),
    queryFn: () => fetchPostsByPet(id, activePet!.id),
    enabled: !!id && !!activePet,
  });
  const vacQuery = useQuery({
    queryKey: qk.vaccinations(id),
    queryFn: () => fetchVaccinations(id),
    enabled: !!id,
  });

  const isOwner = petQuery.data?.owner_id === session?.user.id;
  const [modalOpen, setModalOpen] = useState(false);

  const timeline = useMemo<TimelineEvent[]>(() => {
    if (!petQuery.data) return [];
    const events: TimelineEvent[] = [];

    // Bem-vindo ao app
    events.push({
      id: `auto-welcome-${id}`,
      date: toISODate(petQuery.data.created_at),
      emoji: '🐾',
      title: 'Entrou no Pet Social',
      description: `${petQuery.data.name} criou conta na rede`,
      source: 'auto',
      color: '#F97316',
    });

    // Nascimento
    if (petQuery.data.birthdate) {
      events.push({
        id: `auto-birth-${id}`,
        date: petQuery.data.birthdate,
        emoji: '🎂',
        title: 'Nasceu',
        description: `Bem-vindo ao mundo, ${petQuery.data.name}!`,
        source: 'auto',
        color: '#EC4899',
      });
    }

    // Primeira vacina
    const sortedVacs = [...(vacQuery.data ?? [])].sort((a, b) => a.applied_at.localeCompare(b.applied_at));
    if (sortedVacs[0]) {
      events.push({
        id: `auto-first-vac-${sortedVacs[0].id}`,
        date: sortedVacs[0].applied_at,
        emoji: '💉',
        title: 'Primeira vacina',
        description: sortedVacs[0].name,
        source: 'auto',
        color: '#3B82F6',
      });
    }
    // Outras vacinas
    for (const v of sortedVacs.slice(1)) {
      events.push({
        id: `auto-vac-${v.id}`,
        date: v.applied_at,
        emoji: '💉',
        title: `Vacina: ${v.name}`,
        description: v.notes ?? undefined,
        source: 'auto',
        color: '#3B82F6',
      });
    }

    // Primeiro post
    const sortedPosts = [...(postsQuery.data ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    if (sortedPosts[0]) {
      events.push({
        id: `auto-first-post-${sortedPosts[0].id}`,
        date: toISODate(sortedPosts[0].created_at),
        emoji: '📸',
        title: 'Primeira publicação',
        description: sortedPosts[0].caption ?? 'Primeiro post no feed',
        photo_url: sortedPosts[0].media[0]?.url,
        source: 'auto',
        color: '#10B981',
      });
    }

    // Marcos manuais
    for (const m of milestonesQuery.data ?? []) {
      events.push({
        id: `manual-${m.id}`,
        date: m.happened_at,
        emoji: m.emoji ?? '✨',
        title: m.title,
        description: m.description ?? undefined,
        photo_url: m.photo_url,
        source: 'manual',
        color: '#A855F7',
        manualId: m.id,
      });
    }

    // Ordena desc por data
    events.sort((a, b) => b.date.localeCompare(a.date));
    return events;
  }, [petQuery.data, milestonesQuery.data, postsQuery.data, vacQuery.data, id]);

  const deleteMutation = useMutation({
    mutationFn: (mid: string) => deletePetMilestone(mid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.milestones(id) });
      toast.success('Marco excluído');
    },
  });

  const confirmDelete = (ev: TimelineEvent) => {
    if (!ev.manualId) return;
    Alert.alert('Excluir marco?', `Remover "${ev.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(ev.manualId!),
      },
    ]);
  };

  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-12" style={{ backgroundColor: '#FFFBF5' }}>
      <Stack.Screen
        options={{
          title: petQuery.data ? `Diário de ${petQuery.data.name}` : 'Diário',
          headerRight: isOwner
            ? () => (
                <Pressable hitSlop={10} onPress={() => setModalOpen(true)} className="pr-2">
                  <Ionicons name="add-circle" size={26} color="#F97316" />
                </Pressable>
              )
            : undefined,
        }}
      />

      {timeline.length === 0 ? (
        <EmptyState
          emoji="📔"
          title="Diário em branco"
          description="Adicione marcos importantes pra criar a linha do tempo do pet."
          action={
            isOwner ? <Button title="Adicionar marco" onPress={() => setModalOpen(true)} /> : undefined
          }
        />
      ) : (
        <View className="px-4 pt-4">
          {timeline.map((ev, i) => (
            <TimelineItem
              key={ev.id}
              event={ev}
              isLast={i === timeline.length - 1}
              isOwner={isOwner}
              onLongPress={ev.source === 'manual' ? () => confirmDelete(ev) : undefined}
            />
          ))}
        </View>
      )}

      <MilestoneForm
        visible={modalOpen}
        petId={id}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          qc.invalidateQueries({ queryKey: qk.milestones(id) });
          toast.success('Marco adicionado!', 'Mais um pra contar a história 🐾');
        }}
      />
    </ScrollView>
  );
}

function TimelineItem({
  event,
  isLast,
  isOwner,
  onLongPress,
}: {
  event: TimelineEvent;
  isLast: boolean;
  isOwner: boolean;
  onLongPress?: () => void;
}) {
  return (
    <View className="flex-row gap-3">
      {/* Linha vertical + ponto */}
      <View className="items-center">
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#fff',
            borderWidth: 2,
            borderColor: event.color,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: event.color,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.18,
            shadowRadius: 6,
            elevation: 2,
          }}
        >
          <Text style={{ fontSize: 18 }}>{event.emoji}</Text>
        </View>
        {!isLast ? (
          <View
            style={{
              flex: 1,
              width: 2,
              backgroundColor: '#E5E5E5',
              marginVertical: 4,
              minHeight: 30,
            }}
          />
        ) : null}
      </View>

      {/* Card do evento */}
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={400}
        style={{
          flex: 1,
          backgroundColor: '#fff',
          borderRadius: 14,
          padding: 12,
          marginBottom: 14,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 1,
        }}
      >
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3' }}>
          {format(parseISO(event.date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
        </Text>
        <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#1A1410', marginTop: 2 }}>
          {event.title}
        </Text>
        {event.description ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#525252', marginTop: 4 }}>
            {event.description}
          </Text>
        ) : null}
        {event.photo_url ? (
          <View style={{ marginTop: 8, borderRadius: 10, overflow: 'hidden' }}>
            <Image source={{ uri: event.photo_url }} style={{ width: '100%', height: 160 }} contentFit="cover" />
          </View>
        ) : null}
        {event.source === 'manual' && isOwner ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: '#A3A3A3', marginTop: 4 }}>
            Pressione longo pra excluir
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

function MilestoneForm({
  visible,
  petId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  petId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useSession();
  const userId = session?.user.id;
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('✨');
  const [date, setDate] = useState<Date | null>(new Date());
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const EMOJIS = ['✨', '🎂', '🛁', '🚶', '🏖️', '🐾', '💝', '🎓', '✂️', '🦴', '🎁', '🌟'];

  const pickPhoto = async () => {
    if (!userId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error('Permissão necessária', 'Libere o acesso à galeria nas configurações.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const ext = guessExtension(asset.uri, 'jpg');
      const url = await uploadToBucket('avatars', userId, asset.uri, ext);
      setPhotoUrl(url);
    } catch (e) {
      toast.error('Erro no upload', e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(false);
    }
  };

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Dá um título pro marco');
      return;
    }
    if (!date) {
      setError('Escolhe uma data');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      await addPetMilestone({
        pet_id: petId,
        title: title.trim(),
        description: description.trim() || null,
        emoji,
        happened_at: iso,
        photo_url: photoUrl || null,
      });
      // Reset
      setTitle('');
      setDescription('');
      setEmoji('✨');
      setDate(new Date());
      setPhotoUrl('');
      onSaved();
    } catch (e) {
      toast.error('Erro ao salvar', e instanceof Error ? e.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 36,
            maxHeight: '90%',
          }}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: '#1A1410' }}>
              Novo marco
            </Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={24} color="#525252" />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
            <View>
              <Text
                style={{
                  fontFamily: FONTS.bodySemibold,
                  fontSize: 13,
                  color: '#404040',
                  marginBottom: 6,
                }}
              >
                Emoji
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {EMOJIS.map((e) => {
                  const active = emoji === e;
                  return (
                    <Pressable
                      key={e}
                      onPress={() => setEmoji(e)}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        backgroundColor: active ? '#FFEDD5' : '#F5F5F5',
                        borderWidth: active ? 2 : 0,
                        borderColor: '#F97316',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 22 }}>{e}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Input
              label="Título"
              placeholder="Ex: Primeira ida ao parque"
              value={title}
              onChangeText={(v) => {
                setTitle(v);
                if (error) setError(null);
              }}
              error={error && error.toLowerCase().includes('título') ? error : undefined}
            />
            <DateTimePickerInput
              label="Quando aconteceu"
              value={date}
              onChange={(d) => {
                setDate(d);
                if (error) setError(null);
              }}
            />
            {error && error.toLowerCase().includes('data') ? (
              <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#DC2626', marginTop: -8 }}>
                {error}
              </Text>
            ) : null}
            <TextArea
              label="Descrição (opcional)"
              placeholder="Conta a história"
              value={description}
              onChangeText={setDescription}
              rows={3}
            />
            <View>
              <Text
                style={{
                  fontFamily: FONTS.bodySemibold,
                  fontSize: 13,
                  color: '#404040',
                  marginBottom: 6,
                }}
              >
                Foto (opcional)
              </Text>
              <Pressable
                onPress={pickPhoto}
                style={{
                  height: 120,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: '#E5E5E5',
                  borderStyle: 'dashed',
                  backgroundColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <>
                    <Ionicons name="camera" size={28} color="#A3A3A3" />
                    <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#737373', marginTop: 4 }}>
                      {uploading ? 'Enviando...' : 'Toque pra adicionar foto'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
            <View className="mt-2">
              <Button title="Salvar marco" onPress={handleSubmit} loading={submitting} fullWidth />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
