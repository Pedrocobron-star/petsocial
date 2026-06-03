import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ParasiteProductPicker } from '@/components/parasite-product-picker';
import { ParasiteTreatmentCard } from '@/components/parasite-treatment-card';
import { Button } from '@/components/ui/button';
import { CenteredColumn } from '@/components/ui/centered-column';
import { DateTimePickerInput } from '@/components/ui/datetime-picker';
import { Input } from '@/components/ui/input';
import { PressScale } from '@/components/ui/press-scale';
import { TextArea } from '@/components/ui/text-area';
import { FONTS } from '@/lib/fonts';
import {
  formatInterval,
  KIND_EMOJI,
  KIND_LABEL,
  type ParasiteKind,
  type ParasiteProduct,
} from '@/lib/parasite-products';
import { HealthListSkeleton } from '@/components/health/health-list-skeleton';
import {
  cancelParasiteReminders,
  scheduleParasiteReminders,
} from '@/lib/health-notifications';
import {
  addParasiteTreatment,
  deleteParasiteTreatment,
  fetchParasiteSummary,
  fetchParasiteTreatments,
  fetchPet,
  qk,
  updateParasiteTreatment,
} from '@/lib/queries';
import type { ParasiteTreatment } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

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

interface FormPrefill {
  kind: ParasiteKind;
  product_name: string;
  product_slug: string | null;
  interval_days: number | null;
}

export default function ParasitesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });
  const listQuery = useQuery({
    queryKey: qk.parasiteTreatments(id),
    queryFn: () => fetchParasiteTreatments(id),
    enabled: !!id,
  });
  const summaryQuery = useQuery({
    queryKey: qk.parasiteSummary(id),
    queryFn: () => fetchParasiteSummary(id),
    enabled: !!id,
  });

  const isOwner = petQuery.data?.owner_id === session?.user.id;

  // Ordena: atrasados primeiro, depois próximos do vencimento, depois normais, depois sem due
  const ordered = useMemo(() => {
    const list = listQuery.data ?? [];
    const today = Date.now();
    return [...list].sort((a, b) => {
      const aDue = a.next_due_at ? parseISO(a.next_due_at).getTime() : Infinity;
      const bDue = b.next_due_at ? parseISO(b.next_due_at).getTime() : Infinity;
      // Atrasados vão pro topo, depois ordem cronológica crescente
      const aOverdue = aDue < today ? -1 : 0;
      const bOverdue = bDue < today ? -1 : 0;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return aDue - bDue;
    });
  }, [listQuery.data]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState<FormPrefill | null>(null);
  const [editing, setEditing] = useState<ParasiteTreatment | null>(null);

  const openNewWithProduct = (product: ParasiteProduct) => {
    setEditing(null);
    setPrefill({
      kind: product.kind,
      product_name: product.brand,
      product_slug: product.slug,
      interval_days: product.interval_days,
    });
    setFormOpen(true);
  };

  const openNewCustom = () => {
    setEditing(null);
    setPrefill({
      kind: 'internal',
      product_name: '',
      product_slug: null,
      interval_days: null,
    });
    setFormOpen(true);
  };

  const openRenew = (t: ParasiteTreatment) => {
    // Aplicar de novo: reaproveita produto + kind + intervalo, mas com nova data
    setEditing(null);
    setPrefill({
      kind: t.kind,
      product_name: t.product_name,
      product_slug: t.product_slug,
      interval_days: t.interval_days,
    });
    setFormOpen(true);
  };

  const openEdit = (t: ParasiteTreatment) => {
    setEditing(t);
    setPrefill({
      kind: t.kind,
      product_name: t.product_name,
      product_slug: t.product_slug,
      interval_days: t.interval_days,
    });
    setFormOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (tid: string) => {
      await deleteParasiteTreatment(tid);
      await cancelParasiteReminders(tid);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.parasiteTreatments(id) });
      qc.invalidateQueries({ queryKey: qk.parasiteSummary(id) });
      toast.success('Removido');
    },
    onError: (e) => toast.error('Erro', e instanceof Error ? e.message : ''),
  });

  const confirmDelete = (t: ParasiteTreatment) => {
    Alert.alert('Excluir registro?', `Remover ${t.product_name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(t.id),
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: petQuery.data ? `Antiparasitários · ${petQuery.data.name}` : 'Antiparasitários',
        }}
      />

      <FlatList
        data={ordered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: 32, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <CenteredColumn maxWidth={540}>
            <Pressable
              onLongPress={() =>
                isOwner
                  ? Alert.alert('Ações', item.product_name, [
                      { text: 'Editar', onPress: () => openEdit(item) },
                      {
                        text: 'Excluir',
                        style: 'destructive',
                        onPress: () => confirmDelete(item),
                      },
                      { text: 'Cancelar', style: 'cancel' },
                    ])
                  : undefined
              }
            >
              <ParasiteTreatmentCard
                treatment={item}
                onPress={() => (isOwner ? openEdit(item) : undefined)}
                showRenew={isOwner}
                onRenew={() => openRenew(item)}
              />
            </Pressable>
          </CenteredColumn>
        )}
        ListHeaderComponent={
          <View>
            {/* Summary banner */}
            {summaryQuery.data && summaryQuery.data.total > 0 ? (
              <CenteredColumn maxWidth={540}>
                <SummaryBanner
                  summary={summaryQuery.data}
                  petName={petQuery.data?.name ?? 'seu pet'}
                />
              </CenteredColumn>
            ) : null}

            {/* CTA novo registro */}
            {isOwner ? (
              <CenteredColumn maxWidth={540}>
                <View style={{ marginTop: 12, marginBottom: 12 }}>
                  <PressScale
                    onPress={() => setPickerOpen(true)}
                    style={{
                      backgroundColor: theme.brand,
                      paddingVertical: 12,
                      borderRadius: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons name="add-circle" size={18} color="#fff" />
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
                      Registrar aplicação
                    </Text>
                  </PressScale>
                </View>
              </CenteredColumn>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          listQuery.isLoading ? (
            <HealthListSkeleton count={3} />
          ) : (
            <EmptyState
              emoji="💊"
              title="Nenhum tratamento ainda"
              description={
                isOwner
                  ? 'Bravecto, NexGard, Simparic, Seresto, Drontal, Vermivet... os intervalos já vêm prontos!'
                  : 'O tutor ainda não cadastrou antiparasitários.'
              }
              action={
                isOwner ? (
                  <Button
                    title="Registrar primeira aplicação"
                    onPress={() => setPickerOpen(true)}
                  />
                ) : undefined
              }
            />
          )
        }
      />

      {/* Picker de produto */}
      <ParasiteProductPicker
        visible={pickerOpen}
        species={petQuery.data?.species ?? 'dog'}
        onClose={() => setPickerOpen(false)}
        onSelect={openNewWithProduct}
        onCustom={openNewCustom}
      />

      {/* Form modal */}
      {prefill ? (
        <TreatmentForm
          visible={formOpen}
          onClose={() => setFormOpen(false)}
          petId={id}
          petName={petQuery.data?.name ?? ''}
          prefill={prefill}
          existing={editing}
          onSaved={() => {
            setFormOpen(false);
            setEditing(null);
            setPrefill(null);
            qc.invalidateQueries({ queryKey: qk.parasiteTreatments(id) });
            qc.invalidateQueries({ queryKey: qk.parasiteSummary(id) });
            toast.success('Registrado!', 'Vamos te lembrar quando vencer 🔔');
          }}
        />
      ) : null}
    </View>
  );
}

function SummaryBanner({
  summary,
  petName,
}: {
  summary: {
    total: number;
    overdue: number;
    due_soon: number;
    next_due: { product_name: string; due_at: string; days_until: number } | null;
  };
  petName: string;
}) {
  const { theme } = useTheme();
  const hasIssue = summary.overdue > 0 || summary.due_soon > 0;

  if (!summary.next_due) {
    return (
      <View
        style={{
          backgroundColor: theme.brandSurface,
          borderRadius: 16,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginTop: 12,
          borderWidth: 1,
          borderColor: theme.brandLight,
        }}
      >
        <Text style={{ fontSize: 28 }}>📋</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.brandDark }}>
            {summary.total} {summary.total === 1 ? 'registro' : 'registros'} sem reaplicação
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.brandDark, opacity: 0.75 }}>
            Histórico do {petName}
          </Text>
        </View>
      </View>
    );
  }

  if (hasIssue) {
    const isOverdue = summary.next_due.days_until < 0;
    return (
      <View
        style={{
          backgroundColor: isOverdue ? '#FEE2E2' : '#FEF3C7',
          borderRadius: 16,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginTop: 12,
          borderWidth: 1,
          borderColor: isOverdue ? '#FCA5A5' : '#FCD34D',
        }}
      >
        <Text style={{ fontSize: 28 }}>{isOverdue ? '⚠️' : '⏰'}</Text>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 14,
              color: isOverdue ? '#991B1B' : '#92400E',
            }}
          >
            {isOverdue
              ? `${summary.next_due.product_name} atrasado ${Math.abs(summary.next_due.days_until)}d`
              : summary.next_due.days_until === 0
              ? `${summary.next_due.product_name} vence hoje!`
              : `${summary.next_due.product_name} vence em ${summary.next_due.days_until}d`}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 12,
              color: isOverdue ? '#991B1B' : '#92400E',
              opacity: 0.75,
            }}
          >
            {format(parseISO(summary.next_due.due_at), "EEEE, d 'de' MMM", { locale: ptBR })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: '#DCFCE7',
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#86EFAC',
      }}
    >
      <Text style={{ fontSize: 28 }}>✅</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#166534' }}>
          {petName} tá em dia!
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#166534', opacity: 0.75 }}>
          Próximo: {summary.next_due.product_name} em {summary.next_due.days_until}d
        </Text>
      </View>
    </View>
  );
}

const KIND_OPTIONS: ParasiteKind[] = ['internal', 'external', 'heartworm', 'combined'];

function TreatmentForm({
  visible,
  onClose,
  petId,
  petName,
  prefill,
  existing,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  petId: string;
  petName: string;
  prefill: FormPrefill;
  existing: ParasiteTreatment | null;
  onSaved: () => void;
}) {
  const { theme } = useTheme();
  const [kind, setKind] = useState<ParasiteKind>(prefill.kind);
  const [productName, setProductName] = useState(prefill.product_name);
  const [productSlug, setProductSlug] = useState<string | null>(prefill.product_slug);
  const [applied, setApplied] = useState<Date | null>(toDate(existing?.applied_at) ?? new Date());
  const [intervalDays, setIntervalDays] = useState<string>(
    existing?.interval_days?.toString() ?? prefill.interval_days?.toString() ?? '',
  );
  const [vet, setVet] = useState(existing?.vet_name ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  // Reset quando prefill ou existing mudam
  useEffect(() => {
    setKind(prefill.kind);
    setProductName(prefill.product_name);
    setProductSlug(prefill.product_slug);
    setApplied(toDate(existing?.applied_at) ?? new Date());
    setIntervalDays(
      existing?.interval_days?.toString() ?? prefill.interval_days?.toString() ?? '',
    );
    setVet(existing?.vet_name ?? '');
    setNotes(existing?.notes ?? '');
  }, [prefill, existing]);

  // Calcula next_due_at automaticamente
  const nextDueAt = useMemo(() => {
    if (!applied || !intervalDays) return null;
    const days = parseInt(intervalDays, 10);
    if (Number.isNaN(days) || days <= 0) return null;
    return addDays(applied, days);
  }, [applied, intervalDays]);

  const handleSubmit = async () => {
    if (!productName.trim() || !applied) {
      Alert.alert('Faltam dados', 'Informe o produto e a data de aplicação.');
      return;
    }
    const days = intervalDays ? parseInt(intervalDays, 10) : null;
    setSubmitting(true);
    try {
      const isoNext = nextDueAt ? toISODate(nextDueAt) : null;
      let savedId: string | null = existing?.id ?? null;
      if (existing) {
        await updateParasiteTreatment(existing.id, {
          kind,
          product_name: productName.trim(),
          product_slug: productSlug,
          applied_at: toISODate(applied)!,
          next_due_at: isoNext,
          interval_days: days,
          vet_name: vet.trim() || null,
          notes: notes.trim() || null,
        });
      } else {
        const created = await addParasiteTreatment({
          pet_id: petId,
          kind,
          product_name: productName.trim(),
          product_slug: productSlug,
          applied_at: toISODate(applied)!,
          next_due_at: isoNext,
          interval_days: days,
          vet_name: vet.trim() || null,
          notes: notes.trim() || null,
        });
        savedId = created?.id ?? null;
      }
      // Agenda lembretes locais — best-effort, não bloqueia save
      if (savedId && petName) {
        scheduleParasiteReminders({
          treatmentId: savedId,
          petId,
          petName,
          productName: productName.trim(),
          nextDueAt: isoNext,
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
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 32,
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
              {existing ? 'Editar registro' : 'Nova aplicação'}
            </Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.textDim} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            {/* Kind selector */}
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
                  const active = kind === k;
                  return (
                    <PressScale
                      key={k}
                      onPress={() => setKind(k)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 999,
                        backgroundColor: active ? theme.brand : theme.borderLight,
                      }}
                    >
                      <Text style={{ fontSize: 12 }}>{KIND_EMOJI[k]}</Text>
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 12,
                          color: active ? '#fff' : theme.textMuted,
                        }}
                      >
                        {KIND_LABEL[k]}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
            </View>

            <Input
              label="Produto"
              value={productName}
              onChangeText={(v) => {
                setProductName(v);
                // Se editou manualmente, perde o link com o catálogo
                if (productSlug && v !== prefill.product_name) setProductSlug(null);
              }}
              placeholder="Bravecto, NexGard, etc"
            />

            <DateTimePickerInput
              label="Data da aplicação"
              value={applied}
              onChange={setApplied}
            />

            <View>
              <Input
                label="Intervalo de reaplicação (dias)"
                value={intervalDays}
                onChangeText={setIntervalDays}
                keyboardType="number-pad"
                placeholder="30, 90, 240..."
              />
              {intervalDays && parseInt(intervalDays, 10) > 0 ? (
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 11,
                    color: theme.textDim,
                    marginTop: 4,
                    marginLeft: 4,
                  }}
                >
                  = {formatInterval(parseInt(intervalDays, 10))}
                  {nextDueAt
                    ? ` · próxima dose em ${format(nextDueAt, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`
                    : ''}
                </Text>
              ) : null}
            </View>

            <Input
              label="Veterinário (opcional)"
              value={vet}
              onChangeText={setVet}
              placeholder="Dr. Roberto"
            />

            <TextArea
              label="Notas (opcional)"
              value={notes}
              onChangeText={setNotes}
              rows={2}
              placeholder="Lote, peso na dose, reações..."
            />

            <View style={{ marginTop: 8 }}>
              <Button
                title={existing ? 'Salvar alterações' : 'Registrar aplicação'}
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
