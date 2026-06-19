import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Dimensions, Pressable, ScrollView, Share, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Confetti } from '@/components/confetti';
import { PetAvatar } from '@/components/pet-avatar';
import { FONTS } from '@/lib/fonts';
import { birthdayYears, daysUntilBirthday, isBirthdayToday, petAgeText } from '@/lib/pet-age';
import { fetchPet, fetchPostsByPet, qk } from '@/lib/queries';
import { petUrl } from '@/lib/share';
import { ScreenLoading } from '@/components/screen-loading';
import { useActivePet } from '@/providers/active-pet-provider';
import { useTheme } from '@/providers/theme-provider';

const { width: SCREEN_W } = Dimensions.get('window');

export default function BirthdayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const { activePet } = useActivePet();

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });
  const postsQuery = useQuery({
    queryKey: qk.petPosts(id, activePet?.id ?? id),
    queryFn: () => fetchPostsByPet(id, activePet?.id ?? id),
    enabled: !!id,
  });

  const pet = petQuery.data;
  const posts = postsQuery.data ?? [];
  const firstPostMedia = posts.length > 0 ? posts[posts.length - 1].media[0] : null;
  const recentPostMedia = posts.length > 0 ? posts[0].media[0] : null;

  // Animação do "Parabéns" pulando
  const scale = useSharedValue(0.85);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0.92, { duration: 800, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const balloonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (petQuery.isLoading) return <ScreenLoading />;
  if (!pet) return null;

  const years = birthdayYears(pet.birthdate);
  const isToday = isBirthdayToday(pet.birthdate);
  const daysUntil = daysUntilBirthday(pet.birthdate);
  const ageNow = petAgeText(pet.birthdate);

  const onShare = async () => {
    try {
      const headline = isToday
        ? `🎂 Hoje é ${years ? years + ' anos' : 'aniversário'} do(a) ${pet.name}! 🎉`
        : daysUntil !== null && daysUntil <= 30
          ? `🎂 Aniversário do(a) ${pet.name} em ${daysUntil} dias!`
          : `🐾 ${pet.name}, ${ageNow ?? 'um pet incrível'}`;
      await Share.share({
        title: `${pet.name}`,
        message: `${headline}\n\nVeja a história desse pet no Maestro Pet:\n${petUrl(pet.id)}`,
      });
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Tente de novo');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FEF3C7' }}>
      <Stack.Screen options={{ title: '', headerTransparent: true, headerTintColor: '#92400E' }} />

      {/* Confetti caindo */}
      <Confetti count={isToday ? 60 : 30} />

      <ScrollView contentContainerStyle={{ paddingTop: 80, paddingBottom: 40, alignItems: 'center' }}>
        <Animated.View style={balloonStyle}>
          <Text style={{ fontSize: 72 }}>🎂</Text>
        </Animated.View>

        <Text
          style={{
            fontFamily: FONTS.display,
            fontSize: 36,
            color: '#92400E',
            textAlign: 'center',
            marginTop: 10,
          }}
        >
          {isToday
            ? `Hoje é dia\nde ${pet.name}!`
            : daysUntil !== null && daysUntil <= 30
              ? `Em ${daysUntil} ${daysUntil === 1 ? 'dia' : 'dias'}\né ${pet.name}!`
              : `${pet.name}`}
        </Text>

        {/* Badge principal — anos completados hoje OU contador de dias */}
        {isToday && years ? (
          <View
            style={{
              marginTop: 12,
              backgroundColor: '#F59E0B',
              paddingHorizontal: 22,
              paddingVertical: 8,
              borderRadius: 999,
            }}
          >
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#fff' }}>
              {years} {years === 1 ? 'aninho' : 'anos'} 🎉
            </Text>
          </View>
        ) : daysUntil !== null && daysUntil > 0 && daysUntil <= 30 ? (
          <View
            style={{
              marginTop: 12,
              backgroundColor: '#FFFFFF',
              paddingHorizontal: 22,
              paddingVertical: 10,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: '#F59E0B',
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#92400E' }}>
              ⏳ Faltam {daysUntil} {daysUntil === 1 ? 'dia' : 'dias'}
            </Text>
          </View>
        ) : null}

        {/* Idade exata sempre que tiver birthdate */}
        {ageNow ? (
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: '#92400E',
              marginTop: 8,
              opacity: 0.85,
            }}
          >
            {isToday ? 'Hoje completa' : 'Tem'} {ageNow}
          </Text>
        ) : null}

        {/* Then & Now */}
        {firstPostMedia && recentPostMedia && firstPostMedia.id !== recentPostMedia.id ? (
          <View style={{ marginTop: 32, paddingHorizontal: 16, width: '100%' }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 12,
                letterSpacing: 1.4,
                color: '#92400E',
                textTransform: 'uppercase',
                marginBottom: 10,
                textAlign: 'center',
              }}
            >
              Olha como cresceu 💛
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
              <ThenNowCard label="Primeira foto" url={firstPostMedia.url} accent="#92400E" />
              <ThenNowCard label="Hoje" url={recentPostMedia.url} accent="#F59E0B" />
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: 32, alignItems: 'center', gap: 8 }}>
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 100,
              padding: 6,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <PetAvatar pet={pet} size={120} />
          </View>
          <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#1A1410' }}>
            {pet.name}
          </Text>
        </View>

        {/* Wishes */}
        <View style={{ marginTop: 28, paddingHorizontal: 22, gap: 10, width: '100%' }}>
          <Wish text="Muitos passeios e biscoitos 🦴" />
          <Wish text="Casa cheia de amor e brinquedos 🎾" />
          <Wish text="Saúde de sobra pra mais muitos anos 💛" />
        </View>

        {/* Share button */}
        <View style={{ marginTop: 32, width: '100%', paddingHorizontal: 22 }}>
          <Pressable
            onPress={onShare}
            style={{
              backgroundColor: '#F59E0B',
              borderRadius: 999,
              paddingVertical: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              shadowColor: '#F59E0B',
              shadowOpacity: 0.4,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <Ionicons name="share" size={20} color="#fff" />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#fff' }}>
              Compartilhar o aniversário
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{ marginTop: 20, paddingVertical: 8 }}
        >
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#92400E' }}>
            Voltar ao perfil
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function ThenNowCard({ label, url, accent }: { label: string; url: string; accent: string }) {
  const size = Math.min((SCREEN_W - 50) / 2, 160);
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 3,
          borderColor: accent,
        }}
      >
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      </View>
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 11,
          letterSpacing: 1,
          color: accent,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function Wish({ text }: { text: string }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.7)',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: '#78350F', flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}
