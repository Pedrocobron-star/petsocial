import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeaderHomeIcon } from '@/components/header-home-logo';
import { MyPetsSection } from '@/components/my-pets-section';
import { PremiumBadge } from '@/components/premium-badge';
import { ProfileQuickLinks } from '@/components/profile-quick-links';
import { StreakBadge } from '@/components/streak-badge';
import { MotionSwitcher } from '@/components/motion-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { TutorLevelBar } from '@/components/tutor-level-bar';
import { TutorProfileHero } from '@/components/tutor-profile-hero';
import { Button } from '@/components/ui/button';
import { CenteredColumn } from '@/components/ui/centered-column';
import { FONTS } from '@/lib/fonts';
import { fetchProfile, fetchUserPostDates, qk } from '@/lib/queries';
import { PRICING } from '@/lib/types';
import { fetchMyTutorPoints, qkMyTutorPoints } from '@/lib/tutor-points';
import { calculateStreak } from '@/lib/streak';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useSubscription } from '@/providers/subscription-provider';
import { useTheme } from '@/providers/theme-provider';

export default function ProfileScreen() {
  const { session, signOut } = useSession();
  const { pets, activePet, setActivePet } = useActivePet();
  const { theme } = useTheme();
  const { isPro } = useSubscription();
  const router = useRouter();
  const userId = session?.user.id;

  const profileQuery = useQuery({
    queryKey: userId ? qk.profile(userId) : ['profile', 'anon'],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });

  const streakQuery = useQuery({
    queryKey: userId ? qk.userStreak(userId) : ['user-streak', 'anon'],
    queryFn: () => fetchUserPostDates(userId!),
    enabled: !!userId,
  });

  // Nível de Tutor — total de PT do ledger (saúde + missão + social).
  const tutorPtsQuery = useQuery({
    queryKey: qkMyTutorPoints,
    queryFn: fetchMyTutorPoints,
    staleTime: 60_000,
    enabled: !!userId,
  });
  const tutorPoints = tutorPtsQuery.data;

  const streak = streakQuery.data
    ? calculateStreak(streakQuery.data)
    : { current: 0, longest: 0, postedToday: false };

  const profile = profileQuery.data;
  const totalPosts = streakQuery.data?.length ?? 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={
              profileQuery.isRefetching ||
              streakQuery.isRefetching ||
              tutorPtsQuery.isRefetching
            }
            onRefresh={() => {
              profileQuery.refetch();
              streakQuery.refetch();
              tutorPtsQuery.refetch();
            }}
            tintColor={theme.brand}
          />
        }
      >
        {/* Botão home (Mozart) no topo, igual às outras telas */}
        <View style={{ paddingHorizontal: 8, paddingTop: 2, paddingBottom: 2 }}>
          <HeaderHomeIcon />
        </View>
        {/* Hero — banner + avatar + nome + stats + editar */}
        <TutorProfileHero
          profile={profile}
          email={session?.user.email}
          isPro={isPro}
          stats={{
            pets_count: pets.length,
            posts_count: totalPosts,
            streak_current: streak.current,
          }}
        />

        {/* Streak detalhado (longest / posted today indicator) */}
        {streak.current > 0 || streak.longest > 0 ? (
          <CenteredColumn maxWidth={540}>
            <View style={{ marginTop: 12 }}>
              <StreakBadge
                current={streak.current}
                longest={streak.longest}
                postedToday={streak.postedToday}
              />
            </View>
          </CenteredColumn>
        ) : null}

        {/* Nível de Tutor — total de PT (toque pra ver de onde vêm) */}
        {tutorPoints != null ? (
          <CenteredColumn maxWidth={540}>
            <View style={{ marginTop: 12 }}>
              <TutorLevelBar
                points={tutorPoints}
                onPress={() => router.push('/(app)/tutor-points' as never)}
              />
            </View>
          </CenteredColumn>
        ) : null}

        {/* Pet Pro card / Premium ativo */}
        <CenteredColumn maxWidth={540}>
          {!isPro ? (
            <Link href={'/(app)/pro' as never} asChild>
              <Pressable
                style={{
                  marginTop: 14,
                  backgroundColor: '#1A1410',
                  borderRadius: 18,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  overflow: 'hidden',
                }}
              >
                {/* Estrela decorativa */}
                <Text
                  style={{
                    position: 'absolute',
                    top: -10,
                    right: -10,
                    fontSize: 60,
                    opacity: 0.08,
                    transform: [{ rotate: '15deg' }],
                  }}
                >
                  ⭐
                </Text>
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
                  <Text style={{ fontSize: 22 }}>⭐</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontFamily: FONTS.display, fontSize: 17, color: '#fff' }}>
                      Pet Pro
                    </Text>
                    <PremiumBadge size={14} />
                  </View>
                  <Text
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 12,
                      color: '#D4D4D4',
                      marginTop: 2,
                    }}
                  >
                    Pets ilimitados, posts à vontade e mais — R${' '}
                    {PRICING.monthlyBRL.toFixed(2).replace('.', ',')}/mês
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
              </Pressable>
            </Link>
          ) : (
            <Link href={'/(app)/account' as never} asChild>
              <Pressable
                style={{
                  marginTop: 14,
                  backgroundColor: theme.brandSurface,
                  borderRadius: 18,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  borderWidth: 1,
                  borderColor: theme.brandLight,
                }}
              >
                <PremiumBadge size={28} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.brandDark }}>
                    Pet Pro Ativo
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.brandDark }}>
                    Toque pra gerenciar sua assinatura
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.brandDark} />
              </Pressable>
            </Link>
          )}
        </CenteredColumn>

        {/* Meus pets */}
        <MyPetsSection
          pets={pets}
          activePetId={activePet?.id}
          onSelectPet={setActivePet}
        />

        {/* Quick links grid */}
        <ProfileQuickLinks />

        {/* Theme switcher */}
        <ThemeSwitcher />

        {/* Motion switcher (acessibilidade) */}
        <MotionSwitcher />

        {/* Sair */}
        <CenteredColumn maxWidth={540}>
          <View style={{ marginTop: 24 }}>
            <Button title="Sair" variant="secondary" onPress={signOut} fullWidth />
          </View>
        </CenteredColumn>
      </ScrollView>
    </SafeAreaView>
  );
}
