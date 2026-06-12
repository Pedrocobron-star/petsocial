import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { HealthListSkeleton } from '@/components/health/health-list-skeleton';
import { HealthPhotoPicker, HealthPhotoThumbs } from '@/components/health/health-photos';
import { usePetHealthGate } from '@/components/pet-health-gate';
import { Button } from '@/components/ui/button';
import { DateTimePickerInput } from '@/components/ui/datetime-picker';
import { FONTS } from '@/lib/fonts';
import {
  cancelVetVisitReminders,
  scheduleVetVisitReminder,
} from '@/lib/health-notifications';
import {
  createVetVisit,
  deleteVetVisit,
  fetchPet,
  fetchVetVisits,
  qk,
} from '@/lib/queries';
import type { VetVisit } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/providers/theme-provider';

export default function VetVisitsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const healthGate = usePetHealthGate(id);
  const { theme } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);

  const petQuery = useQuery({ queryKey: qk.pet(id), queryFn: () => fetchPet(id), enabled: !!id });
  const listQuery = useQuery({
    queryKey: qk.vetVisits(id),
    queryFn: () => fetchVetVisits(id),
    enabled: !!id,
  });

  const deleteMut = useMutation({
    mutationFn: async (vid: string) => {
      await deleteVetVisit(vid);
      await cancelVetVisitReminders(vid);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.vetVisits(id) });
      qc.invalidateQueries({ queryKey: qk.healthSummary(id) });
      toast.success('Consulta removida');
    },
  });

  const visits = listQuery.data ?? [];
  const petName = petQuery.data?.name ?? '';

  if (healthGate) return healthGate;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Consultas' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {showForm ? (
          <VisitForm
            petId={id}
            petName={petName}
            onCancel={() => setShowForm(false)}
            onCreated={() => {
              setShowForm(false);
              qc.invalidateQueries({ queryKey: qk.vetVisits(id) });
              qc.invalidateQueries({ queryKey: qk.healthSummary(id) });
              qc.invalidateQueries({ queryKey: qk.weightRecords(id) });
            }}
          />
        ) : (
          <Button title="+ Nova consulta" onPress={() => setShowForm(true)} fullWidth />
        )}

        {listQuery.isLoading ? <HealthListSkeleton count={3} /> : null}

        {visits.length === 0 && !listQuery.isLoading ? (
          <EmptyState
            emoji="🩺"
            title="Sem consultas registradas"
            description="Anote visitas ao veterinário, diagnósticos e tratamentos."
          />
        ) : null}

        {visits.map((v) => (
          <VisitCard
            key={v.id}
            visit={v}
            onDelete={() =>
              Alert.alert('Remover consulta?', `Visita em ${format(parseISO(v.visited_at), 'd MMM yyyy', { locale: ptBR })}`, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Remover', style: 'destructive', onPress: () => deleteMut.mutate(v.id) },
              ])
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

function VisitCard({ visit, onDelete }: { visit: VetVisit; onDelete: () => void }) {
  const { theme } = useTheme();
  const dateStr = format(parseISO(visit.visited_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 14,
        borderLeftWidth: 4,
        borderLeftColor: '#16A34A',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Text style={{ fontSize: 22 }}>🩺</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>{visit.reason}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>{dateStr}</Text>
          {visit.clinic_name || visit.vet_name ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
              {visit.clinic_name}
              {visit.vet_name ? ` • Dr(a). ${visit.vet_name}` : ''}
            </Text>
          ) : null}
        </View>
        <Pressable hitSlop={10} onPress={onDelete}>
          <Ionicons name="trash-outline" size={18} color={theme.textDim} />
        </Pressable>
      </View>

      <View style={{ gap: 6, marginTop: 8 }}>
        {visit.diagnosis ? (
          <Row label="Diagnóstico" value={visit.diagnosis} />
        ) : null}
        {visit.treatment ? <Row label="Tratamento" value={visit.treatment} /> : null}
        {visit.weight_kg ? <Row label="Peso" value={`${visit.weight_kg} kg`} /> : null}
        {visit.next_visit_at ? (
          <Row
            label="Próxima visita"
            value={format(parseISO(visit.next_visit_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
          />
        ) : null}
        {visit.notes ? <Row label="Notas" value={visit.notes} /> : null}
        <HealthPhotoThumbs photoUrls={visit.photo_urls} />
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View>
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 10,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: theme.textDim,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.text, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function VisitForm({
  petId,
  petName,
  onCancel,
  onCreated,
}: {
  petId: string;
  petName: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { theme } = useTheme();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [visitedAt, setVisitedAt] = useState(new Date().toISOString().split('T')[0]);
  const [vetName, setVetName] = useState('');
  const [clinic, setClinic] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [weight, setWeight] = useState('');
  const [nextVisit, setNextVisit] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  // string 'YYYY-MM-DD' <-> Date local (sem shift de fuso)
  const toDate = (s: string): Date | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const toISODate = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const visit = await createVetVisit({
        pet_id: petId,
        reason: reason.trim(),
        visited_at: visitedAt,
        vet_name: vetName.trim() || undefined,
        clinic_name: clinic.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        treatment: treatment.trim() || undefined,
        weight_kg: weight.trim() ? Number(weight) : undefined,
        next_visit_at: nextVisit.trim() || undefined,
        notes: notes.trim() || undefined,
        photo_urls: photoUrls,
      });
      // Agenda notificação se houver próxima visita marcada
      if (visit?.next_visit_at && petName) {
        scheduleVetVisitReminder({
          visitId: visit.id,
          petId,
          petName,
          reason: visit.reason,
          nextVisitAt: visit.next_visit_at,
          clinicName: visit.clinic_name,
        }).catch(() => undefined);
      }
      return visit;
    },
    onSuccess: () => {
      toast.success('Consulta registrada!');
      onCreated();
    },
    onError: () => toast.error('Não foi possível salvar'),
  });

  const valid = reason.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(visitedAt);

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
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>Nova consulta</Text>

      <Field label="Motivo *" value={reason} onChange={setReason} placeholder="ex: Check-up anual" />
      <DateTimePickerInput
        label="Data da consulta *"
        value={toDate(visitedAt)}
        onChange={(d) => setVisitedAt(toISODate(d))}
      />
      <Field label="Veterinário(a)" value={vetName} onChange={setVetName} placeholder="ex: Dra. Ana" />
      <Field label="Clínica" value={clinic} onChange={setClinic} placeholder="ex: PetVida" />
      <Field label="Diagnóstico" value={diagnosis} onChange={setDiagnosis} placeholder="" multiline />
      <Field label="Tratamento" value={treatment} onChange={setTreatment} placeholder="" multiline />
      <Field label="Peso (kg)" value={weight} onChange={setWeight} placeholder="ex: 8.5" />
      <DateTimePickerInput
        label="Próxima visita (opcional)"
        value={toDate(nextVisit)}
        onChange={(d) => setNextVisit(toISODate(d))}
        minimumDate={new Date()}
      />
      <Field label="Notas" value={notes} onChange={setNotes} placeholder="" multiline />
      <HealthPhotoPicker
        photoUrls={photoUrls}
        onChange={setPhotoUrls}
        label="Fotos (opcional)"
        hint="Anexe receitas, exames ou laudos da consulta."
      />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancelar" variant="secondary" onPress={onCancel} fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Salvar"
            onPress={() => createMut.mutate()}
            disabled={!valid}
            loading={createMut.isPending}
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
