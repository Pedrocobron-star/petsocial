import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { EmptyState } from '@/components/empty-state';
import { usePetHealthGate } from '@/components/pet-health-gate';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import {
  addWeightRecord,
  deleteWeightRecord,
  fetchWeightRecords,
  qk,
} from '@/lib/queries';
import type { WeightRecord } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';
import { useTheme } from '@/providers/theme-provider';

export default function WeightScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const healthGate = usePetHealthGate(id);
  const { theme } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);

  const listQuery = useQuery({
    queryKey: qk.weightRecords(id),
    queryFn: () => fetchWeightRecords(id),
    enabled: !!id,
  });

  const deleteMut = useMutation({
    mutationFn: (wid: string) => deleteWeightRecord(wid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.weightRecords(id) });
      qc.invalidateQueries({ queryKey: qk.healthSummary(id) });
      toast.success('Pesagem removida');
    },
  });

  const records = listQuery.data ?? [];
  const last = records.length > 0 ? records[records.length - 1] : null;
  const first = records.length > 1 ? records[0] : null;
  const diff = last && first ? Number((last.weight_kg - first.weight_kg).toFixed(2)) : 0;

  if (healthGate) return healthGate;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Peso' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {last ? (
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 14,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 36 }}>⚖️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.display, fontSize: 28, color: theme.text }}>
                {last.weight_kg} kg
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                Pesado em {format(parseISO(last.weighed_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
              </Text>
              {records.length > 1 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Ionicons
                    name={diff > 0 ? 'trending-up' : diff < 0 ? 'trending-down' : 'remove'}
                    size={14}
                    color={diff > 0 ? '#16A34A' : diff < 0 ? '#DC2626' : theme.textDim}
                  />
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 12,
                      color: diff > 0 ? '#16A34A' : diff < 0 ? '#DC2626' : theme.textDim,
                    }}
                  >
                    {diff > 0 ? '+' : ''}
                    {diff} kg desde a primeira pesagem
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {records.length >= 2 ? <WeightChart records={records} /> : null}

        {showForm ? (
          <WeightForm
            petId={id}
            onCancel={() => setShowForm(false)}
            onCreated={() => {
              setShowForm(false);
              qc.invalidateQueries({ queryKey: qk.weightRecords(id) });
              qc.invalidateQueries({ queryKey: qk.healthSummary(id) });
            }}
          />
        ) : (
          <Button title="+ Adicionar pesagem" onPress={() => setShowForm(true)} fullWidth />
        )}

        {records.length === 0 && !listQuery.isLoading ? (
          <EmptyState
            emoji="⚖️"
            title="Sem pesagens registradas"
            description="Pese seu pet regularmente pra acompanhar a evolução. Funciona com pesagem em casa ou na consulta."
          />
        ) : null}

        {records.length > 0 ? (
          <>
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
              Histórico ({records.length})
            </Text>
            {[...records].reverse().map((r) => (
              <View
                key={r.id}
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 12,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: theme.text }}>
                    {r.weight_kg} kg
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                    {format(parseISO(r.weighed_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </Text>
                  {r.notes ? (
                    <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                      {r.notes}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert('Remover pesagem?', `${r.weight_kg} kg em ${format(parseISO(r.weighed_at), 'd MMM', { locale: ptBR })}`, [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Remover', style: 'destructive', onPress: () => deleteMut.mutate(r.id) },
                    ])
                  }
                >
                  <Ionicons name="trash-outline" size={18} color={theme.textDim} />
                </Pressable>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function WeightChart({ records }: { records: WeightRecord[] }) {
  const { theme } = useTheme();
  const W = 320;
  const H = 180;
  const padX = 32;
  const padY = 24;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const weights = records.map((r) => r.weight_kg);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  const points = records.map((r, i) => {
    const x = padX + (i / Math.max(records.length - 1, 1)) * innerW;
    const y = padY + innerH - ((r.weight_kg - minW) / range) * innerH;
    return { x, y, r };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 12,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          alignSelf: 'flex-start',
          fontFamily: FONTS.bodyBold,
          fontSize: 12,
          color: theme.textDim,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        Evolução
      </Text>
      <Svg width={W} height={H}>
        {/* Eixo Y labels (min, max) */}
        <SvgText
          x={padX - 6}
          y={padY + 4}
          fontSize="10"
          fill={theme.textDim}
          textAnchor="end"
        >
          {maxW.toFixed(1)}
        </SvgText>
        <SvgText
          x={padX - 6}
          y={padY + innerH + 4}
          fontSize="10"
          fill={theme.textDim}
          textAnchor="end"
        >
          {minW.toFixed(1)}
        </SvgText>

        {/* Linhas guia */}
        <Line x1={padX} y1={padY} x2={W - padX} y2={padY} stroke={theme.borderLight} strokeWidth={1} />
        <Line
          x1={padX}
          y1={padY + innerH}
          x2={W - padX}
          y2={padY + innerH}
          stroke={theme.borderLight}
          strokeWidth={1}
        />

        {/* Linha do gráfico */}
        <Polyline points={polyline} fill="none" stroke="#F97316" strokeWidth={3} />

        {/* Pontos */}
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill="#F97316" />
        ))}

        {/* Primeira e última data */}
        <SvgText
          x={padX}
          y={H - 4}
          fontSize="10"
          fill={theme.textDim}
          textAnchor="start"
        >
          {format(parseISO(records[0].weighed_at), 'd MMM', { locale: ptBR })}
        </SvgText>
        <SvgText
          x={W - padX}
          y={H - 4}
          fontSize="10"
          fill={theme.textDim}
          textAnchor="end"
        >
          {format(parseISO(records[records.length - 1].weighed_at), 'd MMM', { locale: ptBR })}
        </SvgText>
      </Svg>
    </View>
  );
}

function WeightForm({
  petId,
  onCancel,
  onCreated,
}: {
  petId: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { theme } = useTheme();
  const toast = useToast();
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const createMut = useMutation({
    mutationFn: () =>
      addWeightRecord({
        pet_id: petId,
        weight_kg: Number(weight),
        weighed_at: date,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Pesagem registrada!');
      onCreated();
    },
    onError: () => toast.error('Não foi possível salvar'),
  });

  const w = Number(weight);
  const valid = !Number.isNaN(w) && w > 0 && w < 200 && /^\d{4}-\d{2}-\d{2}$/.test(date);

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
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>Nova pesagem</Text>
      <Field label="Peso (kg) *" value={weight} onChange={setWeight} placeholder="ex: 8.5" />
      <DateField label="Data *" value={date} onChange={setDate} />
      <Field label="Notas" value={notes} onChange={setNotes} placeholder="" multiline />

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

/** Campo de data — no web usa o date-picker nativo (sem hora); no native, texto. */
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { theme } = useTheme();
  const today = new Date().toISOString().split('T')[0];
  return (
    <View>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.textDim, marginBottom: 4 }}>
        {label}
      </Text>
      {Platform.OS === 'web' ? (
        <input
          type="date"
          value={value}
          max={today}
          onChange={(e: { target: { value: string } }) => onChange(e.target.value)}
          style={{
            borderWidth: 0,
            backgroundColor: theme.borderLight,
            borderRadius: 10,
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 12,
            paddingRight: 12,
            fontFamily: FONTS.body,
            fontSize: 14,
            color: theme.text,
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="2026-05-13"
          placeholderTextColor={theme.textDim}
          style={{
            backgroundColor: theme.borderLight,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontFamily: FONTS.body,
            fontSize: 14,
            color: theme.text,
          }}
        />
      )}
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
        keyboardType={label.includes('Peso') ? 'decimal-pad' : 'default'}
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
