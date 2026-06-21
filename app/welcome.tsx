import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PetPhoneMockup } from '@/components/marketing/pet-phone-mockup';
import { PawPrintsBg } from '@/components/paw-prints-bg';
import { track } from '@/lib/analytics';
import { FONTS } from '@/lib/fonts';
import { fetchFounderPromo, qkFounder } from '@/lib/founder';
import { MOZART } from '@/lib/mozart';
import { useTranslation } from '@/lib/i18n';
import { storePendingRef } from '@/lib/referral';
import { useSession } from '@/providers/session-provider';

export default function WelcomeScreen() {
  const { session, loading } = useSession();
  const [invited, setInvited] = useState(false);

  // Bypass do redirect só pra preview da capa enquanto logado (?preview na web).
  // Não muda nada pro usuário real: sem o param, logado sempre vai pro feed.
  const previewMode =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

  // Captura ?ref=CODE (convite) → guarda pro signup. Reclamado antes do 1º pet.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const code = new URLSearchParams(window.location.search).get('ref');
    if (code) {
      storePendingRef(code);
      setInvited(true);
      track('referral_link_opened', { code: code.trim().toUpperCase() });
    }
  }, []);

  if (!loading && session && !previewMode) return <Redirect href="/(app)/(tabs)" />;

  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: '#FFFBF5' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 0 }}>
        <NavBar />
        <FounderPromoBanner />
        {invited ? <InviteRibbon /> : null}
        <Hero />
        <AppsShowcase />
        <Features />
        <HowItWorks />
        <PrivacyPromise />
        <Faq />
        <FinalCTA />
        <Footer />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Faixa de "você foi convidado" — só aparece quando veio por link de indicação. */
function InviteRibbon() {
  return (
    <View
      style={{
        backgroundColor: '#065F46',
        paddingHorizontal: 20,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 15 }}>🎁</Text>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FFFFFF', textAlign: 'center' }}>
        Você foi convidado! Crie sua conta e ganhe{' '}
        <Text style={{ color: '#6EE7B7' }}>7 dias de Pet Pro grátis</Text>.
      </Text>
    </View>
  );
}

/** Banner da promo de lançamento: os 100 primeiros ganham 3 meses de Pro. */
function FounderPromoBanner() {
  const { data } = useQuery({
    queryKey: qkFounder.promo,
    queryFn: fetchFounderPromo,
    staleTime: 60_000,
  });
  if (!data || !data.active) return null;
  // Mostra quantos JÁ garantiram (display_count = reais + 14, pra ter momento de
  // largada e nunca aparecer vazio/"seja o primeiro"). Nunca em branco.
  const joined = data.display_count ?? 14;
  return (
    <Link href="/(auth)/sign-up" asChild>
      <Pressable
        style={{
          backgroundColor: '#C2410C',
          paddingHorizontal: 18,
          paddingVertical: 11,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
        className="active:opacity-90"
      >
        <Text style={{ fontSize: 15 }}>🎉</Text>
        <Text
          style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FFFFFF', textAlign: 'center' }}
        >
          Lançamento: <Text style={{ color: '#FFE08A' }}>3 meses de Pet Pro grátis</Text> pros 100
          primeiros · <Text style={{ color: '#FFE08A' }}>{joined} já garantiram</Text>
        </Text>
        <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
      </Pressable>
    </Link>
  );
}

function NavBar() {
  const { t } = useTranslation();
  return (
    <View
      style={{ backgroundColor: '#FFFBF5' }}
      className="flex-row items-center justify-between border-b border-orange-100 px-6 py-3"
    >
      <View className="flex-row items-center gap-2">
        <Image
          source={{ uri: MOZART.rosto }}
          style={{ width: 34, height: 34 }}
          resizeMode="contain"
          accessibilityLabel="Mozart, o mascote do Maestro Pet"
        />
        <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#1A1410' }}>
          Maestro Pet
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Link href="/(auth)/sign-in" asChild>
          <Pressable className="rounded-full px-4 py-2 active:bg-orange-50">
            <Text style={{ fontFamily: FONTS.bodySemibold, fontSize: 14, color: '#404040' }}>
              {t('welcome.navbar.signIn')}
            </Text>
          </Pressable>
        </Link>
        <Link href="/(auth)/sign-up" asChild>
          <Pressable className="rounded-full bg-brand px-4 py-2 active:bg-brand-dark">
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
              {t('welcome.navbar.signUp')}
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

function Hero() {
  const { width } = useWindowDimensions();
  const isWide = width >= 880;
  const headlineSize = width >= 1024 ? 66 : width >= 700 ? 54 : 40;
  const headlineLine = headlineSize + 4;

  return (
    <View style={{ backgroundColor: '#FFF7ED', position: 'relative', overflow: 'hidden' }}>
      <PawPrintsBg opacity={0.08} count={12} />
      {/* manchas de cor de fundo — dão profundidade tipo "wallpaper" */}
      <View
        style={{
          position: 'absolute',
          top: -120,
          right: -80,
          width: 360,
          height: 360,
          borderRadius: 180,
          backgroundColor: '#FED7AA',
          opacity: 0.5,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -140,
          left: -100,
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: '#FDE68A',
          opacity: 0.35,
        }}
      />
      <View
        style={{
          marginHorizontal: 'auto',
          width: '100%',
          maxWidth: 1152,
          paddingHorizontal: 24,
          paddingTop: isWide ? 64 : 44,
          paddingBottom: isWide ? 64 : 44,
          flexDirection: isWide ? 'row' : 'column',
          alignItems: 'center',
          gap: isWide ? 40 : 8,
          zIndex: 1,
        }}
      >
        <View style={{ flex: 1, alignItems: isWide ? 'flex-start' : 'center' }}>
          {/* eyebrow / selo do conceito */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#FED7AA',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              marginBottom: 18,
              shadowColor: '#F97316',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 10,
            }}
          >
            <Text style={{ fontSize: 13 }}>📱</Text>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11.5,
                letterSpacing: 0.8,
                color: '#C2410C',
                textTransform: 'uppercase',
              }}
            >
              Novo · o celular do pet
            </Text>
          </View>

          <View style={{ alignItems: isWide ? 'flex-start' : 'center' }}>
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: headlineSize,
                lineHeight: headlineLine,
                color: '#1A1410',
                textAlign: isWide ? 'left' : 'center',
              }}
            >
              Um celular
            </Text>
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: headlineSize,
                lineHeight: headlineLine,
                color: '#F97316',
                textAlign: isWide ? 'left' : 'center',
              }}
            >
              de verdade
            </Text>
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: headlineSize,
                lineHeight: headlineLine,
                color: '#1A1410',
                textAlign: isWide ? 'left' : 'center',
              }}
            >
              pro seu pet.
            </Text>
          </View>

          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: isWide ? 18 : 16,
              lineHeight: isWide ? 28 : 24,
              color: '#525252',
              marginTop: 20,
              maxWidth: 520,
              textAlign: isWide ? 'left' : 'center',
            }}
          >
            Saúde, jogos, notícias, carteirinha, lugares, comunidade: cada coisa é um{' '}
            <Text style={{ fontFamily: FONTS.bodyBold, color: '#1A1410' }}>app</Text> dentro do
            Maestro Pet. Deslize, toque e cuide de tudo num lugar só.
          </Text>

          <View
            style={{
              marginTop: 28,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: isWide ? 'flex-start' : 'center',
            }}
          >
            <Link href="/(auth)/sign-up" asChild>
              <Pressable
                style={{
                  backgroundColor: '#F97316',
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  shadowColor: '#F97316',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.25,
                  shadowRadius: 16,
                  elevation: 6,
                }}
                className="active:opacity-90"
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: '#fff' }}>
                  Criar conta grátis
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </Pressable>
            </Link>
            <Link href="/(auth)/sign-in" asChild>
              <Pressable
                style={{
                  backgroundColor: '#fff',
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#E5E5E5',
                }}
                className="active:bg-neutral-50"
              >
                <Text style={{ fontFamily: FONTS.bodySemibold, fontSize: 16, color: '#262626' }}>
                  Já tenho conta
                </Text>
              </Pressable>
            </Link>
          </View>

          {/* Promo de lançamento — gancho dos 100 primeiros */}
          <View
            style={{
              marginTop: 18,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#FEF3C7',
              borderWidth: 1,
              borderColor: '#FCD34D',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
              maxWidth: 520,
            }}
          >
            <Text style={{ fontSize: 16 }}>🎁</Text>
            <Text
              style={{
                fontFamily: FONTS.bodyMedium,
                fontSize: 13.5,
                lineHeight: 19,
                color: '#92400E',
                flex: 1,
                textAlign: isWide ? 'left' : 'center',
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold }}>Promo de lançamento:</Text> os 100
              primeiros a entrar ganham 3 meses de Pet Pro grátis.
            </Text>
          </View>

          {/* Trust strip — fatos verificáveis, não vaidade */}
          <View
            style={{
              marginTop: 24,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 18,
              alignItems: 'center',
              justifyContent: isWide ? 'flex-start' : 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#525252" />
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#525252' }}>
                Dados criptografados · LGPD
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="cash-outline" size={16} color="#525252" />
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#525252' }}>
                Grátis sem cartão
              </Text>
            </View>
          </View>
        </View>

        {/* Centerpiece: o celular do pet animado */}
        <View style={{ flexShrink: 0, marginTop: isWide ? 0 : 16 }}>
          <PetPhoneMockup />
        </View>
      </View>
    </View>
  );
}

/** Vitrine dos "apps" — comunica a amplitude do produto, reforça a metáfora do celular. */
function AppsShowcase() {
  const apps: { icon: keyof typeof Ionicons.glyphMap; name: string; desc: string; bg: string; fg: string }[] = [
    { icon: 'medical-outline', name: 'Saúde', desc: 'Vacinas, sintomas e o Score de Saúde do seu pet.', bg: '#CCFBF1', fg: '#0F766E' },
    { icon: 'card-outline', name: 'Carteirinha', desc: 'ID digital com QR pra quem encontrar seu pet te achar.', bg: '#CFFAFE', fg: '#0E7490' },
    { icon: 'game-controller-outline', name: 'Jogos', desc: 'Joguinhos, desafio diário, streak e ranking de tutores.', bg: '#EDE9FE', fg: '#6D28D9' },
    { icon: 'newspaper-outline', name: 'Notícias', desc: 'Jornal do mundo pet, assinado pela Redação Maestro Pet.', bg: '#FCE7F3', fg: '#BE185D' },
    { icon: 'location-outline', name: 'Lugares', desc: 'Parques, vets e cafés pet-friendly perto de você.', bg: '#DBEAFE', fg: '#1D4ED8' },
    { icon: 'chatbubbles-outline', name: 'Mensagens', desc: 'Converse no chat com outros tutores e combine cuidados.', bg: '#F3E8FF', fg: '#7E22CE' },
    { icon: 'trophy-outline', name: 'Conquistas', desc: 'Medalhas por cuidar bem e manter tudo em dia.', bg: '#FEF3C7', fg: '#B45309' },
    { icon: 'paw-outline', name: 'Achados', desc: 'Mural de perdidos e encontrados com geolocalização.', bg: '#FEF9C3', fg: '#A16207' },
    // 'Vantagens' (clube de descontos) escondido da vitrine até ter ofertas reais.
  ];
  const { width } = useWindowDimensions();
  const cols = width >= 1000 ? 3 : width >= 640 ? 2 : 1;

  return (
    <View style={{ backgroundColor: '#FFFBF5', paddingHorizontal: 24, paddingVertical: 72 }}>
      <View style={{ marginHorizontal: 'auto', width: '100%', maxWidth: 1152 }}>
        <SectionHeader kicker="A TELA INICIAL" title="Um app pra cada parte da vida do seu pet" />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 }}>
          {apps.map((a) => (
            <View key={a.name} style={{ width: `${100 / cols}%`, padding: 8 }}>
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 18,
                  padding: 18,
                  height: '100%',
                  borderWidth: 1,
                  borderColor: '#F1ECE5',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 15,
                    backgroundColor: a.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Ionicons name={a.icon} size={26} color={a.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 17, color: a.fg, marginBottom: 3 }}>
                    {a.name}
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 18, color: '#525252' }}>
                    {a.desc}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            color: '#737373',
            textAlign: 'center',
            marginTop: 24,
          }}
        >
          E tem mais: feed só de pets, chat, diário, galeria, agenda… tudo grátis.
        </Text>
      </View>
    </View>
  );
}

function Features() {
  const features: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    desc: string;
    tag: 'Saúde' | 'Comunidade' | 'Utilidade';
  }[] = [
    {
      icon: 'medical-outline',
      title: 'Calendário de vacinas',
      desc: 'Protocolo padrão por espécie (V8, V10, antirrábica, leishmaniose). O sistema sugere doses pela idade e marca as que estão atrasadas.',
      tag: 'Saúde',
    },
    {
      icon: 'pulse-outline',
      title: 'Registro de sintomas',
      desc: 'Anote vômito, apatia, mudança de apetite com data e foto. Vira gráfico de evolução e PDF pra mostrar ao veterinário.',
      tag: 'Saúde',
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Carteirinha digital',
      desc: 'QR público com nome, idade, contato e veterinário. Quem encontrar seu pet escaneia e te liga, sem precisar de chip.',
      tag: 'Utilidade',
    },
    {
      icon: 'notifications-outline',
      title: 'Lembretes que chegam',
      desc: 'Vacina vencendo em 7 dias? Vermífugo em 30? Push automático no celular, sem você precisar lembrar de checar.',
      tag: 'Saúde',
    },
    {
      icon: 'people-outline',
      title: 'Comunidade real',
      desc: 'Feed só de pets (zero humano no caminho), encontros no parque, fórum pra trocar dúvidas com outros tutores da região.',
      tag: 'Comunidade',
    },
    {
      icon: 'paw-outline',
      title: 'Múltiplos pets, 1 conta',
      desc: 'Tutor de 3 gatos, 1 cachorro e 2 coelhos? Cada um tem perfil próprio, calendário próprio. Você gerencia tudo num lugar só.',
      tag: 'Utilidade',
    },
  ];

  const { width } = useWindowDimensions();
  const cols = width >= 1000 ? 3 : width >= 600 ? 2 : 1;
  const tagColors: Record<'Saúde' | 'Comunidade' | 'Utilidade', { bg: string; fg: string }> = {
    'Saúde': { bg: '#DCFCE7', fg: '#166534' },
    'Comunidade': { bg: '#FED7AA', fg: '#9A3412' },
    'Utilidade': { bg: '#DBEAFE', fg: '#1E40AF' },
  };

  return (
    <View style={{ backgroundColor: '#FFFBF5', paddingHorizontal: 24, paddingVertical: 72 }}>
      <View style={{ marginHorizontal: 'auto', width: '100%', maxWidth: 1152 }}>
        <SectionHeader kicker="O QUE TEM DENTRO" title="Construído pra resolver problema de verdade" />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 }}>
          {features.map((f) => {
            const tagColor = tagColors[f.tag];
            return (
              <View key={f.title} style={{ width: `${100 / cols}%`, padding: 8 }}>
                <View
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 16,
                    padding: 24,
                    height: '100%',
                    borderWidth: 1,
                    borderColor: '#F1ECE5',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: '#F5F1EB',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name={f.icon} size={20} color="#1A1410" />
                    </View>
                    <View
                      style={{
                        backgroundColor: tagColor.bg,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 10,
                          color: tagColor.fg,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                        }}
                      >
                        {f.tag}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: 18,
                      color: '#1A1410',
                      marginBottom: 8,
                      lineHeight: 23,
                    }}
                  >
                    {f.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 14,
                      lineHeight: 22,
                      color: '#525252',
                    }}
                  >
                    {f.desc}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function HowItWorks() {
  const steps: { n: string; title: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    {
      n: '1',
      title: 'Crie a conta',
      desc: 'Email + senha. Confirmação por email opcional. Sem cartão de crédito, sem dados pessoais além do nome.',
      icon: 'person-add-outline',
    },
    {
      n: '2',
      title: 'Cadastre seu pet',
      desc: 'Nome, espécie, raça, data de nascimento. O calendário vacinal sugerido aparece automaticamente (V8/V10 pra cães, antirrábica anual, etc.)',
      icon: 'paw-outline',
    },
    {
      n: '3',
      title: 'Registre e receba lembretes',
      desc: 'Marque vacinas já aplicadas, registre sintomas se surgirem. O sistema te avisa quando o próximo evento de saúde vence.',
      icon: 'notifications-outline',
    },
  ];
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  return (
    <View style={{ backgroundColor: '#FFF7ED', paddingHorizontal: 24, paddingVertical: 72, position: 'relative' }}>
      <PawPrintsBg opacity={0.05} count={10} />
      <View style={{ marginHorizontal: 'auto', width: '100%', maxWidth: 1152, zIndex: 1 }}>
        <SectionHeader kicker="COMO FUNCIONA" title="Comece em 3 passos" />

        <View style={{ flexDirection: isWide ? 'row' : 'column', gap: isWide ? 24 : 16 }}>
          {steps.map((s, i) => (
            <View
              key={s.n}
              style={{
                flex: 1,
                backgroundColor: '#fff',
                padding: 24,
                borderRadius: 24,
                shadowColor: '#1A1410',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.06,
                shadowRadius: 16,
                elevation: 3,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: '#F97316',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#fff' }}>{s.n}</Text>
                </View>
                <Ionicons name={s.icon} size={24} color="#737373" />
              </View>
              <Text
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 20,
                  color: '#1A1410',
                  marginBottom: 6,
                  lineHeight: 24,
                }}
              >
                {s.title}
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: '#525252' }}>
                {s.desc}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function PrivacyPromise() {
  const items: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
    {
      icon: 'lock-closed-outline',
      title: 'Dados criptografados',
      desc: 'Tudo trafega via HTTPS. Senhas são hash bcrypt. Histórico de saúde fica isolado por conta: só você (e cuidadores que você convidou) acessa.',
    },
    {
      icon: 'ban-outline',
      title: 'Sem venda de dados',
      desc: 'Não vendemos, não compartilhamos com seguradoras, não usamos pra treinar IA terceira. Receita vem só de Pet Pro e patrocínio transparente no feed.',
    },
    {
      icon: 'document-text-outline',
      title: 'LGPD pra valer',
      desc: 'Exporte tudo em JSON em 1 clique. Apague sua conta e todos os dados em 1 clique. Termos curtos, sem letrinha miúda.',
    },
    {
      icon: 'cloud-outline',
      title: 'Infra no Supabase',
      desc: 'Banco PostgreSQL gerenciado, com backups automáticos diários. Hospedagem na Vercel (CDN global). Stack open-source em todos os pontos.',
    },
  ];
  const { width } = useWindowDimensions();
  const cols = width >= 900 ? 2 : 1;

  return (
    <View style={{ backgroundColor: '#1A1410', paddingHorizontal: 24, paddingVertical: 72 }}>
      <View style={{ marginHorizontal: 'auto', width: '100%', maxWidth: 1152 }}>
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.6,
              color: '#FB923C',
              textTransform: 'uppercase',
            }}
          >
            POR DENTRO
          </Text>
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 32,
              lineHeight: 36,
              color: '#FFFFFF',
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            Como protegemos os dados do seu pet
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              lineHeight: 22,
              color: '#A8A29E',
              textAlign: 'center',
              marginTop: 10,
              maxWidth: 560,
            }}
          >
            Você confia o histórico de saúde do seu pet. A gente respeita isso de verdade, não com promessa de marketing.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -10 }}>
          {items.map((it) => (
            <View key={it.title} style={{ width: `${100 / cols}%`, padding: 10 }}>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 14,
                  padding: 22,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  flexDirection: 'row',
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: 'rgba(251,146,60,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Ionicons name={it.icon} size={18} color="#FB923C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 15,
                      color: '#FFFFFF',
                      marginBottom: 4,
                    }}
                  >
                    {it.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 13,
                      lineHeight: 20,
                      color: '#D6D3D1',
                    }}
                  >
                    {it.desc}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function Faq() {
  const items: { q: string; a: string }[] = [
    {
      q: 'O Maestro Pet substitui o veterinário?',
      a: 'Não. É uma ferramenta de organização: calendário de vacinas, registro de sintomas, histórico pra mostrar ao vet. Diagnóstico e tratamento sempre com profissional. Nunca damos orientação clínica que pode colocar seu pet em risco.',
    },
    {
      q: 'Os lembretes de vacina seguem qual protocolo?',
      a: 'O calendário sugerido é baseado nos protocolos padrão usados por veterinários no Brasil (V8/V10 pra cães, vacina quádrupla felina, antirrábica anual). Seu vet pode ajustar conforme idade, raça e estilo de vida do seu pet. Sempre confirme com ele antes de aplicar.',
    },
    {
      q: 'Posso usar pra mais de um pet?',
      a: 'Sim. Cada pet tem perfil, calendário, prontuário e carteirinha próprios. No plano grátis você cadastra 1 pet. No Pet Pro, até 6.',
    },
    {
      q: 'Quanto custa?',
      a: 'O básico é grátis: 1 pet, carteirinha digital, vacinas, lembretes e o Jornal Pet. O Pet Pro (R$ 14,90/mês ou R$ 99,90/ano) desbloqueia até 6 pets, posts ilimitados, relatórios e gráficos de saúde, co-tutores e o prontuário/carteirinha em PDF sem marca d\'água.',
    },
    {
      q: 'Funciona offline?',
      a: 'Parcialmente. O app é PWA: você instala no celular, abre rápido, lê dados já carregados sem internet. Mas pra registrar vacinas e sincronizar com a nuvem, precisa de conexão.',
    },
    {
      q: 'O que acontece se eu apagar minha conta?',
      a: 'Tudo é apagado em até 30 dias (LGPD): perfis dos pets, fotos, posts, vacinas, sintomas, mensagens. Você pode exportar tudo em JSON antes, no botão "Baixar meus dados" na sua conta.',
    },
  ];

  return (
    <View style={{ backgroundColor: '#FFFBF5', paddingHorizontal: 24, paddingVertical: 72 }}>
      <View style={{ marginHorizontal: 'auto', width: '100%', maxWidth: 720 }}>
        <SectionHeader kicker="PERGUNTAS HONESTAS" title="Antes de criar a conta" />
        <View style={{ gap: 12 }}>
          {items.map((it) => (
            <View
              key={it.q}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 14,
                padding: 20,
                borderWidth: 1,
                borderColor: '#F1ECE5',
              }}
            >
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 15,
                  color: '#1A1410',
                  marginBottom: 6,
                }}
              >
                {it.q}
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 14,
                  lineHeight: 22,
                  color: '#525252',
                }}
              >
                {it.a}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function FinalCTA() {
  return (
    <View style={{ backgroundColor: '#F97316', position: 'relative', overflow: 'hidden' }}>
      <PawPrintsBg opacity={0.1} count={14} />
      <View
        style={{
          marginHorizontal: 'auto',
          width: '100%',
          maxWidth: 720,
          paddingHorizontal: 24,
          paddingVertical: 72,
          alignItems: 'center',
          zIndex: 1,
        }}
      >
        <Image
          source={{ uri: MOZART.rosto }}
          style={{ width: 76, height: 76, marginBottom: 14 }}
          resizeMode="contain"
          accessibilityLabel="Mozart, mascote do Maestro Pet"
        />
        <Text
          style={{
            fontFamily: FONTS.display,
            fontSize: 38,
            lineHeight: 42,
            color: '#fff',
            textAlign: 'center',
          }}
        >
          Liga o celular do seu pet.
        </Text>
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 16,
            lineHeight: 24,
            color: '#FFEDD5',
            textAlign: 'center',
            marginTop: 12,
            maxWidth: 480,
          }}
        >
          Saúde, jogos, notícias, comunidade: todos os apps num lugar só. Grátis, em 30 segundos.
        </Text>
        <View
          style={{
            marginTop: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(255,255,255,0.18)',
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontSize: 15 }}>🎁</Text>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13.5, color: '#fff', textAlign: 'center' }}>
            Os 100 primeiros ganham 3 meses de Pet Pro grátis
          </Text>
        </View>
        <View style={{ marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable
              style={{
                backgroundColor: '#fff',
                paddingHorizontal: 28,
                paddingVertical: 16,
                borderRadius: 16,
              }}
              className="active:opacity-90"
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: '#C2410C' }}>
                Criar conta grátis
              </Text>
            </Pressable>
          </Link>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable
              style={{
                paddingHorizontal: 28,
                paddingVertical: 16,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.4)',
              }}
              className="active:bg-white/10"
            >
              <Text style={{ fontFamily: FONTS.bodySemibold, fontSize: 16, color: '#fff' }}>
                Já tenho conta
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

function Footer() {
  return (
    <View style={{ backgroundColor: '#1A1410', paddingHorizontal: 24, paddingVertical: 36 }}>
      <View style={{ marginHorizontal: 'auto', width: '100%', maxWidth: 1152, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image
              source={{ uri: MOZART.rosto }}
              style={{ width: 28, height: 28 }}
              resizeMode="contain"
              accessibilityLabel=""
            />
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#fff' }}>Maestro Pet</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginLeft: 'auto' }}>
            <Link href={'/noticias' as never} style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: '#A3A3A3' }}>
              Jornal Pet
            </Link>
            <Link href="/legal/about" style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: '#A3A3A3' }}>
              Sobre
            </Link>
            <Link href="/legal/faq" style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: '#A3A3A3' }}>
              FAQ
            </Link>
            <Link href="/legal/terms" style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: '#A3A3A3' }}>
              Termos
            </Link>
            <Link href="/legal/privacy" style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: '#A3A3A3' }}>
              Privacidade
            </Link>
          </View>
        </View>
        <View
          style={{
            borderTopWidth: 1,
            borderColor: '#404040',
            paddingTop: 14,
            flexDirection: 'row',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#737373' }}>
            © {new Date().getFullYear()} Maestro Pet · Feito com 💛 pra quem ama bichinhos
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#737373' }}>
            maestropetcontato@gmail.com
          </Text>
        </View>
      </View>
    </View>
  );
}

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <View style={{ alignItems: 'center', marginBottom: 40 }}>
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 11,
          letterSpacing: 1.6,
          color: '#F97316',
          textTransform: 'uppercase',
        }}
      >
        {kicker}
      </Text>
      <Text
        style={{
          fontFamily: FONTS.display,
          fontSize: 32,
          lineHeight: 36,
          color: '#1A1410',
          textAlign: 'center',
          marginTop: 8,
        }}
      >
        {title}
      </Text>
    </View>
  );
}
