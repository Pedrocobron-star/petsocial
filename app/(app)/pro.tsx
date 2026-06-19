import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { PremiumBadge } from '@/components/premium-badge';
import { MOZART } from '@/lib/mozart';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { track } from '@/lib/analytics';
import { caktoCheckoutUrl } from '@/lib/cakto';
import { PRICING } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useSubscription } from '@/providers/subscription-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

// 3 hero benefits exibidos com peso visual maior, antes da lista completa.
// Âncora da assinatura = "Cofre da Saúde": histórico clínico que nunca some.
const HERO_BENEFITS = [
  { emoji: '🩺', title: 'Histórico clínico completo', desc: 'Vacinas, exames e peso, sem limite de tempo' },
  { emoji: '📄', title: 'Prontuário pro vet', desc: 'PDF completo num clique, sem marca d\'água' },
  { emoji: '📈', title: 'Evolução da saúde', desc: 'Acompanhe o Score mês a mês, o ano todo' },
] as const;

const PRO_FEATURES = [
  { emoji: '🩺', title: 'Histórico clínico sem limite', desc: 'Veja vacinas, consultas, sintomas e peso de qualquer época. No free, só os últimos 3 meses.' },
  { emoji: '📄', title: 'Prontuário-mestre em PDF', desc: 'Exporte tudo do seu pet pro vet num clique, sem marca d\'água.' },
  { emoji: '🪪', title: 'Carteirinha premium', desc: 'Carteirinha de identidade do pet sem marca d\'água, pronta pra imprimir.' },
  { emoji: '📈', title: 'Evolução da saúde o ano todo', desc: 'Score de saúde de todos os meses, não só os últimos 3.' },
  { emoji: '🐾', title: 'Até 6 pets', desc: 'Toda a família num lugar só (no free, 1 pet).' },
  { emoji: '🎨', title: 'Avatar customizável', desc: 'Cores, acessórios e cenários únicos pro seu pet.' },
  { emoji: '🏅', title: 'Selo dourado Pet Pro', desc: 'Sua estrela de Pet Pro em destaque no perfil e no feed.' },
];

const FREE_FEATURES = [
  '1 pet',
  '1 post por dia',
  'Histórico de saúde dos últimos 3 meses',
  'Carteirinha com marca d\'água',
  'Anúncios discretos',
];

const FAQ = [
  {
    q: 'Tem fidelidade ou cobrança automática?',
    a: 'Não. O Pet Pro é por período (mês ou ano): você paga uma vez e usa. Quando acaba, volta ao grátis e você só renova se quiser, sem surpresa no cartão.',
  },
  {
    q: 'Tem garantia de reembolso?',
    a: '7 dias após a compra você pode pedir reembolso integral. Manda email pra maestropetcontato@gmail.com que devolvemos rápido.',
  },
  {
    q: 'Como funciona o pagamento?',
    a: 'Pix ou cartão, com checkout seguro da Cakto. Pagamento por período (mês ou ano), sem débito automático: você renova quando quiser.',
  },
  {
    q: 'O que acontece com meus dados se eu cancelar?',
    a: 'Nada! Pets, posts e mensagens continuam intactos, apenas voltam pros limites do plano gratuito.',
  },
];

export default function ProScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { isPro, subscription } = useSubscription();
  const { session } = useSession();
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Analytics: log impression do screen
  useEffect(() => {
    track('pro_screen_view', { is_pro: isPro });
  }, [isPro]);

  // Checkout via Cakto (Pix + cartão). Abre o link hospedado com o email no
  // prefill — o webhook cakto-webhook casa o pagamento com a conta e ativa o Pro.
  const checkoutMut = useMutation({
    mutationFn: async () => {
      track('checkout_started', { plan, gateway: 'cakto' });
      const url = caktoCheckoutUrl(plan, session?.user?.email ?? null);
      if (!url) throw new Error('Checkout indisponível no momento. Tente de novo em instantes.');
      return url;
    },
    onSuccess: async (url) => {
      try {
        await Linking.openURL(url);
      } catch {
        toast.error('Não foi possível abrir o checkout');
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro ao iniciar pagamento'),
  });

  const monthlyPrice = `R$ ${PRICING.monthlyBRL.toFixed(2).replace('.', ',')}`;
  const yearlyPrice = `R$ ${PRICING.yearlyBRL.toFixed(2).replace('.', ',')}`;
  const yearlyEq = `R$ ${PRICING.yearlyMonthlyEquivalent.toFixed(2).replace('.', ',')}`;
  // Economia anual: 12 × mensal − preço anual
  const yearlySavings = PRICING.monthlyBRL * 12 - PRICING.yearlyBRL;
  const savingsFormatted = `R$ ${yearlySavings.toFixed(2).replace('.', ',')}`;

  const selectPlan = (next: 'monthly' | 'yearly') => {
    setPlan(next);
    track('plan_selected', { plan: next });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Pet Pro', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18 }}>
        {/* Hero */}
        <View
          style={{
            backgroundColor: '#1A1410',
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            gap: 12,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Decorative gold accents */}
          <View
            style={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#F59E0B',
              opacity: 0.15,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: -30,
              left: -30,
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: '#F59E0B',
              opacity: 0.1,
            }}
          />

          <Image
            source={{ uri: MOZART.maestro }}
            style={{ width: 132, height: 132 }}
            resizeMode="contain"
            accessibilityLabel="Mozart maestro"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: 32,
                color: '#fff',
              }}
            >
              Pet Pro
            </Text>
            <PremiumBadge size={22} />
          </View>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              color: '#E5E5E5',
              textAlign: 'center',
              lineHeight: 20,
            }}
          >
            A saúde do seu pet organizada e protegida: histórico clínico que nunca
            some, prontuário pro vet num clique e a evolução acompanhada o ano todo.
          </Text>
          {isPro ? (
            <View
              style={{
                marginTop: 8,
                backgroundColor: '#F59E0B',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>
                Você já é Pet Pro!
              </Text>
            </View>
          ) : null}
        </View>

        {/* Hero benefits — 3 cards prominentes ANTES da lista longa */}
        {!isPro ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {HERO_BENEFITS.map((b) => (
              <View
                key={b.title}
                style={{
                  flex: 1,
                  backgroundColor: theme.surface,
                  borderRadius: 14,
                  padding: 12,
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 28 }}>{b.emoji}</Text>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 12,
                    color: theme.text,
                    textAlign: 'center',
                  }}
                >
                  {b.title}
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 10,
                    color: theme.textDim,
                    textAlign: 'center',
                    lineHeight: 14,
                  }}
                >
                  {b.desc}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Plan picker */}
        {!isPro ? (
          <View style={{ gap: 10 }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                letterSpacing: 1.4,
                color: theme.brand,
                textTransform: 'uppercase',
              }}
            >
              Escolha seu plano
            </Text>

            {/* Yearly card — visual de "mais popular" */}
            <Pressable
              onPress={() => selectPlan('yearly')}
              accessibilityRole="radio"
              accessibilityState={{ selected: plan === 'yearly' }}
              style={{
                backgroundColor: plan === 'yearly' ? '#FFF7ED' : theme.surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 2,
                borderColor: plan === 'yearly' ? theme.brand : theme.border,
                gap: 6,
                position: 'relative',
              }}
            >
              {/* "MAIS POPULAR" pill no topo */}
              <View
                style={{
                  position: 'absolute',
                  top: -10,
                  right: 12,
                  backgroundColor: theme.brand,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 999,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Ionicons name="star" size={9} color="#fff" />
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 9,
                    color: '#fff',
                    letterSpacing: 0.5,
                  }}
                >
                  MAIS POPULAR
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: theme.text }}>
                  Anual
                </Text>
                <View
                  style={{
                    backgroundColor: '#16A34A',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: '#fff' }}>
                    −{PRICING.yearlyDiscountPercent}%
                  </Text>
                </View>
                {plan === 'yearly' ? (
                  <Ionicons name="checkmark-circle" size={20} color={theme.brand} style={{ marginLeft: 'auto' }} />
                ) : null}
              </View>
              <Text style={{ fontFamily: FONTS.display, fontSize: 26, color: theme.text }}>
                {yearlyPrice}
                <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: theme.textDim }}>
                  {' '}/ ano
                </Text>
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                Equivale a {yearlyEq} por mês.
              </Text>
              {/* Savings callout */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 2,
                }}
              >
                <Ionicons name="trending-down" size={13} color="#16A34A" />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#16A34A' }}>
                  Você economiza {savingsFormatted} por ano
                </Text>
              </View>
            </Pressable>

            {/* Monthly card */}
            <Pressable
              onPress={() => selectPlan('monthly')}
              accessibilityRole="radio"
              accessibilityState={{ selected: plan === 'monthly' }}
              style={{
                backgroundColor: plan === 'monthly' ? '#FFF7ED' : theme.surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 2,
                borderColor: plan === 'monthly' ? theme.brand : theme.border,
                gap: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: theme.text }}>
                  Mensal
                </Text>
                {plan === 'monthly' ? (
                  <Ionicons name="checkmark-circle" size={20} color={theme.brand} style={{ marginLeft: 'auto' }} />
                ) : null}
              </View>
              <Text style={{ fontFamily: FONTS.display, fontSize: 26, color: theme.text }}>
                {monthlyPrice}
                <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: theme.textDim }}>
                  {' '}/ mês
                </Text>
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                Cancele quando quiser, sem multa.
              </Text>
            </Pressable>

            <Button
              title={`Assinar agora • ${plan === 'yearly' ? yearlyPrice + '/ano' : monthlyPrice + '/mês'}`}
              onPress={() => checkoutMut.mutate()}
              loading={checkoutMut.isPending}
              fullWidth
            />

            {/* Guarantee badge prominent */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#ECFDF5',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: '#A7F3D0',
              }}
            >
              <Ionicons name="shield-checkmark" size={20} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#065F46' }}>
                  Garantia de 7 dias
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#047857', marginTop: 1 }}>
                  Reembolso integral sem perguntas se não curtir.
                </Text>
              </View>
            </View>

            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 11,
                color: theme.textDim,
                textAlign: 'center',
              }}
            >
              💳 Pix ou cartão • 🔒 Pagamento seguro via Cakto
            </Text>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 14,
              padding: 16,
              gap: 8,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
              Plano atual: {subscription?.plan === 'yearly' ? 'Anual' : 'Mensal'}
            </Text>
            {subscription?.current_period_end ? (
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                Próxima cobrança: {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
              </Text>
            ) : null}
            <Button
              title="Gerenciar assinatura"
              variant="secondary"
              onPress={() => router.push('/(app)/account' as never)}
              fullWidth
            />
          </View>
        )}

        {/* Pro features completas */}
        <View style={{ gap: 10, marginTop: 8 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.4,
              color: theme.brand,
              textTransform: 'uppercase',
            }}
          >
            Tudo o que vem incluído
          </Text>
          <View style={{ gap: 8 }}>
            {PRO_FEATURES.map((f) => (
              <View
                key={f.title}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: theme.surface,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <Text style={{ fontSize: 22 }}>{f.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
                    {f.title}
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 1 }}>
                    {f.desc}
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              </View>
            ))}
          </View>
        </View>

        {/* Comparison */}
        <View style={{ marginTop: 8 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.4,
              color: theme.textDim,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            No plano gratuito você tem
          </Text>
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 12,
              padding: 14,
              gap: 6,
            }}
          >
            {FREE_FEATURES.map((f) => (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="remove-circle-outline" size={14} color={theme.textDim} />
                <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted }}>
                  {f}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* FAQ collapsible */}
        <View style={{ marginTop: 8, gap: 8 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.4,
              color: theme.brand,
              textTransform: 'uppercase',
              marginBottom: 2,
            }}
          >
            Perguntas frequentes
          </Text>
          {FAQ.map((item, i) => (
            <FaqItem
              key={item.q}
              q={item.q}
              a={item.a}
              open={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? null : i)}
            />
          ))}
        </View>

        {/* Final reassurance footer */}
        {!isPro ? (
          <View style={{ alignItems: 'center', marginTop: 8, gap: 4 }}>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 11,
                color: theme.textDim,
                textAlign: 'center',
              }}
            >
              Cancele quando quiser • Sem fidelidade • Dados sempre seus
            </Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 10,
                color: theme.textDim,
                textAlign: 'center',
              }}
            >
              Dúvidas? maestropetcontato@gmail.com
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

interface FaqItemProps {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}

function FaqItem({ q, a, open, onToggle }: FaqItemProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={{
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
          {q}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.textDim}
        />
      </View>
      {open ? (
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 12,
            color: theme.textDim,
            lineHeight: 18,
            marginTop: 6,
          }}
        >
          {a}
        </Text>
      ) : null}
    </Pressable>
  );
}
