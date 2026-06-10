import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { meetupCategoryEmoji, meetupCategoryLabel } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { haptic } from '@/lib/haptics';
import { setRsvp } from '@/lib/queries';
import type { MeetupWithDetails } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';
import { useTheme } from '@/providers/theme-provider';

import { PetAvatar } from './pet-avatar';

export function MeetupCard({ meetup }: { meetup: MeetupWithDetails }) {
  const date = new Date(meetup.starts_at);
  const { theme } = useTheme();
  const { activePet } = useActivePet();
  const qc = useQueryClient();

  // RSVP otimista direto do card (estilo Scruff/eventos: "Vou" sem abrir o detalhe)
  const [going, setGoing] = useState(meetup.my_rsvp_status === 'going');
  const [count, setCount] = useState(meetup.rsvps_count);

  // Re-sincroniza com o servidor quando a query revalida (corrige estado otimista grudado)
  useEffect(() => {
    setGoing(meetup.my_rsvp_status === 'going');
    setCount(meetup.rsvps_count);
  }, [meetup.my_rsvp_status, meetup.rsvps_count]);

  const rsvpMutation = useMutation({
    mutationFn: (next: boolean) =>
      setRsvp(meetup.id, activePet!.id, next ? 'going' : 'not_going'),
    onError: () => {
      // reverte ao estado do servidor
      setGoing(meetup.my_rsvp_status === 'going');
      setCount(meetup.rsvps_count);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetups'] });
    },
  });

  const toggleRsvp = (e: { stopPropagation?: () => void; preventDefault?: () => void }) => {
    e.stopPropagation?.();
    e.preventDefault?.();
    if (!activePet) return;
    const next = !going;
    setGoing(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    haptic.light();
    rsvpMutation.mutate(next);
  };

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
            <PetAvatar pet={meetup.host_pet} size={28} />
            <View>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: theme.textMuted }}>
                Host:{' '}
                <Text style={{ fontFamily: FONTS.bodyBold, color: theme.text }}>
                  {meetup.host_pet.name}
                </Text>
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11.5, color: theme.textDim }}>
                🐾 {count} {count === 1 ? 'confirmado' : 'confirmados'}
              </Text>
            </View>
          </View>
          {/* Botão de RSVP rápido — confirma presença sem abrir o evento */}
          <Pressable
            onPress={toggleRsvp}
            hitSlop={6}
            disabled={!activePet}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: going ? '#DCFCE7' : theme.brand,
              opacity: activePet ? 1 : 0.5,
            }}
            accessibilityLabel={going ? `Cancelar presença em ${meetup.title}` : `Confirmar presença em ${meetup.title}`}
          >
            <Ionicons
              name={going ? 'checkmark-circle' : 'paw'}
              size={15}
              color={going ? '#15803D' : '#fff'}
            />
            <Text
              style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: going ? '#15803D' : '#fff' }}
            >
              {going ? 'Você vai' : 'Vou!'}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Link>
  );
}
