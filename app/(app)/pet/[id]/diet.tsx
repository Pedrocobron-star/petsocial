import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { HealthListSkeleton } from '@/components/health/health-list-skeleton';
import { usePetHealthGate } from '@/components/pet-health-gate';
import { Button } from '@/components/ui/button';
import {
  brandsForSpecies,
  FOOD_TYPE_META,
  monthlyDietCost,
  type DietBrand,
} from '@/lib/diet-brands';
import { FONTS } from '@/lib/fonts';
import {
  createDietLog,
  deleteDietLog,
  fetchActiveDiet,
  fetchDietHistory,
  fetchPet,
  qk,
  updateDietLog,
} from '@/lib/queries';
import type { DietFoodType, PetDietLog } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const FOOD_TYPE_OPTIONS: DietFoodType[] = [
  'dry_food',
  'wet_food',
  'natural',
  'mixed',
  'puppy',
  'senior',
  'special',
];

export default function DietScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const healthGate = usePetHealthGate(id);
  const { theme } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  // dieta sendo editada (null = nova dieta a partir de "Mudar dieta")
  const [editing, setEditing] = useState<PetDietLog | null>(null);

  const petQuery = useQuery({ queryKey: qk.pet(id), queryFn: () => fetchPet(id), enabled: !!id });
  const activeQuery = useQuery({
    queryKey: qk.petDietActive(id),
    queryFn: () => fetchActiveDiet(id),
    enabled: !!id,
  });
  const historyQuery = useQuery({
    queryKey: qk.petDietHistory(id),
    queryFn: () => fetchDietHistory(id, 20),
    enabled: !!id,
  });

  const deleteMut = useMutation({
    mutationFn: (dietId: string) => deleteDietLog(dietId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pet-diet-active', id] });
      qc.invalidateQueries({ queryKey: ['pet-diet-history', id] });
      toast.success('Registro removido');
    },
  });

  const active = activeQuery.data;
  const history = historyQuery.data ?? [];
  const past = history.filter((h) => !h.active);
  const isLoading = activeQuery.isLoading || historyQuery.isLoading;

  if (healthGate) return healthGate;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: petQuery.data ? `Dieta — ${petQuery.data.name}` : 'Dieta' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {/* Form (visível só quando aberto) */}
        {showForm ? (
          <DietForm
            petId={id}
            species={petQuery.data?.species ?? 'dog'}
            existing={editing}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSaved={() => {
              setShowForm(false);
              setEditing(null);
              qc.invalidateQueries({ queryKey: ['pet-diet-active', id] });
              qc.invalidateQueries({ queryKey: ['pet-diet-history', id] });
            }}
          />
        ) : null}

        {/* Skeleton */}
        {!showForm && isLoading ? <HealthListSkeleton withHeader count={2} /> : null}

        {/* Dieta atual */}
        {!showForm && !isLoading ? (
          active ? (
            <ActiveDietCard
              diet={active}
              petName={petQuery.data?.name ?? 'seu pet'}
              onEdit={() => {
                setEditing(active);
                setShowForm(true);
              }}
              onChange={() => {
                setEditing(null);
                setShowForm(true);
              }}
              onDelete={() =>
                Alert.alert('Apagar registro?', 'Esta dieta será removida do histórico.', [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Apagar',
                    style: 'destructive',
                    onPress: () => deleteMut.mutate(active.id),
                  },
                ])
              }
            />
          ) : (
            <EmptyState
              emoji="🥣"
              title="Sem dieta registrada"
              description="Anote qual ração seu pet come hoje pra acompanhar custo mensal e mudanças ao longo do tempo."
              action={<Button title="Registrar dieta atual" onPress={() => setShowForm(true)} />}
            />
          )
        ) : null}

        {/* Histórico */}
        {!showForm && past.length > 0 ? (
          <>
            <SectionTitle title={`Dietas anteriores (${past.length})`} />
            {past.map((d) => (
              <HistoryRow
                key={d.id}
                diet={d}
                onDelete={() =>
                  Alert.alert('Apagar registro?', 'Esta dieta será removida do histórico.', [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Apagar',
                      style: 'destructive',
                      onPress: () => deleteMut.mutate(d.id),
                    },
                  ])
                }
              />
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Active Diet Card
// ----------------------------------------------------------------------------

function ActiveDietCard({
  diet,
  petName,
  onEdit,
  onChange,
  onDelete,
}: {
  diet: PetDietLog;
  petName: string;
  onEdit: () => void;
  onChange: () => void;
  onDelete: () => void;
}) {
  const { theme } = useTheme();
  const meta = FOOD_TYPE_META[diet.food_type];
  const monthlyCost = monthlyDietCost({
    daily_amount_g: diet.daily_amount_g,
    package_size_g: diet.package_size_g,
    package_cost_brl: diet.package_cost_brl,
  });
  const days = Math.floor((Date.now() - parseISO(diet.started_at).getTime()) / 86400000);

  return (
    <View
      style={{
        backgroundColor: '#FFF7ED',
        borderRadius: 18,
        padding: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: '#FED7AA',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: '#F97316',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: '#9A3412',
            }}
          >
            Dieta atual
          </Text>
          <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#1A1410', marginTop: 2 }}>
            {diet.brand}
          </Text>
          {diet.product_name ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#525252' }}>
              {diet.product_name}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Chip label={meta.label} />
        {diet.daily_amount_g ? <Chip label={`${diet.daily_amount_g}g/dia`} /> : null}
        {diet.daily_servings > 1 ? <Chip label={`${diet.daily_servings}× ao dia`} /> : null}
        <Chip label={`há ${days} ${days === 1 ? 'dia' : 'dias'}`} />
      </View>

      {monthlyCost != null ? (
        <View
          style={{
            backgroundColor: '#FFFFFF',
            padding: 12,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 22 }}>💰</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 10,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: theme.textDim,
              }}
            >
              Custo estimado
            </Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#16A34A' }}>
              R$ {monthlyCost.toFixed(2).replace('.', ',')}
              <Text style={{ fontSize: 13, color: theme.textDim, fontFamily: FONTS.body }}>
                {' '}
                /mês
              </Text>
            </Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 11,
                color: theme.textDim,
                marginTop: 2,
              }}
            >
              R$ {((monthlyCost * 12) / 1).toFixed(2).replace('.', ',')}/ano cuidando do {petName}
            </Text>
          </View>
        </View>
      ) : (
        <View
          style={{
            backgroundColor: '#FFFFFF',
            padding: 10,
            borderRadius: 10,
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 14 }}>ℹ️</Text>
          <Text
            style={{
              flex: 1,
              fontFamily: FONTS.body,
              fontSize: 12,
              color: theme.textDim,
              lineHeight: 16,
            }}
          >
            Preencha gramas/dia + tamanho/preço do pacote pra ver o custo mensal estimado.
          </Text>
        </View>
      )}

      {diet.notes ? (
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 12,
            color: theme.textDim,
            fontStyle: 'italic',
            paddingHorizontal: 4,
          }}
        >
          {diet.notes}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title="Editar" variant="secondary" onPress={onEdit} fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Mudar dieta" variant="secondary" onPress={onChange} fullWidth />
        </View>
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
          }}
        >
          <Ionicons name="trash-outline" size={18} color="#9F1239" />
        </Pressable>
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// History
// ----------------------------------------------------------------------------

function HistoryRow({ diet, onDelete }: { diet: PetDietLog; onDelete: () => void }) {
  const { theme } = useTheme();
  const meta = FOOD_TYPE_META[diet.food_type];
  const monthlyCost = monthlyDietCost({
    daily_amount_g: diet.daily_amount_g,
    package_size_g: diet.package_size_g,
    package_cost_brl: diet.package_cost_brl,
  });
  const period =
    diet.started_at && diet.ended_at
      ? `${format(parseISO(diet.started_at), 'd MMM', { locale: ptBR })} → ${format(
          parseISO(diet.ended_at),
          'd MMM',
          { locale: ptBR },
        )}`
      : format(parseISO(diet.started_at), 'd MMM yyyy', { locale: ptBR });

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: 0.8,
      }}
    >
      <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
          {diet.brand}
          {diet.product_name ? ` · ${diet.product_name}` : ''}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
          {period}
          {monthlyCost != null ? ` · R$ ${monthlyCost.toFixed(2).replace('.', ',')}/mês` : ''}
        </Text>
      </View>
      <Pressable onPress={onDelete} hitSlop={6} style={{ padding: 4 }}>
        <Ionicons name="trash-outline" size={16} color={theme.textDim} />
      </Pressable>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        fontFamily: FONTS.bodyBold,
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: theme.brand,
        marginTop: 12,
      }}
    >
      {title}
    </Text>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
      }}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#9A3412' }}>{label}</Text>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Form
// ----------------------------------------------------------------------------

function DietForm({
  petId,
  species,
  existing,
  onCancel,
  onSaved,
}: {
  petId: string;
  species: string;
  existing?: PetDietLog | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { theme } = useTheme();
  const toast = useToast();
  const brands = brandsForSpecies(species);
  const [foodType, setFoodType] = useState<DietFoodType>(existing?.food_type ?? 'dry_food');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [productName, setProductName] = useState(existing?.product_name ?? '');
  const [dailyAmount, setDailyAmount] = useState(existing?.daily_amount_g?.toString() ?? '');
  const [servings, setServings] = useState(existing?.daily_servings?.toString() ?? '2');
  const [packageSize, setPackageSize] = useState(existing?.package_size_g?.toString() ?? '');
  const [packageCost, setPackageCost] = useState(
    existing?.package_cost_brl?.toString().replace('.', ',') ?? '',
  );
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        food_type: foodType,
        brand: brand.trim(),
        product_name: productName.trim() || null,
        daily_amount_g: dailyAmount ? Number(dailyAmount) : null,
        daily_servings: servings ? Number(servings) : 2,
        package_size_g: packageSize ? Number(packageSize) : null,
        package_cost_brl: packageCost ? Number(packageCost.replace(',', '.')) : null,
        notes: notes.trim() || null,
      };
      if (existing) {
        await updateDietLog(existing.id, payload);
      } else {
        await createDietLog({ pet_id: petId, ...payload });
      }
    },
    onSuccess: () => {
      toast.success(existing ? 'Dieta atualizada' : 'Dieta registrada');
      onSaved();
    },
    onError: () => toast.error('Não foi possível salvar'),
  });

  const livePreview = monthlyDietCost({
    daily_amount_g: dailyAmount ? Number(dailyAmount) : null,
    package_size_g: packageSize ? Number(packageSize) : null,
    package_cost_brl: packageCost ? Number(packageCost.replace(',', '.')) : null,
  });

  const valid = brand.trim().length > 1;

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 14,
        gap: 14,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>
        {existing ? 'Editar dieta' : 'Registrar dieta atual'}
      </Text>

      {/* Food type */}
      <View>
        <Label text="Tipo" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {FOOD_TYPE_OPTIONS.map((t) => {
            const meta = FOOD_TYPE_META[t];
            const active = foodType === t;
            return (
              <Pressable
                key={t}
                onPress={() => setFoodType(t)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: active ? '#F97316' : theme.borderLight,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 12 }}>{meta.emoji}</Text>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 11,
                    color: active ? '#FFFFFF' : theme.textDim,
                  }}
                >
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Brand chips */}
      {brands.length > 0 ? (
        <View>
          <Label text="Marca (toque pra escolher ou digite)" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {brands.map((b) => (
              <BrandChip key={b.name} brand={b} active={brand === b.name} onPress={() => setBrand(b.name)} />
            ))}
          </View>
        </View>
      ) : null}

      <Field value={brand} onChange={setBrand} placeholder="Ex: Royal Canin, Premier..." />

      <View>
        <Label text="Produto / linha (opcional)" />
        <Field value={productName} onChange={setProductName} placeholder="Ex: Adulto Mini, Mini Castrado" />
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Label text="Gramas/dia" />
          <Field value={dailyAmount} onChange={setDailyAmount} placeholder="150" keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Label text="Refeições/dia" />
          <Field value={servings} onChange={setServings} placeholder="2" keyboardType="numeric" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Label text="Pacote (g)" />
          <Field value={packageSize} onChange={setPackageSize} placeholder="3000" keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Label text="Preço (R$)" />
          <Field value={packageCost} onChange={setPackageCost} placeholder="89,90" keyboardType="numeric" />
        </View>
      </View>

      {livePreview != null ? (
        <View
          style={{
            backgroundColor: '#DCFCE7',
            padding: 10,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 14 }}>💰</Text>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#166534' }}>
            Custo estimado: R$ {livePreview.toFixed(2).replace('.', ',')}/mês
          </Text>
        </View>
      ) : null}

      <View>
        <Label text="Notas (opcional)" />
        <Field
          value={notes}
          onChange={setNotes}
          placeholder="Ex: troca por causa de alergia"
          multiline
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancelar" variant="secondary" onPress={onCancel} fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Salvar"
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

function BrandChip({
  brand,
  active,
  onPress,
}: {
  brand: DietBrand;
  active: boolean;
  onPress: () => void;
}) {
  const tierMeta = {
    super_premium: { bg: '#FED7AA', color: '#9A3412', label: '⭐' },
    premium: { bg: '#DBEAFE', color: '#1E40AF', label: '◆' },
    standard: { bg: '#F1F5F9', color: '#475569', label: '' },
  }[brand.tier];

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? '#F97316' : tierMeta.bg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {tierMeta.label ? (
        <Text style={{ fontSize: 9, color: active ? '#FFFFFF' : tierMeta.color }}>
          {tierMeta.label}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: 'Inter_600SemiBold',
          fontSize: 11,
          color: active ? '#FFFFFF' : tierMeta.color,
        }}
      >
        {brand.name}
      </Text>
    </Pressable>
  );
}

function Label({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        fontFamily: FONTS.bodyBold,
        fontSize: 12,
        color: theme.textDim,
        marginBottom: 4,
      }}
    >
      {text}
    </Text>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
}) {
  const { theme } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={theme.textDim}
      multiline={multiline}
      keyboardType={keyboardType}
      style={{
        backgroundColor: theme.borderLight,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontFamily: FONTS.body,
        fontSize: 14,
        color: theme.text,
        minHeight: multiline ? 50 : undefined,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
    />
  );
}
