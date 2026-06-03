import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { DateTimePickerInput } from '@/components/ui/datetime-picker';
import { Input } from '@/components/ui/input';
import { PressScale } from '@/components/ui/press-scale';
import { TextArea } from '@/components/ui/text-area';
import {
  describeRecurrence,
  EVENT_KIND_META,
  expandOccurrences,
  type EventTemplate,
} from '@/lib/event-templates';
import { FONTS } from '@/lib/fonts';
import { scheduleEventReminders } from '@/lib/notifications';
import { addPetEvent, updatePetEvent } from '@/lib/queries';
import type { PetEvent, PetEventKind, RecurrenceRule } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

interface Props {
  visible: boolean;
  petId: string;
  /** Pré-preencher com um template */
  template?: EventTemplate | null;
  /** Editar evento existente */
  existing?: PetEvent | null;
  onClose: () => void;
  onSaved: () => void;
}

const KIND_OPTIONS: PetEventKind[] = [
  'bath',
  'grooming',
  'school',
  'walk',
  'vet_visit',
  'feeding',
  'training',
  'playdate',
  'nail_trim',
  'ear_cleaning',
  'tooth_brushing',
  'custom',
];

const RECURRENCE_PRESETS: { value: RecurrenceRule | null; label: string }[] = [
  { value: null, label: 'Única' },
  { value: 'every:1d', label: 'Todo dia' },
  { value: 'weekly:monday,tuesday,wednesday,thursday,friday', label: 'Dias úteis' },
  { value: 'every:7d', label: 'Semanal' },
  { value: 'every:15d', label: 'Quinzenal' },
  { value: 'every:30d', label: 'Mensal' },
  { value: 'every:90d', label: '3 meses' },
  { value: 'every:180d', label: '6 meses' },
  { value: 'every:365d', label: 'Anual' },
];

const REMINDER_PRESETS: { value: number; label: string }[] = [
  { value: 0, label: 'Na hora' },
  { value: 60, label: '1h antes' },
  { value: 1440, label: '1 dia antes' },
  { value: 10080, label: '1 semana antes' },
];

function toLocalDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Combina default_time_of_day (ex: "10:00") com a próxima data
 * adequada (hoje se ainda não passou da hora, senão amanhã).
 */
function templateToInitialDate(time: string): Date {
  const [h, m] = time.split(':').map((s) => parseInt(s, 10));
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target.getTime() < now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

export function EventForm({ visible, petId, template, existing, onClose, onSaved }: Props) {
  const { theme } = useTheme();
  const toast = useToast();

  const [kind, setKind] = useState<PetEventKind>(
    existing?.kind ?? template?.kind ?? 'custom',
  );
  const [title, setTitle] = useState(existing?.title ?? template?.title ?? '');
  const [description, setDescription] = useState(
    existing?.description ?? template?.description ?? '',
  );
  const [location, setLocation] = useState(existing?.location ?? '');
  const [startsAt, setStartsAt] = useState<Date | null>(
    toLocalDate(existing?.starts_at) ??
      (template ? templateToInitialDate(template.default_time_of_day) : new Date()),
  );
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(
    existing?.recurrence_rule ?? template?.recurrence ?? null,
  );
  const [reminders, setReminders] = useState<number[]>(
    existing?.reminder_minutes ?? template?.reminders ?? [1440, 0],
  );
  const [cost, setCost] = useState<string>(
    existing?.estimated_cost?.toString() ?? template?.estimated_cost?.toString() ?? '',
  );
  const [submitting, setSubmitting] = useState(false);

  // Reset state quando template/existing mudam
  useEffect(() => {
    if (!visible) return;
    setKind(existing?.kind ?? template?.kind ?? 'custom');
    setTitle(existing?.title ?? template?.title ?? '');
    setDescription(existing?.description ?? template?.description ?? '');
    setLocation(existing?.location ?? '');
    setStartsAt(
      toLocalDate(existing?.starts_at) ??
        (template ? templateToInitialDate(template.default_time_of_day) : new Date()),
    );
    setRecurrence(existing?.recurrence_rule ?? template?.recurrence ?? null);
    setReminders(existing?.reminder_minutes ?? template?.reminders ?? [1440, 0]);
    setCost(
      existing?.estimated_cost?.toString() ?? template?.estimated_cost?.toString() ?? '',
    );
  }, [visible, template, existing]);

  const meta = EVENT_KIND_META[kind];

  const toggleReminder = (mins: number) => {
    setReminders((prev) =>
      prev.includes(mins)
        ? prev.filter((m) => m !== mins)
        : [...prev, mins].sort((a, b) => b - a),
    );
  };

  const handleSubmit = async () => {
    if (!title.trim() || !startsAt) {
      Alert.alert('Faltam dados', 'Informe o título e a data/hora.');
      return;
    }
    const costNum = cost ? parseFloat(cost.replace(',', '.')) : null;
    setSubmitting(true);
    try {
      let savedEvent: PetEvent;
      if (existing) {
        await updatePetEvent(existing.id, {
          kind,
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          emoji: meta.emoji,
          starts_at: startsAt.toISOString(),
          recurrence_rule: recurrence,
          reminder_minutes: reminders,
          estimated_cost: costNum && !Number.isNaN(costNum) ? costNum : null,
        });
        savedEvent = {
          ...existing,
          kind,
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          emoji: meta.emoji,
          starts_at: startsAt.toISOString(),
          recurrence_rule: recurrence,
          reminder_minutes: reminders,
          estimated_cost: costNum && !Number.isNaN(costNum) ? costNum : null,
        };
      } else {
        savedEvent = await addPetEvent({
          pet_id: petId,
          kind,
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          emoji: meta.emoji,
          starts_at: startsAt.toISOString(),
          recurrence_rule: recurrence,
          reminder_minutes: reminders,
          estimated_cost: costNum && !Number.isNaN(costNum) ? costNum : null,
        });
      }

      // Agendar notificações locais (próximas 12 ocorrências)
      try {
        const now = new Date();
        const horizonEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        const occurrences = expandOccurrences(
          savedEvent.recurrence_rule,
          savedEvent.starts_at,
          now.toISOString(),
          horizonEnd.toISOString(),
          12,
        );
        await scheduleEventReminders(savedEvent, occurrences);
      } catch {
        // Falha silenciosa — não bloqueia o save
      }

      toast.success(existing ? 'Atualizado!' : 'Agendado!', meta.default_tip || '');
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
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 28,
            maxHeight: '92%',
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingBottom: 8 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.border,
              }}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: 22,
                color: theme.text,
                letterSpacing: -0.4,
              }}
            >
              {existing ? 'Editar evento' : 'Novo evento'}
            </Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.textDim} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            {/* Kind chips */}
            <View>
              <Text
                style={{
                  fontFamily: FONTS.bodySemibold,
                  fontSize: 13,
                  color: theme.text,
                  marginBottom: 6,
                }}
              >
                Tipo
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {KIND_OPTIONS.map((k) => {
                  const km = EVENT_KIND_META[k];
                  const active = kind === k;
                  return (
                    <PressScale
                      key={k}
                      onPress={() => setKind(k)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: active ? km.tint.text : theme.borderLight,
                      }}
                    >
                      <Text style={{ fontSize: 12 }}>{km.emoji}</Text>
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 11,
                          color: active ? '#fff' : theme.textMuted,
                        }}
                      >
                        {km.label}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
            </View>

            <Input
              label="Título"
              value={title}
              onChangeText={setTitle}
              placeholder={`Ex: ${meta.label} do Rex`}
            />

            <DateTimePickerInput label="Quando" value={startsAt} onChange={setStartsAt} />

            {/* Recorrência */}
            <View>
              <Text
                style={{
                  fontFamily: FONTS.bodySemibold,
                  fontSize: 13,
                  color: theme.text,
                  marginBottom: 6,
                }}
              >
                Repetir
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {RECURRENCE_PRESETS.map((r) => {
                  const active = recurrence === r.value;
                  return (
                    <PressScale
                      key={r.label}
                      onPress={() => setRecurrence(r.value)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: active ? theme.brand : theme.borderLight,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 11,
                          color: active ? '#fff' : theme.textMuted,
                        }}
                      >
                        {r.label}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
              {recurrence ? (
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 11,
                    color: theme.textDim,
                    marginTop: 4,
                  }}
                >
                  Repete {describeRecurrence(recurrence)}
                </Text>
              ) : null}
            </View>

            {/* Lembretes */}
            <View>
              <Text
                style={{
                  fontFamily: FONTS.bodySemibold,
                  fontSize: 13,
                  color: theme.text,
                  marginBottom: 6,
                }}
              >
                Avisar 🔔
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {REMINDER_PRESETS.map((r) => {
                  const active = reminders.includes(r.value);
                  return (
                    <PressScale
                      key={r.value}
                      onPress={() => toggleReminder(r.value)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: active ? theme.brand : theme.borderLight,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {active ? (
                        <Ionicons name="checkmark" size={11} color="#fff" />
                      ) : null}
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 11,
                          color: active ? '#fff' : theme.textMuted,
                        }}
                      >
                        {r.label}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
            </View>

            <Input
              label="Local (opcional)"
              value={location}
              onChangeText={setLocation}
              placeholder="Petshop Doggy, Parque..."
            />

            <Input
              label="Custo estimado (R$, opcional)"
              value={cost}
              onChangeText={setCost}
              keyboardType="decimal-pad"
              placeholder="80,00"
            />

            <TextArea
              label="Notas (opcional)"
              value={description}
              onChangeText={setDescription}
              rows={2}
              placeholder="Detalhes, instruções..."
            />

            <View style={{ marginTop: 8 }}>
              <Button
                title={existing ? 'Salvar alterações' : 'Adicionar à agenda'}
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
