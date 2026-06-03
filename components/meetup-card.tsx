import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { meetupCategoryEmoji, meetupCategoryLabel } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import type { MeetupWithDetails } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

import { PetAvatar } from './pet-avatar';

export function MeetupCard({ meetup }: { meetup: MeetupWithDetails }) {
  const date = new Date(meetup.starts_at);
  const { theme } = useTheme();
  return (
    <Link href={{ pathname: '/meetup/[id]', params: { id: meetup.id } }} asChild>
      <Pressable
        style={{
          marginBottom: 12,
          borderRadius: 16,
          backgroundColor: theme.card,
          padding: 16,
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        <View className="mb-2 flex-row flex-wrap items-center gap-2">
          <View className="rounded-full bg-brand-light px-2.5 py-1">
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#C2410C' }}>
              {format(date, "EEE, dd 'de' MMM • HH:mm", { locale: ptBR })}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: theme.borderLight,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            <Text style={{ fontSize: 11 }}>{meetupCategoryEmoji(meetup.category)}</Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: theme.textMuted }}>
              {meetupCategoryLabel(meetup.category)}
            </Text>
          </View>
          {meetup.my_rsvp_status === 'going' ? (
            <View className="rounded-full bg-green-100 px-2.5 py-1">
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#15803d' }}>
                Você vai
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: theme.text, lineHeight: 22 }}>
          {meetup.title}
        </Text>
        <View className="mt-1 flex-row items-center gap-1.5">
          <Ionicons name="location-outline" size={16} color={theme.textDim} />
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted }}>
            {meetup.location_name}
          </Text>
        </View>
        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <PetAvatar pet={meetup.host_pet} size={28} animation="wag" />
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted }}>
              Host:{' '}
              <Text style={{ fontFamily: FONTS.bodyBold, color: theme.text }}>
                {meetup.host_pet.name}
              </Text>
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="paw" size={14} color={theme.textDim} />
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: theme.textMuted }}>
              {meetup.rsvps_count} confirmados
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
