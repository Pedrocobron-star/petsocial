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
import { usePetHealthGate } from '@/components/pet-health-gate';
import { Button } from '@/components/ui/button';
import { DateTimePickerInput } from '@/components/ui/datetime-picker';
import { Input } from '@/components/ui/input';
import { TextArea } from '@/components/ui/text-area';
import { FONTS } from '@/lib/fonts';
import {
  addPetMilestone,
  deletePetMilestone,
  fetchHealthTimeline,
  fetchPet,
  fetchPetAgendaMemories,
  fetchPetMilestones,
  fetchPostsByPet,
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

/** Humor (1..5) registrado numa atividade vira carinha. */
function moodEmoji(mood: number | null): string {
  switch (mood) {
    case 1:
      return '😣';
    case 2:
      return '😕';
    case 3:
      return '😐';
    case 4:
      return '😊';
    case 5:
      return '🤩';
    default:
      return '';
  }
}

/** "2026-06" → "Junho de 2026" (cabeçalho de mês da timeline). */
function capitalizeMonth(monthKey: string): string {
  try {
    const label = format(parseISO(`${monthKey}-01`), "MMMM 'de' yyyy", { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return monthKey;
  }
}

export default function PetDiaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const healthGate = usePetHealthGate(id);
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
    // Null-safe: activePet pode ser null em cold-load / conta sem pet (a queryKey
    // é montada no render, antes do `enabled`). Mesmo fix de gallery.tsx/index.tsx.
    queryKey: qk.petPosts(id, activePet?.id ?? 'anon'),
    queryFn: () => fetchPostsByPet(id, activePet?.id ?? null),
    enabled: !!id,
  });
  // Eventos de saúde (vacina/vermífugo/consulta) já agregados; peso/sintoma/
  // remédio ficam de fora (são clínicos, vivem na aba Saúde, não no diário).
  const healthQuery = useQuery({
    queryKey: ['pet-timeline-health', id],
    queryFn: () => fetchHealthTimeline(id, 100),
    enabled: !!id,
  });
  // Atividades de agenda concluídas COM FOTO (banho, passeio, tosa...) = memórias.
  const agendaQuery = useQuery({
    queryKey: ['pet-timeline-agenda', id],
    queryFn: () => fetchPetAgendaMemories(id, 100),
    enabled: !!id,
  });

  const isOwner = petQuery.data?.owner_id === session?.user.id;
  const [modalOpen, setModalOpen] = useState(false);

  const timeline = useMemo<TimelineEvent[]>(() => {
    const pet = petQuery.data;
    if (!pet) return [];
    const events: TimelineEvent[] = [];

    // Entrou no app
    events.push({
      id: `auto-welcome-${id}`,
      date: toISODate(pet.created_at),
      emoji: '🐾',
      title: 'Entrou no Maestro Pet',
      description: `${pet.name} chegou na rede`,
      source: 'auto',
      color: '#F97316',
    });

    // Nascimento + aniversários já completados (derivados, sem tabela)
    if (pet.birthdate) {
      events.push({
        id: `auto-birth-${id}`,
        date: pet.birthdate,
        emoji: '🎂',
        title: 'Nasceu',
        description: `Bem-vindo ao mundo, ${pet.name}!`,
        source: 'auto',
        color: '#EC4899',
      });
      try {
        const bd = parseISO(pet.birthdate);
        const now = new Date();
        for (let year = bd.getFullYear() + 1; year <= now.getFullYear(); year++) {
          const ann = `${year}-${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`;
          if (parseISO(ann) <= now) {
            const age = year - bd.getFullYear();
            events.push({
              id: `auto-bday-${id}-${year}`,
              date: ann,
              emoji: '🥳',
              title: `Fez ${age} ${age === 1 ? 'ano' : 'anos'}!`,
              description: `${pet.name} completou ${age} ${age === 1 ? 'aninho' : 'aninhos'} 🎉`,
              source: 'auto',
              color: '#EC4899',
            });
          }
        }
      } catch {
        // birthdate inválida: ignora os aniversários derivados
      }
    }

    // TODOS os posts (foto + legenda) — o que mais enche o diário
    const sortedPosts = [...(postsQuery.data ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    sortedPosts.forEach((p, idx) => {
      const photo = p.media.find((m) => m.media_type === 'image')?.url ?? null;
      events.push({
        id: `auto-post-${p.id}`,
        date: toISODate(p.created_at),
        emoji: idx === 0 ? '📸' : '📷',
        title: idx === 0 ? 'Primeira publicação' : 'Postou no feed',
        description: p.caption ?? (photo ? undefined : 'Publicação no feed'),
        photo_url: photo,
        source: 'auto',
        color: '#10B981',
      });
    });

    // Saúde curada: vacina, vermífugo, consulta (peso/sintoma/remédio ficam na aba Saúde)
    const healthEmoji: Record<string, string> = { vaccine: '💉', parasite: '💊', vet_visit: '🩺' };
    const healthColor: Record<string, string> = { vaccine: '#3B82F6', parasite: '#0EA5E9', vet_visit: '#14B8A6' };
    for (const h of healthQuery.data ?? []) {
      const emoji = healthEmoji[h.kind];
      if (!emoji) continue;
      events.push({
        id: `auto-health-${h.kind}-${h.source_id}`,
        date: toISODate(h.date),
        emoji,
        title: h.title,
        description: h.detail ?? undefined,
        source: 'auto',
        color: healthColor[h.kind],
      });
    }

    // Atividades concluídas COM FOTO (banho, passeio, tosa) = memórias do dia a dia
    for (const log of agendaQuery.data ?? []) {
      const mood = moodEmoji(log.mood);
      events.push({
        id: `auto-agenda-${log.id}`,
        date: toISODate(log.completed_at ?? log.occurrence_date),
        emoji: log.event?.emoji ?? '🐾',
        title: log.event?.title ?? 'Atividade',
        description: [mood, log.notes].filter(Boolean).join(' ') || undefined,
        photo_url: log.photo_url,
        source: 'auto',
        color: '#F59E0B',
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

    events.sort((a, b) => b.date.localeCompare(a.date));
    return events;
  }, [petQuery.data, milestonesQuery.data, postsQuery.data, healthQuery.data, agendaQuery.data, id]);

  // Agrupa por mês/ano pra leitura tipo "álbum de memórias" (timeline já desc).
  const groups = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of timeline) {
      const key = ev.date.slice(0, 7); // YYYY-MM
      const arr = map.get(key);
      if (arr) arr.push(ev);
      else map.set(key, [ev]);
    }
    return Array.from(map.entries());
  }, [timeline]);

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

  if (healthGate) return healthGate;

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
          title="Esse diário tá só começando!"
          description="Publica uma foto, anota uma vacina ou um banho que eu vou guardando tudo aqui pra você 🐾"
          action={
            isOwner ? <Button title="Adicionar um marco" onPress={() => setModalOpen(true)} /> : undefined
          }
        />
      ) : (
        <View className="px-4 pt-4">
          {groups.map(([monthKey, evs], gi) => (
            <View key={monthKey}>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: '#A3A3A3',
                  marginTop: gi === 0 ? 0 : 10,
                  marginBottom: 10,
                  marginLeft: 4,
                }}
              >
                {capitalizeMonth(monthKey)}
              </Text>
              {evs.map((ev, i) => (
                <TimelineItem
                  key={ev.id}
                  event={ev}
                  isLast={gi === groups.length - 1 && i === evs.length - 1}
                  isOwner={isOwner}
                  onLongPress={ev.source === 'manual' ? () => confirmDelete(ev) : undefined}
                />
              ))}
            </View>
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
      const url = await uploadToBucket('posts', userId, asset.uri, ext);
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
