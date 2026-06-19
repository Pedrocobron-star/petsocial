import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { HealthListSkeleton } from '@/components/health/health-list-skeleton';
import { usePetHealthGate } from '@/components/pet-health-gate';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import {
  createPetSymptom,
  deletePetSymptom,
  fetchPet,
  fetchPetSymptoms,
  qk,
  reopenSymptom,
  resolveSymptom,
  updatePetSymptom,
  type SymptomFilter,
} from '@/lib/queries';
import { deleteFromBucket, guessExtension, uploadToBucket } from '@/lib/storage';
import { exportSymptomsPdf } from '@/lib/symptoms-pdf';
import type { PetSymptom } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useIsPro } from '@/providers/subscription-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const MAX_SYMPTOM_PHOTOS = 3;

const SEVERITY_META: Record<number, { label: string; emoji: string; color: string; bg: string }> = {
  1: { label: 'Leve', emoji: '🟢', color: '#166534', bg: '#DCFCE7' },
  2: { label: 'Pouco', emoji: '🟡', color: '#854D0E', bg: '#FEF9C3' },
  3: { label: 'Moderado', emoji: '🟠', color: '#9A3412', bg: '#FED7AA' },
  4: { label: 'Forte', emoji: '🔴', color: '#9F1239', bg: '#FECDD3' },
  5: { label: 'Grave', emoji: '🚨', color: '#7F1D1D', bg: '#FEE2E2' },
};

const FILTERS: { key: SymptomFilter; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'active', label: 'Ativos' },
  { key: 'flagged', label: 'Pra vet' },
  { key: 'resolved', label: 'Resolvidos' },
];

type PeriodFilter = 'all' | '7d' | '30d' | '90d';
const PERIODS: { key: PeriodFilter; label: string; days: number | null }[] = [
  { key: 'all', label: 'Tudo', days: null },
  { key: '7d', label: '7 dias', days: 7 },
  { key: '30d', label: '30 dias', days: 30 },
  { key: '90d', label: '90 dias', days: 90 },
];

const BODY_PART_CHIPS = [
  'Pele',
  'Olhos',
  'Ouvidos',
  'Boca',
  'Patas',
  'Barriga',
  'Costas',
  'Cauda',
  'Geral',
];

export default function SymptomsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const healthGate = usePetHealthGate(id);
  const { theme } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const isPro = useIsPro();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<SymptomFilter>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [editing, setEditing] = useState<PetSymptom | null>(null);

  const petQuery = useQuery({ queryKey: qk.pet(id), queryFn: () => fetchPet(id), enabled: !!id });
  const listQuery = useQuery({
    queryKey: qk.petSymptoms(id, filter),
    queryFn: () => fetchPetSymptoms(id, filter),
    enabled: !!id,
  });

  const resolveMut = useMutation({
    mutationFn: (sid: string) => resolveSymptom(sid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pet-symptoms', id] });
      toast.success('Sintoma marcado como resolvido');
    },
  });

  const reopenMut = useMutation({
    mutationFn: (sid: string) => reopenSymptom(sid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pet-symptoms', id] });
      toast.info('Sintoma reaberto');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (sid: string) => deletePetSymptom(sid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pet-symptoms', id] });
      toast.success('Registro removido');
    },
  });

  const symptomsRaw = listQuery.data;
  const symptoms = useMemo(() => {
    const list = symptomsRaw ?? [];
    const periodCfg = PERIODS.find((p) => p.key === period);
    if (!periodCfg?.days) return list;
    const cutoff = Date.now() - periodCfg.days * 86400000;
    return list.filter((s) => new Date(s.recorded_at).getTime() >= cutoff);
  }, [symptomsRaw, period]);
  const grouped = useMemo(() => groupByDay(symptoms), [symptoms]);

  const handleExportPdf = async () => {
    if (!petQuery.data) return;
    try {
      await exportSymptomsPdf(petQuery.data, symptoms, isPro);
      toast.success(
        'PDF gerado! 📄',
        isPro ? 'Sem marca d\'água, você é Pro!' : 'Upgrade pra Pet Pro pra remover a marca d\'água',
      );
    } catch (e) {
      toast.error('Erro ao gerar PDF', e instanceof Error ? e.message : '');
    }
  };

  if (healthGate) return healthGate;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: 'Sintomas',
          headerRight: () =>
            symptoms.length > 0 ? (
              <Pressable
                hitSlop={10}
                onPress={handleExportPdf}
                style={{ paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="share-outline" size={20} color="#111" />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#111' }}>
                  Pro vet
                </Text>
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {/* Disclaimer médico — sempre visível, primeira coisa */}
        <Disclaimer />

        {/* CTA / Form */}
        {showForm ? (
          <SymptomForm
            petId={id}
            existing={editing}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSaved={() => {
              setShowForm(false);
              setEditing(null);
              qc.invalidateQueries({ queryKey: ['pet-symptoms', id] });
            }}
          />
        ) : (
          <Button
            title="+ Registrar sintoma"
            onPress={() => {
              setEditing(null);
              setShowForm(true);
            }}
            fullWidth
          />
        )}

        {/* Filtros de status */}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? theme.brand : theme.borderLight,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 12,
                    color: active ? '#FFFFFF' : theme.textDim,
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Filtros de período */}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <Pressable
                key={p.key}
                onPress={() => setPeriod(p.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: active ? '#1A1410' : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: active ? '#1A1410' : theme.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 11,
                    color: active ? '#FFFFFF' : theme.textDim,
                  }}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Skeleton enquanto carrega */}
        {listQuery.isLoading ? <HealthListSkeleton count={2} /> : null}

        {/* Empty state */}
        {symptoms.length === 0 && !listQuery.isLoading ? (
          <EmptyState
            emoji="📝"
            title={
              filter === 'all'
                ? 'Nada registrado ainda'
                : filter === 'active'
                  ? 'Sem sintomas ativos'
                  : filter === 'flagged'
                    ? 'Nada marcado pro vet'
                    : 'Sem sintomas resolvidos'
            }
            description={
              filter === 'all'
                ? 'Use este espaço pra anotar o que percebeu (coceira, vômito, falta de apetite) e mostrar pro veterinário na próxima consulta.'
                : 'Mude o filtro pra ver outros registros.'
            }
          />
        ) : null}

        {/* Lista agrupada por dia */}
        {grouped.map(({ day, items }) => (
          <View key={day} style={{ gap: 8 }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: theme.brand,
                marginTop: 6,
              }}
            >
              {day}
            </Text>
            {items.map((s) => (
              <SymptomCard
                key={s.id}
                symptom={s}
                onResolve={() => resolveMut.mutate(s.id)}
                onReopen={() => reopenMut.mutate(s.id)}
                onEdit={() => {
                  setEditing(s);
                  setShowForm(true);
                }}
                onDelete={() =>
                  Alert.alert(
                    'Apagar registro?',
                    'Esse sintoma será removido permanentemente.',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Apagar',
                        style: 'destructive',
                        onPress: () => deleteMut.mutate(s.id),
                      },
                    ],
                  )
                }
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Disclaimer() {
  return (
    <View
      style={{
        backgroundColor: '#FEF3C7',
        borderRadius: 14,
        padding: 12,
        flexDirection: 'row',
        gap: 10,
        borderWidth: 1,
        borderColor: '#FCD34D',
      }}
    >
      <Text style={{ fontSize: 18 }}>⚠️</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#92400E' }}>
          Maestro Pet não substitui veterinário
        </Text>
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 12,
            color: '#78350F',
            marginTop: 2,
            lineHeight: 17,
          }}
        >
          Esses registros são pra você organizar e mostrar pro vet. Se algo te
          preocupa, marque uma consulta — não confie em diagnóstico de app.
        </Text>
      </View>
    </View>
  );
}

function SymptomCard({
  symptom,
  onResolve,
  onReopen,
  onEdit,
  onDelete,
}: {
  symptom: PetSymptom;
  onResolve: () => void;
  onReopen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { theme } = useTheme();
  const meta = SEVERITY_META[symptom.severity] ?? SEVERITY_META[3];
  const resolved = !!symptom.resolved_at;
  const time = format(parseISO(symptom.recorded_at), "HH:mm");

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 14,
        gap: 8,
        borderLeftWidth: 4,
        borderLeftColor: resolved ? '#94A3B8' : meta.color,
        opacity: resolved ? 0.75 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <View
              style={{
                backgroundColor: meta.bg,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: meta.color }}>
                {meta.label.toUpperCase()}
              </Text>
            </View>
            {symptom.flagged_for_vet ? (
              <View
                style={{
                  backgroundColor: '#FECACA',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 10 }}>🩺</Text>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: '#7F1D1D' }}>
                  PRA VET
                </Text>
              </View>
            ) : null}
            {resolved ? (
              <View
                style={{
                  backgroundColor: '#E2E8F0',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 999,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: '#475569' }}>
                  RESOLVIDO
                </Text>
              </View>
            ) : null}
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
              {time}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              color: theme.text,
              marginTop: 6,
              lineHeight: 19,
            }}
          >
            {symptom.description}
          </Text>
          {symptom.body_part ? (
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 12,
                color: theme.textDim,
                marginTop: 4,
              }}
            >
              📍 {symptom.body_part}
            </Text>
          ) : null}
          {symptom.notes ? (
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 12,
                color: theme.textMuted,
                marginTop: 4,
                fontStyle: 'italic',
              }}
            >
              {symptom.notes}
            </Text>
          ) : null}
          {symptom.photo_urls && symptom.photo_urls.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              {symptom.photo_urls.map((url) => (
                <Image
                  key={url}
                  source={{ uri: url }}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 8,
                    backgroundColor: theme.borderLight,
                  }}
                />
              ))}
            </View>
          ) : null}
          {resolved && symptom.resolved_at ? (
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 11,
                color: theme.textDim,
                marginTop: 4,
              }}
            >
              Resolvido {formatDistanceToNow(parseISO(symptom.resolved_at), { addSuffix: true, locale: ptBR })}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
        {resolved ? (
          <Pressable
            onPress={onReopen}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: theme.borderLight,
            }}
          >
            <Ionicons name="refresh" size={14} color={theme.textDim} />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: theme.textDim }}>
              Reabrir
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onResolve}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: '#DCFCE7',
            }}
          >
            <Ionicons name="checkmark" size={14} color="#166534" />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#166534' }}>
              Marcar resolvido
            </Text>
          </Pressable>
        )}
        <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 4 }}>
          <Pressable onPress={onEdit} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name="pencil-outline" size={16} color={theme.textDim} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8} style={{ padding: 6 }}>
            <Ionicons name="trash-outline" size={16} color={theme.textDim} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SymptomForm({
  petId,
  existing,
  onCancel,
  onSaved,
}: {
  petId: string;
  existing: PetSymptom | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { theme } = useTheme();
  const toast = useToast();
  const { session } = useSession();
  const [description, setDescription] = useState(existing?.description ?? '');
  const [severity, setSeverity] = useState(existing?.severity ?? 2);
  const [bodyPart, setBodyPart] = useState(existing?.body_part ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [flaggedForVet, setFlaggedForVet] = useState(existing?.flagged_for_vet ?? false);
  const [photoUrls, setPhotoUrls] = useState<string[]>(existing?.photo_urls ?? []);
  const [uploading, setUploading] = useState(false);
  const isEdit = !!existing;

  const pickPhoto = async () => {
    if (photoUrls.length >= MAX_SYMPTOM_PHOTOS) {
      toast.info(`Máximo ${MAX_SYMPTOM_PHOTOS} fotos por registro`);
      return;
    }
    if (!session?.user.id) {
      toast.error('Faça login pra adicionar foto');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error('Permissão negada', 'Libere o acesso à galeria pra anexar foto');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.75,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const ext = guessExtension(asset.uri, 'jpg');
      const url = await uploadToBucket('pet-symptoms', session.user.id, asset.uri, ext);
      setPhotoUrls((prev) => [...prev, url]);
    } catch (e) {
      toast.error('Erro no upload', e instanceof Error ? e.message : '');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url: string) => {
    setPhotoUrls((prev) => prev.filter((u) => u !== url));
    // Best-effort delete do storage (não bloqueia se falhar — RLS pode rejeitar
    // se a foto já foi salva e o user tentou remover via edição).
    deleteFromBucket('pet-symptoms', url).catch(() => undefined);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        description: description.trim(),
        severity,
        body_part: bodyPart.trim() || null,
        notes: notes.trim() || null,
        flagged_for_vet: flaggedForVet,
        photo_urls: photoUrls.length > 0 ? photoUrls : null,
      };
      if (existing) {
        await updatePetSymptom(existing.id, payload);
      } else {
        await createPetSymptom({
          pet_id: petId,
          description: payload.description,
          severity: payload.severity,
          body_part: payload.body_part ?? undefined,
          notes: payload.notes ?? undefined,
          flagged_for_vet: payload.flagged_for_vet,
          photo_urls: payload.photo_urls ?? undefined,
        });
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Sintoma atualizado' : 'Sintoma registrado');
      onSaved();
    },
    onError: () => toast.error('Não foi possível salvar'),
  });

  const valid = description.trim().length >= 3;

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 14,
        gap: 12,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>
        {isEdit ? 'Editar sintoma' : 'Registrar sintoma'}
      </Text>

      {/* Descrição */}
      <View>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 12,
            color: theme.textDim,
            marginBottom: 4,
          }}
        >
          O que você percebeu? *
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="ex: Está se coçando muito atrás da orelha esquerda"
          placeholderTextColor={theme.textDim}
          multiline
          style={{
            backgroundColor: theme.borderLight,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontFamily: FONTS.body,
            fontSize: 14,
            color: theme.text,
            minHeight: 80,
            textAlignVertical: 'top',
          }}
        />
      </View>

      {/* Severidade */}
      <View>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 12,
            color: theme.textDim,
            marginBottom: 6,
          }}
        >
          Severidade percebida
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const meta = SEVERITY_META[n];
            const active = severity === n;
            return (
              <Pressable
                key={n}
                onPress={() => setSeverity(n)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: active ? meta.bg : theme.borderLight,
                  borderWidth: active ? 2 : 0,
                  borderColor: meta.color,
                }}
              >
                <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 10,
                    color: active ? meta.color : theme.textDim,
                    marginTop: 2,
                  }}
                >
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 11,
            color: theme.textDim,
            marginTop: 4,
            fontStyle: 'italic',
          }}
        >
          Sua percepção — não classificação clínica.
        </Text>
      </View>

      {/* Body part */}
      <View>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 12,
            color: theme.textDim,
            marginBottom: 6,
          }}
        >
          Parte do corpo (opcional)
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {BODY_PART_CHIPS.map((part) => {
            const active = bodyPart === part;
            return (
              <Pressable
                key={part}
                onPress={() => setBodyPart(active ? '' : part)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: active ? theme.brand : theme.borderLight,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 11,
                    color: active ? '#FFFFFF' : theme.textDim,
                  }}
                >
                  {part}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={bodyPart}
          onChangeText={setBodyPart}
          placeholder="Ou descreva..."
          placeholderTextColor={theme.textDim}
          style={{
            backgroundColor: theme.borderLight,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            fontFamily: FONTS.body,
            fontSize: 13,
            color: theme.text,
          }}
        />
      </View>

      {/* Fotos */}
      <View>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 12,
            color: theme.textDim,
            marginBottom: 6,
          }}
        >
          Fotos (opcional, até {MAX_SYMPTOM_PHOTOS})
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {photoUrls.map((url) => (
            <View key={url} style={{ position: 'relative' }}>
              <Image
                source={{ uri: url }}
                style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: theme.borderLight }}
              />
              <Pressable
                onPress={() => removePhoto(url)}
                hitSlop={8}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  backgroundColor: '#1A1410',
                  borderRadius: 999,
                  width: 22,
                  height: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
          {photoUrls.length < MAX_SYMPTOM_PHOTOS ? (
            <Pressable
              onPress={pickPhoto}
              disabled={uploading}
              style={{
                width: 72,
                height: 72,
                borderRadius: 10,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: theme.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: uploading ? 0.5 : 1,
              }}
            >
              <Ionicons
                name={uploading ? 'cloud-upload-outline' : 'camera-outline'}
                size={22}
                color={theme.textDim}
              />
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 9,
                  color: theme.textDim,
                  marginTop: 2,
                }}
              >
                {uploading ? 'Enviando' : '+ Foto'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Notas */}
      <View>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 12,
            color: theme.textDim,
            marginBottom: 4,
          }}
        >
          Contexto adicional (opcional)
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="ex: Começou ontem à noite, comeu ração nova"
          placeholderTextColor={theme.textDim}
          multiline
          style={{
            backgroundColor: theme.borderLight,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontFamily: FONTS.body,
            fontSize: 14,
            color: theme.text,
            minHeight: 60,
            textAlignVertical: 'top',
          }}
        />
      </View>

      {/* Flag pra vet */}
      <Pressable
        onPress={() => setFlaggedForVet((f) => !f)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 10,
          borderRadius: 10,
          backgroundColor: flaggedForVet ? '#FECACA' : theme.borderLight,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            backgroundColor: flaggedForVet ? '#7F1D1D' : '#FFFFFF',
            borderWidth: 1,
            borderColor: flaggedForVet ? '#7F1D1D' : theme.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {flaggedForVet ? (
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 13,
              color: flaggedForVet ? '#7F1D1D' : theme.text,
            }}
          >
            🩺 Levar pro veterinário
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: flaggedForVet ? '#991B1B' : theme.textDim,
              marginTop: 2,
            }}
          >
            Marca pra lembrar de mostrar na próxima consulta
          </Text>
        </View>
      </Pressable>

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancelar" variant="secondary" onPress={onCancel} fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={isEdit ? 'Salvar alterações' : 'Salvar'}
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

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function groupByDay(symptoms: PetSymptom[]): { day: string; items: PetSymptom[] }[] {
  const map = new Map<string, PetSymptom[]>();
  for (const s of symptoms) {
    const day = format(parseISO(s.recorded_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(s);
  }
  return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
}
