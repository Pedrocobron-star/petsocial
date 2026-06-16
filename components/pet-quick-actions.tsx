import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { HEALTH_GUIDE_ENABLED } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import type { ParasiteSummary } from '@/lib/queries';
import type { Vaccination } from '@/lib/types';

import { CenteredColumn } from './ui/centered-column';
import { PressScale } from './ui/press-scale';

interface Props {
  petId: string;
  isOwn: boolean;
  vaccinations: Vaccination[];
  parasiteSummary?: ParasiteSummary;
}

/**
 * Cards de ações rápidas: Saúde (só dono), Antiparasitários, Vacinas, Diário, IA, Retrospectiva.
 * Layout com cores tonais. Tudo com PressScale pra feedback tátil.
 */
export function PetQuickActions({ petId, isOwn, vaccinations, parasiteSummary }: Props) {
  // Vacinas atrasadas — alimenta o selo de "pendente" do card Saúde.
  const overdue = vaccinations.filter((v) => {
    if (!v.next_dose_at) return false;
    return new Date(v.next_dose_at) < new Date();
  }).length;

  const parasiteAlert =
    !!parasiteSummary && (parasiteSummary.overdue > 0 || parasiteSummary.due_soon > 0);
  // Texto do selo do card Saúde. Vencidos (vacinas + antiparasitário) = "pendente";
  // só "vencendo em breve" (due_soon) = "a vencer". Antes somava só os vencidos
  // -> exibia "0 pendente" quando só havia due_soon.
  const overduePending = overdue + (parasiteSummary?.overdue ?? 0);
  const dueSoonCount = parasiteSummary?.due_soon ?? 0;
  const healthBadgeLabel =
    overduePending > 0
      ? `${overduePending} pendente`
      : dueSoonCount > 0
        ? `${dueSoonCount} a vencer`
        : null;

  return (
    <Animated.View entering={FadeInUp.duration(360).delay(100)}>
      <CenteredColumn maxWidth={540}>
        <View style={{ marginTop: 16, gap: 8 }}>
          {/* Carteirinha — flagship, visível pra todos */}
          <Link
            href={{
              pathname: '/pet/[id]/id-card' as never,
              params: { id: petId } as never,
            }}
            asChild
          >
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Carteirinha digital oficial · ID, QR e compartilhamento"
              style={{
                backgroundColor: '#FFFBF5',
                borderRadius: 18,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 2,
                borderColor: '#1A1410',
                overflow: 'hidden',
              }}
            >
              {/* Listrinha tipo passaporte */}
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  flexDirection: 'row',
                  height: 3,
                }}
              >
                <View style={{ flex: 1, backgroundColor: '#F97316' }} />
                <View style={{ flex: 1, backgroundColor: '#FBBF24' }} />
                <View style={{ flex: 1, backgroundColor: '#F97316' }} />
              </View>
              <Text
                style={{
                  position: 'absolute',
                  right: -4,
                  bottom: -6,
                  fontSize: 60,
                  opacity: 0.06,
                  transform: [{ rotate: '15deg' }],
                }}
              >
                🐾
              </Text>

              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: '#1A1410',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 22 }}>🪪</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#1A1410' }}>
                    Carteirinha digital
                  </Text>
                  <View
                    style={{
                      backgroundColor: '#FBBF24',
                      borderRadius: 999,
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 8,
                        color: '#1A1410',
                        letterSpacing: 0.6,
                      }}
                    >
                      OFICIAL
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 12,
                    color: '#737373',
                    marginTop: 1,
                  }}
                >
                  ID + QR + share pra WhatsApp · Stories
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#1A1410" />
            </PressScale>
          </Link>

          {/* Hub de Saúde (só dono) */}
          {isOwn ? (
            <Link
              href={{ pathname: '/pet/[id]/health' as never, params: { id: petId } as never }}
              asChild
            >
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={
                  healthBadgeLabel
                    ? `Saúde, ${healthBadgeLabel}. Vacinas, vermífugo, remédios, vet e peso`
                    : 'Saúde. Vacinas, vermífugo, remédios, vet e peso'
                }
                style={{
                  backgroundColor: '#1A1410',
                  borderRadius: 18,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: '#FBBF24',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 22 }}>🏥</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontFamily: FONTS.display, fontSize: 17, color: '#fff' }}>
                      Saúde
                    </Text>
                    {overdue > 0 || parasiteAlert ? (
                      <View
                        style={{
                          backgroundColor: '#EF4444',
                          borderRadius: 999,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                        }}
                      >
                        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: '#fff' }}>
                          {healthBadgeLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 12,
                      color: '#A3A3A3',
                      marginTop: 2,
                    }}
                  >
                    Vacinas · Vermífugo · Remédios · Vet · Peso
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
              </PressScale>
            </Link>
          ) : null}

          {/* Vacinas, vermífugo, agenda e diário NÃO ficam mais aqui: cada um
              é um app separado na tela inicial (springboard). O card "Saúde"
              acima já abre o hub que contém todos eles. Evita entrada duplicada
              pra mesma página (pedido do Pedro). */}

          {isOwn ? (
            <>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <QuickCard
                  href={`/pet/${petId}/time-capsule`}
                  emoji="📼"
                  label="Retrospectiva"
                  sub="Um ano com você"
                  tint="#FEF3C7"
                  tintText="#92400E"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <QuickCard
                  href={`/pet/${petId}/caretakers`}
                  emoji="🤝"
                  label="Cuidadores"
                  sub="Compartilhar"
                  tint="#DCFCE7"
                  tintText="#166534"
                />
                {HEALTH_GUIDE_ENABLED ? (
                  <QuickCard
                    href={`/pet/${petId}/ai-assistant`}
                    emoji="📋"
                    label="Tira-dúvidas"
                    sub="Guia de saúde"
                    tint="#DBEAFE"
                    tintText="#1E40AF"
                  />
                ) : null}
              </View>
            </>
          ) : null}
        </View>
      </CenteredColumn>
    </Animated.View>
  );
}

function QuickCard({
  href,
  emoji,
  label,
  sub,
  tint,
  tintText,
}: {
  href: string;
  emoji: string;
  label: string;
  sub: string;
  tint: string;
  tintText: string;
}) {
  return (
    <Link href={href as never} asChild>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${sub}`}
        style={{
          flex: 1,
          backgroundColor: tint,
          borderRadius: 14,
          padding: 14,
          minHeight: 92,
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontSize: 26 }}>{emoji}</Text>
        <View>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: tintText }}>
            {label}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: tintText,
              opacity: 0.7,
              marginTop: 1,
            }}
          >
            {sub}
          </Text>
        </View>
      </PressScale>
    </Link>
  );
}
