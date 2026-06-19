import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { usePetHealthGate } from '@/components/pet-health-gate';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import {
  createMedication,
  deleteMedication,
  fetchMedications,
  logMedicationDose,
  qk,
  updateMedication,
} from '@/lib/queries';
import type { MedicationFrequency, MedicationWithLogs } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/providers/theme-provider';

const FREQ_LABEL: Record<MedicationFrequency, string> = {
  daily: '1× ao dia',
  twice_daily: '2× ao dia',
  weekly: '1× por semana',
  monthly: '1× por mês',
  as_needed: 'Conforme necessário',
};

export default function MedicationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const healthGate = usePetHealthGate(id);
  const { theme } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MedicationWithLogs | null>(null);

  const listQuery = useQuery({
    queryKey: qk.medications(id),
    queryFn: () => fetchMedications(id),
    enabled: !!id,
  });

  const logMutation = useMutation({
    mutationFn: (medId: string) => logMedicationDose(medId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.medications(id) });
      qc.invalidateQueries({ queryKey: qk.healthSummary(id) });
      toast.success('Dose registrada! ✅');
    },
    onError: () => toast.error('Não foi possível registrar'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ medId, active }: { medId: string; active: boolean }) =>
      updateMedication(medId, { active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.medications(id) });
      qc.invalidateQueries({ queryKey: qk.healthSummary(id) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (medId: string) => deleteMedication(medId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.medications(id) });
      qc.invalidateQueries({ queryKey: qk.healthSummary(id) });
      toast.success('Removido');
    },
  });

  const meds = listQuery.data ?? [];
  const active = meds.filter((m) => m.active);
  const inactive = meds.filter((m) => !m.active);

  if (healthGate) return healthGate;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Remédios' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {showForm || editing ? (
          <MedicationForm
            key={editing?.id ?? 'new'}
            petId={id}
            existing={editing}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSaved={() => {
              setShowForm(false);
              setEditing(null);
              qc.invalidateQueries({ queryKey: qk.medications(id) });
              qc.invalidateQueries({ queryKey: qk.healthSummary(id) });
            }}
          />
        ) : (
          <Button
            title="+ Adicionar remédio"
            onPress={() => {
              setEditing(null);
              setShowForm(true);
            }}
            fullWidth
          />
        )}

        {active.length === 0 && inactive.length === 0 && !listQuery.isLoading ? (
          <EmptyState
            emoji="💊"
            title="Sem remédios cadastrados"
            description="Adicione antipulgas, vermífugo, medicação contínua e receba lembretes."
          />
        ) : null}

        {active.length > 0 ? (
          <>
            <SectionLabel title={`Ativos (${active.length})`} />
            {active.map((m) => (
              <MedicationCard
                key={m.id}
                med={m}
                onLog={() => logMutation.mutate(m.id)}
                onEdit={() => {
                  setShowForm(false);
                  setEditing(m);
                }}
                onToggleActive={() => toggleActiveMutation.mutate({ medId: m.id, active: false })}
                onDelete={() => {
                  Alert.alert('Remover remédio?', `Tem certeza que quer remover "${m.name}"?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Remover',
                      style: 'destructive',
                      onPress: () => deleteMutation.mutate(m.id),
                    },
                  ]);
                }}
              />
            ))}
          </>
        ) : null}

        {inactive.length > 0 ? (
          <>
            <SectionLabel title={`Inativos (${inactive.length})`} />
            {inactive.map((m) => (
              <MedicationCard
                key={m.id}
                med={m}
                onLog={() => {}}
                onEdit={() => {
                  setShowForm(false);
                  setEditing(m);
                }}
                onToggleActive={() => toggleActiveMutation.mutate({ medId: m.id, active: true })}
                onDelete={() => {
                  Alert.alert('Remover remédio?', `Tem certeza que quer remover "${m.name}"?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Remover',
                      style: 'destructive',
                      onPress: () => deleteMutation.mutate(m.id),
                    },
                  ]);
                }}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        fontFamily: FONTS.bodyBold,
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: theme.brand,
        marginTop: 8,
      }}
    >
      {title}
    </Text>
  );
}

function MedicationCard({
  med,
  onLog,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  med: MedicationWithLogs;
  onLog: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const { theme } = useTheme();
  const expectedToday = med.frequency === 'twice_daily' ? 2 : med.frequency === 'daily' ? 1 : 0;
  const remainingToday = Math.max(0, expectedToday - med.doses_today);

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 14,
        gap: 6,
        opacity: med.active ? 1 : 0.55,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Text style={{ fontSize: 22 }}>💊</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>{med.name}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
            {FREQ_LABEL[med.frequency]}
            {med.dosage ? ` • ${med.dosage}` : ''}
            {med.time_of_day ? ` • ${med.time_of_day}` : ''}
          </Text>
          {med.last_log ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 4 }}>
              Última dose: {formatDistanceToNow(new Date(med.last_log.administered_at), { addSuffix: true, locale: ptBR })}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable hitSlop={10} onPress={onEdit}>
            <Ionicons name="pencil" size={17} color={theme.textDim} />
          </Pressable>
          <Pressable hitSlop={10} onPress={onDelete}>
            <Ionicons name="trash-outline" size={18} color={theme.textDim} />
          </Pressable>
        </View>
      </View>

      {med.notes ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
          {med.notes}
        </Text>
      ) : null}

      {med.active && (med.frequency === 'daily' || med.frequency === 'twice_daily') ? (
        <View
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 10,
            backgroundColor: remainingToday > 0 ? '#FEF3C7' : '#DCFCE7',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 16 }}>{remainingToday > 0 ? '🔔' : '✅'}</Text>
          <Text
            style={{
              flex: 1,
              fontFamily: FONTS.bodyBold,
              fontSize: 12,
              color: remainingToday > 0 ? '#78350F' : '#166534',
            }}
          >
            {remainingToday > 0
              ? `Hoje: ${med.doses_today}/${expectedToday} doses, falta ${remainingToday}`
              : `Hoje: ${med.doses_today}/${expectedToday}, completo!`}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {med.active ? (
          <Button title="Marcar dose ✓" size="sm" onPress={onLog} />
        ) : null}
        <Button
          title={med.active ? 'Pausar' : 'Reativar'}
          variant="secondary"
          size="sm"
          onPress={onToggleActive}
        />
      </View>
    </View>
  );
}

function MedicationForm({
  petId,
  existing,
  onCancel,
  onSaved,
}: {
  petId: string;
  existing: MedicationWithLogs | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { theme } = useTheme();
  const toast = useToast();
  const [name, setName] = useState(existing?.name ?? '');
  const [dosage, setDosage] = useState(existing?.dosage ?? '');
  const [frequency, setFrequency] = useState<MedicationFrequency>(existing?.frequency ?? 'daily');
  const [timeOfDay, setTimeOfDay] = useState(existing?.time_of_day ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const saveMut = useMutation({
    mutationFn: async () => {
      if (existing) {
        await updateMedication(existing.id, {
          name: name.trim(),
          dosage: dosage.trim() || null,
          frequency,
          time_of_day: timeOfDay.trim() || null,
          notes: notes.trim() || null,
        });
      } else {
        await createMedication({
          pet_id: petId,
          name: name.trim(),
          dosage: dosage.trim() || undefined,
          frequency,
          time_of_day: timeOfDay.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }
    },
    onSuccess: () => {
      toast.success(existing ? 'Remédio atualizado!' : 'Remédio adicionado!');
      onSaved();
    },
    onError: () => toast.error('Não foi possível salvar'),
  });

  const valid = name.trim().length > 0;

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 14,
        gap: 10,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>
        {existing ? 'Editar remédio' : 'Novo remédio'}
      </Text>
      <Field label="Nome *" value={name} onChange={setName} placeholder="ex: Bravecto, Carprofeno" />
      <Field label="Dose" value={dosage} onChange={setDosage} placeholder="ex: 1 comprimido, 5ml" />

      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.textDim }}>Frequência</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(Object.keys(FREQ_LABEL) as MedicationFrequency[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFrequency(f)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: frequency === f ? theme.brand : theme.borderLight,
            }}
          >
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 12,
                color: frequency === f ? '#fff' : theme.text,
              }}
            >
              {FREQ_LABEL[f]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Field
        label="Horário (opcional)"
        value={timeOfDay}
        onChange={setTimeOfDay}
        placeholder="ex: 08:00 e 20:00"
      />
      <Field label="Observações" value={notes} onChange={setNotes} placeholder="Notas extras" multiline />

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancelar" variant="secondary" onPress={onCancel} fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={existing ? 'Salvar alterações' : 'Salvar'}
            onPress={() => saveMut.mutate()}
            disabled={!valid}
            loading={saveMut.isPending}
            fullWidth
          />
        </View>
      </View>
    </View>
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
          minHeight: multiline ? 60 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}
