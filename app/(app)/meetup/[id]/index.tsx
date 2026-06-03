import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { PetAvatar } from '@/components/pet-avatar';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/clipboard';
import { meetupCategoryEmoji, meetupCategoryLabel } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { haptic } from '@/lib/haptics';
import { buildIcs, countdownPalette, meetupCountdown } from '@/lib/meetup-countdown';
import { clearRsvp, deleteMeetup, fetchMeetup, qk, setRsvp } from '@/lib/queries';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/providers/toast-provider';

export default function MeetupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activePet, pets } = useActivePet();
  const { session } = useSession();
  const toast = useToast();
  const qc = useQueryClient();

  const meetupQuery = useQuery({
    queryKey: qk.meetup(id),
    queryFn: () => fetchMeetup(id, activePet!.id),
    enabled: !!id && !!activePet,
  });

  const goingMutation = useMutation({
    mutationFn: () =>
      meetupQuery.data?.my_rsvp_status === 'going'
        ? clearRsvp(id, activePet!.id)
        : setRsvp(id, activePet!.id, 'going'),
    onMutate: () => haptic.medium(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.meetup(id) });
      qc.invalidateQueries({ queryKey: ['meetups'] });
      if (meetupQuery.data?.my_rsvp_status !== 'going') {
        toast.success('Presença confirmada!', 'A turma vai te ver lá 🐾');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMeetup(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetups'] });
      router.back();
    },
    onError: (e) => Alert.alert('Erro', e instanceof Error ? e.message : 'Tente novamente.'),
  });

  const m = meetupQuery.data;
  if (!m) return null;
  const going = m.rsvps.filter((r) => r.status === 'going');
  const date = new Date(m.starts_at);
  const im_going = m.my_rsvp_status === 'going';

  // Verifica se o usuário é dono do pet host
  const isHost = pets.some((p) => p.id === m.host_pet_id) && m.host_pet.owner_id === session?.user.id;

  const countdown = meetupCountdown(m.starts_at);
  const cdPalette = countdownPalette(countdown.tone);

  const openMapsRoute = () => {
    const q = encodeURIComponent(m.location_name);
    const url = Platform.select({
      ios: `maps://?daddr=${q}&dirflg=d`,
      android: `google.navigation:q=${q}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    });
    Linking.openURL(url!).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`);
    });
  };

  const openWaze = () => {
    const q = encodeURIComponent(m.location_name);
    Linking.openURL(`https://waze.com/ul?q=${q}&navigate=yes`).catch(() => {});
  };

  const addToCalendar = () => {
    const ics = buildIcs({
      uid: m.id,
      title: m.title,
      description: m.description ?? `Encontro pet · host: ${m.host_pet.name}`,
      location: m.location_name,
      starts_at: m.starts_at,
      duration_min: 60,
    });
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = m.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      a.href = url;
      a.download = `${slug || 'meetup'}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Arquivo .ics baixado!', 'Abre o arquivo pra adicionar ao calendário.');
    } else {
      toast.info('Em breve', 'Adicionar ao calendário disponível em breve no app mobile.');
    }
  };

  const handleShare = async () => {
    const dateStr = format(new Date(m.starts_at), "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR });
    const full = `${m.title}\n${meetupCategoryLabel(m.category)} · ${dateStr}\n📍 ${m.location_name}${m.description ? `\n\n${m.description}` : ''}\n\nHost: ${m.host_pet.name}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: m.title, text: full });
        return;
      } catch {}
    }
    const ok = await copyToClipboard(full);
    if (ok) toast.success('Copiado!', 'Cola onde quiser pra compartilhar.');
  };

  const showHostMenu = () => {
    Alert.alert('Opções do encontro', undefined, [
      {
        text: 'Editar',
        onPress: () =>
          router.push({ pathname: '/meetup/[id]/edit' as never, params: { id } as never }),
      },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Excluir encontro?', 'Essa ação não pode ser desfeita.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Excluir', style: 'destructive', onPress: () => deleteMutation.mutate() },
          ]),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <ScrollView contentContainerClassName="pb-12">
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 8 }}>
              <Pressable hitSlop={10} onPress={handleShare}>
                <Ionicons name="share-outline" size={22} color="#F97316" />
              </Pressable>
              {isHost ? (
                <Pressable hitSlop={10} onPress={showHostMenu} style={{ paddingLeft: 4 }}>
                  <Ionicons name="ellipsis-horizontal" size={22} color="#111" />
                </Pressable>
              ) : null}
            </View>
          ),
        }}
      />

      {/* Countdown banner — destaque por urgência */}
      <View
        style={{
          backgroundColor: cdPalette.bg,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: '#FFFFFF',
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: cdPalette.accent,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 14,
              color: cdPalette.fg,
            }}
          >
            {countdown.label}
          </Text>
          {countdown.sub ? (
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 11,
                color: cdPalette.fg,
                opacity: 0.8,
                marginTop: 1,
              }}
            >
              {countdown.sub}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="bg-white px-4 py-4">
        <View className="mb-2 flex-row flex-wrap items-center gap-2">
          <View className="rounded-full bg-brand-light px-3 py-1">
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#C2410C' }}>
              {format(date, "EEE, dd 'de' MMM • HH:mm", { locale: ptBR })}
            </Text>
          </View>
          <View className="flex-row items-center gap-1 rounded-full bg-neutral-100 px-3 py-1">
            <Text style={{ fontSize: 11 }}>{meetupCategoryEmoji(m.category)}</Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#404040' }}>
              {meetupCategoryLabel(m.category)}
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: FONTS.display, fontSize: 26, lineHeight: 30, color: '#1A1410' }}>
          {m.title}
        </Text>
        <Pressable
          onPress={openMapsRoute}
          className="mt-2 flex-row items-center gap-1.5 self-start rounded-lg active:opacity-70"
        >
          <Ionicons name="location-outline" size={18} color="#F97316" />
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#C2410C' }}>
            {m.location_name}
          </Text>
          <Ionicons name="open-outline" size={14} color="#C2410C" />
        </Pressable>
        {m.description ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 20, color: '#525252', marginTop: 12 }}>
            {m.description}
          </Text>
        ) : null}
        <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-neutral-50 p-3">
          <PetAvatar pet={m.host_pet} size={36} animation="wag" />
          <View>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#737373' }}>Host</Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#1A1410' }}>
              {m.host_pet.name}
            </Text>
          </View>
        </View>

        {/* CTAs auxiliares — routing + waze + calendar */}
        {countdown.tone !== 'past' ? (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
            <Pressable
              onPress={openMapsRoute}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: '#F97316',
              }}
            >
              <Ionicons name="navigate" size={14} color="#FFFFFF" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#FFFFFF' }}>
                Como chegar
              </Text>
            </Pressable>
            <Pressable
              onPress={openWaze}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#E5E5E5',
                backgroundColor: '#FFFFFF',
              }}
            >
              <Text style={{ fontSize: 13 }}>🚗</Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#404040' }}>
                Waze
              </Text>
            </Pressable>
            <Pressable
              onPress={addToCalendar}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#E5E5E5',
                backgroundColor: '#FFFFFF',
              }}
            >
              <Ionicons name="calendar-outline" size={14} color="#404040" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#404040' }}>
                Calendário
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mt-4">
          <Button
            title={im_going ? 'Cancelar presença' : 'Confirmar presença'}
            variant={im_going ? 'secondary' : 'primary'}
            onPress={() => goingMutation.mutate()}
            loading={goingMutation.isPending}
            fullWidth
          />
        </View>
      </View>

      <View className="mt-4 px-4">
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 11,
            letterSpacing: 1.4,
            color: '#F97316',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Confirmados ({going.length})
        </Text>
        {going.length === 0 ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#737373' }}>
            Ninguém confirmou ainda. Seja o primeiro!
          </Text>
        ) : (
          <View className="flex-row flex-wrap gap-3">
            {going.map((r) => (
              <View key={r.pet_id} className="items-center">
                <PetAvatar pet={r.pet} size={52} animation="breathe" />
                <Text
                  style={{
                    fontFamily: FONTS.bodyMedium,
                    fontSize: 11,
                    color: '#404040',
                    marginTop: 4,
                    maxWidth: 64,
                  }}
                  numberOfLines={1}
                >
                  {r.pet.name}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
