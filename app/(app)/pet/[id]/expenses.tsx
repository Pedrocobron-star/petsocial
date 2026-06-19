import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/empty-state';
import { PaywallCard } from '@/components/paywall-card';
import { usePetHealthGate } from '@/components/pet-health-gate';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PressScale } from '@/components/ui/press-scale';
import {
  createExpense,
  deleteExpense,
  EXPENSE_CATEGORIES,
  expenseCategoryMeta,
  fetchExpenses,
  formatBRL,
  PERIOD_LABEL,
  summarizeExpenses,
  type ExpenseCategory,
  type ExpensePeriod,
  type PetExpense,
} from '@/lib/expenses';
import { FONTS } from '@/lib/fonts';
import { fetchPet, qk } from '@/lib/queries';
import { useSession } from '@/providers/session-provider';
import { useIsPro } from '@/providers/subscription-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

function todayBr(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function parseBrDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  if (Number.isNaN(new Date(iso + 'T00:00:00').getTime())) return null;
  return iso;
}
function parseAmount(s: string): number {
  const cleaned = s.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

const PERIODS: ExpensePeriod[] = ['month', '3m', 'year', 'all'];

export default function PetExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const healthGate = usePetHealthGate(id);
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  const isPro = useIsPro();

  const [period, setPeriod] = useState<ExpensePeriod>('month');
  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('racao');
  const [description, setDescription] = useState('');
  const [dateBr, setDateBr] = useState(todayBr());
  const [saving, setSaving] = useState(false);

  const petQuery = useQuery({ queryKey: qk.pet(id), queryFn: () => fetchPet(id), enabled: !!id });
  const expensesQuery = useQuery({
    queryKey: ['pet-expenses', id],
    queryFn: () => fetchExpenses(id),
    enabled: !!id,
  });
  const expenses = expensesQuery.data ?? [];

  const summary = useMemo(
    () => summarizeExpenses(expenses, period, new Date()),
    [expenses, period],
  );

  const resetForm = () => {
    setFormOpen(false);
    setAmount('');
    setCategory('racao');
    setDescription('');
    setDateBr(todayBr());
  };

  const onSave = async () => {
    if (!userId) return;
    const value = parseAmount(amount);
    if (value <= 0) {
      toast.error('Valor inválido', 'Quanto custou? Ex: 89,90');
      return;
    }
    setSaving(true);
    try {
      await createExpense({
        petId: id,
        ownerId: userId,
        category,
        amount: value,
        description: description.trim() || null,
        spentOn: parseBrDate(dateBr),
      });
      await qc.invalidateQueries({ queryKey: ['pet-expenses', id] });
      toast.success('Gasto registrado', formatBRL(value));
      resetForm();
    } catch (e) {
      toast.error('Erro ao salvar', e instanceof Error ? e.message : '');
    } finally {
      setSaving(false);
    }
  };

  const deleteMut = useMutation({
    mutationFn: (eid: string) => deleteExpense(eid),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['pet-expenses', id] });
      toast.success('Gasto removido');
    },
  });

  const maxCat = summary.byCategory[0]?.total ?? 1;
  const pet = petQuery.data;

  if (healthGate) return healthGate;

  // Controle de gastos é exclusivo do Pet Pro (registrar saúde continua grátis).
  if (!isPro) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Stack.Screen options={{ title: pet ? `Gastos · ${pet.name}` : 'Gastos', headerShown: true }} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 24 }}>
          <CenteredColumn maxWidth={560}>
            <PaywallCard
              intent="health-expenses"
              emoji="💸"
              title="Controle de gastos do pet"
              description="Acompanhe quanto você investe no seu pet (ração, vet, banho e mais) com resumo por categoria e período. Exclusivo do Pet Pro."
            />
          </CenteredColumn>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: pet ? `Gastos · ${pet.name}` : 'Gastos',
          headerShown: true,
          headerRight: () => (
            <Pressable onPress={() => setFormOpen(true)} hitSlop={8} style={{ paddingHorizontal: 12 }}>
              <Ionicons name="add-circle" size={22} color={theme.brand} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <CenteredColumn maxWidth={560}>
          {/* Período */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
            {PERIODS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: period === p ? '#1A1410' : theme.borderLight,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: period === p ? '#fff' : theme.textDim }}>
                  {PERIOD_LABEL[p]}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Total */}
          <View
            style={{
              backgroundColor: '#1A1410',
              borderRadius: 18,
              padding: 18,
              marginBottom: 14,
              overflow: 'hidden',
            }}
          >
            <Text style={{ position: 'absolute', right: -4, bottom: -10, fontSize: 68, opacity: 0.07 }}>💰</Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#A3A3A3', letterSpacing: 1, textTransform: 'uppercase' }}>
              {PERIOD_LABEL[period]} · {pet?.name ?? 'pet'}
            </Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 38, color: '#fff', marginTop: 2 }}>
              {formatBRL(summary.total)}
            </Text>
            {summary.monthlyAvg != null && period !== 'month' ? (
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#FBBF24', marginTop: 2 }}>
                ~{formatBRL(summary.monthlyAvg)}/mês · {summary.count} {summary.count === 1 ? 'gasto' : 'gastos'}
              </Text>
            ) : (
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#A3A3A3', marginTop: 2 }}>
                {summary.count} {summary.count === 1 ? 'gasto' : 'gastos'}
              </Text>
            )}
          </View>

          {expensesQuery.isLoading ? (
            <ActivityIndicator color={theme.brand} style={{ marginTop: 24 }} />
          ) : expenses.length === 0 ? (
            <EmptyState
              emoji="💸"
              title="Nenhum gasto ainda"
              description="Registre ração, vet, banho, remédio... e descubra quanto seu pet custa por mês."
              action={
                <PressScale
                  onPress={() => setFormOpen(true)}
                  style={{ backgroundColor: theme.brand, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Ionicons name="add-circle" size={16} color="#fff" />
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>Adicionar gasto</Text>
                </PressScale>
              }
            />
          ) : (
            <>
              {/* Breakdown por categoria */}
              {summary.byCategory.length > 0 ? (
                <View style={{ gap: 10, marginBottom: 18 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: theme.brand }}>
                    Em que você gasta
                  </Text>
                  {summary.byCategory.map((c) => {
                    const meta = expenseCategoryMeta(c.category);
                    const pct = summary.total > 0 ? (c.total / summary.total) * 100 : 0;
                    return (
                      <View key={c.category} style={{ gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 14 }}>{meta.emoji}</Text>
                          <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: theme.text, flex: 1 }}>
                            {meta.label}
                          </Text>
                          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
                            {formatBRL(c.total)}
                          </Text>
                          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, width: 38, textAlign: 'right' }}>
                            {pct.toFixed(0)}%
                          </Text>
                        </View>
                        <View style={{ height: 8, backgroundColor: theme.borderLight, borderRadius: 4, overflow: 'hidden' }}>
                          <View style={{ height: '100%', width: `${Math.max(3, (c.total / maxCat) * 100)}%`, backgroundColor: meta.color, borderRadius: 4 }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {/* Lista de gastos (todos, recentes primeiro) */}
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: theme.brand, marginBottom: 8 }}>
                Histórico
              </Text>
              <View style={{ gap: 8 }}>
                {expenses.map((e) => (
                  <ExpenseRow key={e.id} expense={e} onDelete={() => deleteMut.mutate(e.id)} />
                ))}
              </View>
            </>
          )}
        </CenteredColumn>
      </ScrollView>

      {/* Form modal */}
      <Modal visible={formOpen} transparent animationType="none" onRequestClose={resetForm}>
        <Animated.View entering={FadeIn.duration(150)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <Pressable onPress={resetForm} style={{ flex: 1 }} />
          <Animated.View
            entering={SlideInDown.duration(260)}
            exiting={SlideOutDown.duration(200)}
            style={{ backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 28, maxHeight: '88%' }}
          >
            <View style={{ alignItems: 'center', paddingBottom: 10 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.text, marginBottom: 6 }}>Novo gasto</Text>

              <Field label="Valor (R$)">
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="89,90"
                  placeholderTextColor={theme.textDim}
                  keyboardType="decimal-pad"
                  style={inputStyle(theme)}
                />
              </Field>

              <Field label="Categoria">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {EXPENSE_CATEGORIES.map((c) => {
                    const active = category === c.key;
                    return (
                      <Pressable
                        key={c.key}
                        onPress={() => setCategory(c.key)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? theme.brand : theme.borderLight }}
                      >
                        <Text style={{ fontSize: 13 }}>{c.emoji}</Text>
                        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: active ? '#fff' : theme.textDim }}>{c.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label="Descrição (opcional)">
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Ex: Ração Golden 15kg"
                  placeholderTextColor={theme.textDim}
                  style={inputStyle(theme)}
                />
              </Field>

              <Field label="Data">
                <TextInput
                  value={dateBr}
                  onChangeText={setDateBr}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor={theme.textDim}
                  keyboardType="numbers-and-punctuation"
                  style={inputStyle(theme)}
                />
              </Field>

              <PressScale
                onPress={onSave}
                disabled={saving}
                style={{ backgroundColor: theme.brand, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10, opacity: saving ? 0.6 : 1 }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#fff' }}>
                  {saving ? 'Salvando...' : 'Registrar gasto'}
                </Text>
              </PressScale>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

function ExpenseRow({ expense, onDelete }: { expense: PetExpense; onDelete: () => void }) {
  const { theme } = useTheme();
  const meta = expenseCategoryMeta(expense.category);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: theme.borderLight,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: meta.color + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
          {expense.description || meta.label}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 1 }}>
          {meta.label} · {format(parseISO(expense.spent_on), "d MMM yyyy", { locale: ptBR })}
        </Text>
      </View>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>{formatBRL(expense.amount)}</Text>
      <Pressable hitSlop={8} onPress={onDelete} style={{ padding: 4 }}>
        <Ionicons name="trash-outline" size={16} color="#9CA3AF" />
      </Pressable>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginTop: 14, gap: 6 }}>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>{label}</Text>
      {children}
    </View>
  );
}

function inputStyle(theme: ReturnType<typeof useTheme>['theme']) {
  return {
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: theme.text,
  };
}
