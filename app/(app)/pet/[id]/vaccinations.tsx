import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { HealthListSkeleton } from '@/components/health/health-list-skeleton';
import { HealthPhotoPicker, HealthPhotoThumbs } from '@/components/health/health-photos';
import { usePetHealthGate } from '@/components/pet-health-gate';
import { Button } from '@/components/ui/button';
import { DateTimePickerInput } from '@/components/ui/datetime-picker';
import { Input } from '@/components/ui/input';
import { TextArea } from '@/components/ui/text-area';
import { FONTS } from '@/lib/fonts';
import {
  cancelVaccineReminders,
  scheduleVaccineReminders,
} from '@/lib/health-notifications';
import {
  addVaccination,
  deleteVaccination,
  fetchPet,
  fetchVaccinations,
  qk,
  updateVaccination,
} from '@/lib/queries';
import type { Vaccination } from '@/lib/types';
import { exportVaccinationPdf } from '@/lib/vaccination-pdf';
import {
  getSuggestedVaccines,
  VACCINE_PROTOCOLS,
  type SuggestionStatus,
  type VaccineSuggestion,
} from '@/lib/vaccine-protocols';
import { useSession } from '@/providers/session-provider';
import { useIsPro } from '@/providers/subscription-provider';
import { useToast } from '@/providers/toast-provider';

const COMMON_VACCINES = ['Antirrábica', 'V8', 'V10', 'Giárdia', 'Leishmaniose', 'Gripe canina', 'Outra'];

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = parseISO(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISODate(d: Date | null): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function VaccinationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const healthGate = usePetHealthGate(id);
  const { session } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const isPro = useIsPro();

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });
  const vacQuery = useQuery({
    queryKey: qk.vaccinations(id),
    queryFn: () => fetchVaccinations(id),
    enabled: !!id,
  });

  const isOwner = petQuery.data?.owner_id === session?.user.id;
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vaccination | null>(null);
  const [prefillName, setPrefillName] = useState<string | null>(null);
  const [prefillNext, setPrefillNext] = useState<Date | null>(null);

  const openNew = () => {
    setEditing(null);
    setPrefillName(null);
    setPrefillNext(null);
    setModalOpen(true);
  };
  const openEdit = (v: Vaccination) => {
    setEditing(v);
    setPrefillName(null);
    setPrefillNext(null);
    setModalOpen(true);
  };
  const openFromSuggestion = (s: VaccineSuggestion) => {
    setEditing(null);
    setPrefillName(s.protocol.name);
    // Próxima dose sugerida = hoje + intervalo do protocolo → auto-agenda o lembrete
    // (paridade com o vermífugo). O usuário ainda pode ajustar no form.
    const moreInitial = s.kind === 'initial' && s.appliedCount + 1 < s.protocol.initialDoses.length;
    const interval = moreInitial
      ? s.protocol.initialIntervalDays
      : s.protocol.boosterIntervalDays;
    const nd = new Date();
    nd.setDate(nd.getDate() + interval);
    setPrefillNext(nd);
    setModalOpen(true);
  };

  const suggestions =
    petQuery.data && (VACCINE_PROTOCOLS[petQuery.data.species]?.length ?? 0) > 0
      ? getSuggestedVaccines(petQuery.data, vacQuery.data ?? [])
      : [];

  const deleteMutation = useMutation({
    mutationFn: async (vacId: string) => {
      await deleteVaccination(vacId);
      // Cancela notificações locais agendadas pra essa vacina
      await cancelVaccineReminders(vacId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.vaccinations(id) }),
    onError: (e) => Alert.alert('Erro', e instanceof Error ? e.message : 'Tente novamente.'),
  });

  const confirmDelete = (v: Vaccination) => {
    Alert.alert('Excluir vacina?', `Remover registro de ${v.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(v.id),
      },
    ]);
  };

  if (healthGate) return healthGate;

  return (
    <View className="flex-1 bg-neutral-50">
      <Stack.Screen
        options={{
          title: petQuery.data ? `Carteira de ${petQuery.data.name}` : 'Carteira',
          headerRight: () =>
            isOwner && (vacQuery.data ?? []).length > 0 ? (
              <Pressable
                hitSlop={10}
                onPress={async () => {
                  if (!petQuery.data) return;
                  try {
                    await exportVaccinationPdf(petQuery.data, vacQuery.data ?? [], isPro);
                    toast.success(
                      'PDF gerado! 📄',
                      isPro ? 'Sem marca d\'água, você é Pro!' : 'Upgrade pro Pet Pro pra remover a marca d\'água',
                    );
                  } catch (e) {
                    toast.error('Erro ao gerar PDF', e instanceof Error ? e.message : '');
                  }
                }}
                style={{ paddingHorizontal: 8 }}
              >
                <Ionicons name="download-outline" size={22} color="#111" />
              </Pressable>
            ) : null,
        }}
      />
      <FlatList
        data={vacQuery.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 12, flexGrow: 1 }}
        renderItem={({ item }) => (
          <VaccineCard
            vaccine={item}
            isOwner={isOwner}
            onEdit={() => openEdit(item)}
            onDelete={() => confirmDelete(item)}
          />
        )}
        ListEmptyComponent={
          vacQuery.isLoading ? (
            <HealthListSkeleton count={3} />
          ) : (
            <View>
              {/* Quando lista vazia mas há sugestões, suggestions panel já apareceu via header.
                  Aqui só o EmptyState complementar. */}
              <EmptyState
                emoji="💉"
                title="Sem vacinas registradas"
                description={
                  isOwner
                    ? suggestions.length > 0
                      ? 'Veja as sugestões acima ou adicione uma vacina personalizada.'
                      : 'Adicione a primeira vacina pra começar a carteira.'
                    : 'O tutor ainda não cadastrou vacinas.'
                }
                action={isOwner ? <Button title="Adicionar vacina" onPress={openNew} /> : undefined}
              />
            </View>
          )
        }
        ListHeaderComponent={
          <View>
            {isOwner && suggestions.length > 0 ? (
              <SuggestionsPanel
                suggestions={suggestions}
                petName={petQuery.data?.name ?? ''}
                onPick={openFromSuggestion}
              />
            ) : null}
            {isOwner && (vacQuery.data ?? []).length > 0 ? (
              <Pressable
                onPress={openNew}
                style={{
                  backgroundColor: '#F97316',
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  marginBottom: 12,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="add-circle" size={18} color="#fff" />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
                  Nova vacina
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      <VaccineForm
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        petId={id}
        petName={petQuery.data?.name ?? ''}
        existing={editing}
        prefillName={prefillName}
        prefillNext={prefillNext}
        onSaved={() => {
          setModalOpen(false);
          qc.invalidateQueries({ queryKey: qk.vaccinations(id) });
        }}
      />
    </View>
  );
}

// ----------------------------------------------------------------------------
// Suggestions Panel (calendário vacinal sugerido)
// ----------------------------------------------------------------------------

const STATUS_META: Record<
  SuggestionStatus,
  { label: string; color: string; bg: string; emoji: string }
> = {
  overdue: { label: 'ATRASADA', color: '#7F1D1D', bg: '#FEE2E2', emoji: '⚠️' },
  due_now: { label: 'AGORA', color: '#9A3412', bg: '#FED7AA', emoji: '🔔' },
  due_soon: { label: 'EM BREVE', color: '#854D0E', bg: '#FEF9C3', emoji: '📅' },
  up_to_date: { label: 'EM DIA', color: '#166534', bg: '#DCFCE7', emoji: '✓' },
};

function SuggestionsPanel({
  suggestions,
  petName,
  onPick,
}: {
  suggestions: VaccineSuggestion[];
  petName: string;
  onPick: (suggestion: VaccineSuggestion) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const urgentCount = suggestions.filter(
    (s) => s.status === 'overdue' || s.status === 'due_now',
  ).length;

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#FED7AA',
      }}
    >
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 14,
          gap: 10,
        }}
      >
        <Text style={{ fontSize: 22 }}>📋</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#1A1410' }}>
            Calendário sugerido{petName ? ` pra ${petName}` : ''}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#737373', marginTop: 2 }}>
            {suggestions.length} {suggestions.length === 1 ? 'sugestão' : 'sugestões'}
            {urgentCount > 0 ? ` • ${urgentCount} urgente${urgentCount === 1 ? '' : 's'}` : ''}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#525252"
        />
      </Pressable>

      {expanded ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
          {/* Disclaimer breve */}
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              backgroundColor: '#FEF3C7',
              borderRadius: 10,
              padding: 10,
              marginBottom: 4,
            }}
          >
            <Text style={{ fontSize: 14 }}>ℹ️</Text>
            <Text
              style={{
                flex: 1,
                fontFamily: FONTS.body,
                fontSize: 11,
                color: '#78350F',
                lineHeight: 15,
              }}
            >
              Sugestões baseadas em protocolo padrão brasileiro. Seu vet pode adaptar o
              calendário pra raça, estilo de vida e região. Confirme antes de aplicar.
            </Text>
          </View>

          {suggestions.map((s) => (
            <SuggestionRow
              key={s.protocol.id + s.kind}
              suggestion={s}
              onPick={() => onPick(s)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SuggestionRow({
  suggestion,
  onPick,
}: {
  suggestion: VaccineSuggestion;
  onPick: () => void;
}) {
  const meta = STATUS_META[suggestion.status];
  const priorityLabel =
    suggestion.protocol.priority === 'core'
      ? 'ESSENCIAL'
      : suggestion.protocol.priority === 'optional'
        ? 'OPCIONAL'
        : 'REGIONAL';

  return (
    <View
      style={{
        backgroundColor: '#FAFAFA',
        borderRadius: 12,
        padding: 12,
        borderLeftWidth: 3,
        borderLeftColor: meta.color,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18 }}>{suggestion.protocol.emoji}</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#1A1410' }}>
              {suggestion.protocol.name}
            </Text>
            <View
              style={{
                backgroundColor: meta.bg,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color: meta.color }}>
                {meta.emoji} {meta.label}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#F1F5F9',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color: '#475569' }}>
                {priorityLabel}
              </Text>
            </View>
          </View>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#525252', marginTop: 3 }}>
            {suggestion.message}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#737373', marginTop: 2 }}>
            {suggestion.protocol.description}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', marginTop: 8, gap: 6 }}>
        <Pressable
          onPress={onPick}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            backgroundColor: '#F97316',
            paddingVertical: 8,
            borderRadius: 8,
          }}
        >
          <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#FFFFFF' }}>
            Registrar essa
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function VaccineCard({
  vaccine,
  isOwner,
  onEdit,
  onDelete,
}: {
  vaccine: Vaccination;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const next = toDate(vaccine.next_dose_at);
  const daysUntilNext = next ? Math.ceil((next.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  let nextBadge: { color: string; bg: string; text: string } | null = null;
  if (daysUntilNext != null) {
    if (daysUntilNext < 0)
      nextBadge = { color: '#991B1B', bg: '#FEE2E2', text: `Atrasada ${Math.abs(daysUntilNext)}d` };
    else if (daysUntilNext <= 30)
      nextBadge = { color: '#92400E', bg: '#FEF3C7', text: `Vence em ${daysUntilNext}d` };
    else nextBadge = { color: '#166534', bg: '#DCFCE7', text: 'Em dia' };
  }

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
      }}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text style={{ fontSize: 20 }}>💉</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 17, color: '#1A1410' }}>{vaccine.name}</Text>
          </View>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#525252', marginTop: 4 }}>
            Aplicada em{' '}
            <Text style={{ fontFamily: FONTS.bodyBold, color: '#1A1410' }}>
              {format(parseISO(vaccine.applied_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
            </Text>
          </Text>
          {vaccine.vet_name ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#737373', marginTop: 2 }}>
              Vet: {vaccine.vet_name}
            </Text>
          ) : null}
          {vaccine.notes ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#404040', marginTop: 6 }}>
              {vaccine.notes}
            </Text>
          ) : null}
          {next ? (
            <View className="mt-2 flex-row items-center gap-2">
              <Ionicons name="calendar-outline" size={13} color="#737373" />
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#737373' }}>
                Próxima dose:{' '}
                {format(next, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
              </Text>
            </View>
          ) : null}
          {nextBadge ? (
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: nextBadge.bg,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                marginTop: 8,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: nextBadge.color }}>
                {nextBadge.text}
              </Text>
            </View>
          ) : null}
          <HealthPhotoThumbs photoUrls={vaccine.photo_urls} />
        </View>
        {isOwner ? (
          <View className="flex-row gap-1">
            <Pressable hitSlop={10} onPress={onEdit} className="rounded-full p-1.5 active:bg-neutral-100">
              <Ionicons name="pencil" size={16} color="#525252" />
            </Pressable>
            <Pressable hitSlop={10} onPress={onDelete} className="rounded-full p-1.5 active:bg-red-50">
              <Ionicons name="trash-outline" size={16} color="#dc2626" />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function VaccineForm({
  visible,
  onClose,
  petId,
  petName,
  existing,
  prefillName,
  prefillNext,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  petId: string;
  petName: string;
  existing: Vaccination | null;
  prefillName?: string | null;
  prefillNext?: Date | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? prefillName ?? '');
  const [applied, setApplied] = useState<Date | null>(toDate(existing?.applied_at) ?? new Date());
  const [next, setNext] = useState<Date | null>(toDate(existing?.next_dose_at) ?? prefillNext ?? null);
  const [vet, setVet] = useState(existing?.vet_name ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [photoUrls, setPhotoUrls] = useState<string[]>(existing?.photo_urls ?? []);
  const [submitting, setSubmitting] = useState(false);

  // Reset state quando modal abre/troca de "existing" ou de pré-preenchimento
  useEffect(() => {
    setName(existing?.name ?? prefillName ?? '');
    setApplied(toDate(existing?.applied_at) ?? new Date());
    setNext(toDate(existing?.next_dose_at) ?? prefillNext ?? null);
    setVet(existing?.vet_name ?? '');
    setNotes(existing?.notes ?? '');
    setPhotoUrls(existing?.photo_urls ?? []);
  }, [existing, prefillName, prefillNext, visible]);

  const handleSubmit = async () => {
    if (!name.trim() || !applied) {
      Alert.alert('Faltam dados', 'Informe nome da vacina e data de aplicação.');
      return;
    }
    setSubmitting(true);
    try {
      let savedVac: Vaccination | null = null;
      if (existing) {
        await updateVaccination(existing.id, {
          name: name.trim(),
          applied_at: toISODate(applied)!,
          next_dose_at: toISODate(next),
          vet_name: vet.trim() || null,
          notes: notes.trim() || null,
          photo_urls: photoUrls,
        });
        savedVac = {
          ...existing,
          name: name.trim(),
          applied_at: toISODate(applied)!,
          next_dose_at: toISODate(next),
          vet_name: vet.trim() || null,
          notes: notes.trim() || null,
          photo_urls: photoUrls,
        };
      } else {
        savedVac = await addVaccination({
          pet_id: petId,
          name: name.trim(),
          applied_at: toISODate(applied)!,
          next_dose_at: toISODate(next),
          vet_name: vet.trim() || null,
          notes: notes.trim() || null,
          photo_urls: photoUrls,
        });
      }
      // Agenda (ou reagenda) notificações locais — best-effort, não bloqueia o save
      if (savedVac && petName) {
        scheduleVaccineReminders({
          vaccinationId: savedVac.id,
          petId,
          petName,
          vaccineName: savedVac.name,
          nextDoseAt: savedVac.next_dose_at,
        }).catch(() => undefined);
      }
      onSaved();
    } catch (e) {
      Alert.alert('Erro ao salvar', e instanceof Error ? e.message : 'Tente novamente.');
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
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 36,
            maxHeight: '90%',
          }}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: '#1A1410' }}>
              {existing ? 'Editar vacina' : 'Nova vacina'}
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
                Nome
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {COMMON_VACCINES.map((v) => {
                  const active = name === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setName(v === 'Outra' ? '' : v)}
                      className={`rounded-full px-3 py-1.5 ${active ? 'bg-brand' : 'bg-neutral-100'}`}
                    >
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 12,
                          color: active ? '#fff' : '#404040',
                        }}
                      >
                        {v}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ marginTop: 8 }}>
                <Input placeholder="Nome da vacina" value={name} onChangeText={setName} />
              </View>
            </View>
            <DateTimePickerInput
              label="Data da aplicação"
              value={applied}
              onChange={setApplied}
            />
            <DateTimePickerInput
              label="Próxima dose (opcional)"
              value={next}
              onChange={setNext}
              minimumDate={new Date()}
            />
            <Input label="Veterinário (opcional)" value={vet} onChangeText={setVet} placeholder="Dr. Roberto" />
            <TextArea label="Notas (opcional)" value={notes} onChangeText={setNotes} rows={3} placeholder="Lote, reações, observações" />
            <HealthPhotoPicker
              photoUrls={photoUrls}
              onChange={setPhotoUrls}
              label="Fotos (opcional)"
              hint="Anexe a carteirinha, a etiqueta do lote ou a nota fiscal."
            />
            <View className="mt-2">
              <Button
                title={existing ? 'Salvar alterações' : 'Adicionar vacina'}
                onPress={handleSubmit}
                loading={submitting}
                fullWidth
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
