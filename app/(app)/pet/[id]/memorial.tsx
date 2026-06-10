import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Dimensions, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { PetAvatar } from '@/components/pet-avatar';
import { Button } from '@/components/ui/button';
import { speciesLabel } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import {
  fetchMemorialMessages,
  fetchPet,
  fetchPostsByPet,
  markPetAsMemorial,
  postMemorialMessage,
  qk,
  unmarkPetMemorial,
} from '@/lib/queries';
import type { MemorialMessageWithProfile } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const { width: SCREEN_W } = Dimensions.get('window');

export default function MemorialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { session } = useSession();

  const { activePet } = useActivePet();
  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });
  const msgQuery = useQuery({
    queryKey: qk.memorialMessages(id),
    queryFn: () => fetchMemorialMessages(id),
    enabled: !!id,
  });
  // Galeria de memórias — usa posts do próprio pet
  const postsQuery = useQuery({
    queryKey: qk.petPosts(id, activePet?.id ?? id),
    queryFn: () => fetchPostsByPet(id, activePet?.id ?? id),
    enabled: !!id,
  });

  // Pega até 9 fotos pra grid 3x3 (cover media do post)
  const memoryPhotos = useMemo(() => {
    const posts = postsQuery.data ?? [];
    return posts
      .map((p) => p.media?.[0])
      .filter((m): m is NonNullable<typeof m> => !!m && m.media_type === 'image')
      .slice(0, 9);
  }, [postsQuery.data]);

  const [draft, setDraft] = useState('');

  const sendMut = useMutation({
    mutationFn: () => postMemorialMessage(id, session!.user.id, draft),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: qk.memorialMessages(id) });
      toast.success('Mensagem postada 🕊️');
    },
  });

  const markMut = useMutation({
    mutationFn: () => markPetAsMemorial(id, new Date().toISOString().split('T')[0]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.pet(id) });
      toast.success('Espaço de memorial criado 🌈', 'Que ele/ela descanse em paz');
    },
  });

  const unmarkMut = useMutation({
    mutationFn: () => unmarkPetMemorial(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.pet(id) });
      toast.success('Memorial removido');
      router.back();
    },
  });

  const pet = petQuery.data;
  if (!pet) return null;

  const isOwner = pet.owner_id === session?.user.id;
  const isMemorial = !!pet.memorial_at;

  // Se o pet ainda não foi marcado como memorial, só dono pode marcar
  if (!isMemorial) {
    if (!isOwner) {
      router.back();
      return null;
    }
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Stack.Screen options={{ title: 'Memorial', headerShown: true }} />
        <ScrollView contentContainerStyle={{ padding: 22, gap: 14, paddingTop: 40 }}>
          <View style={{ alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Text style={{ fontSize: 72 }}>🌈</Text>
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: 24,
                color: theme.text,
                textAlign: 'center',
              }}
            >
              Criar memorial para {pet.name}?
            </Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                color: theme.textDim,
                textAlign: 'center',
                lineHeight: 20,
                paddingHorizontal: 16,
              }}
            >
              Um espaço pra honrar a memória dele(a). Outros tutores podem deixar mensagens carinhosas.
              {'\n\n'}O perfil continua visível mas com aviso de &quot;Em memória&quot;.
            </Text>
          </View>

          <Button
            title="🌈 Criar memorial"
            onPress={() =>
              Alert.alert(
                `Memorial para ${pet.name}`,
                'Esta ação cria um espaço de homenagem permanente. Você pode reverter depois.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Criar memorial', onPress: () => markMut.mutate() },
                ],
              )
            }
            fullWidth
          />
          <Button
            title="Voltar"
            variant="secondary"
            onPress={() => router.back()}
            fullWidth
          />
        </ScrollView>
      </View>
    );
  }

  const messages = msgQuery.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F3F0' }}>
      <Stack.Screen options={{ title: '', headerShown: true, headerTransparent: true }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40, gap: 16 }}>
        {/* Hero memorial */}
        <View style={{ alignItems: 'center', gap: 14, paddingVertical: 24 }}>
          <Text style={{ fontSize: 48 }}>🌈</Text>
          <View
            style={{
              padding: 6,
              borderRadius: 100,
              backgroundColor: '#fff',
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <View style={{ opacity: 0.7 }}>
              <PetAvatar pet={pet} size={140} />
            </View>
          </View>
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 30,
              color: '#1A1410',
              textAlign: 'center',
            }}
          >
            {pet.name}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: '#737373',
              textAlign: 'center',
            }}
          >
            {speciesLabel(pet.species)}
            {pet.breed ? ` • ${pet.breed}` : ''}
          </Text>
          {pet.birthdate ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#737373' }}>
              {format(parseISO(pet.birthdate), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
              {pet.memorial_at
                ? ` — ${format(parseISO(pet.memorial_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}`
                : ''}
            </Text>
          ) : null}
          <View
            style={{
              marginTop: 6,
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: '#fff',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="flower" size={14} color="#9333EA" />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#9333EA' }}>
              Em memória
            </Text>
          </View>
        </View>

        {/* Galeria de memórias — fotos do pet */}
        {memoryPhotos.length > 0 ? (
          <View style={{ gap: 10, marginTop: 10 }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                letterSpacing: 1.4,
                color: '#737373',
                textTransform: 'uppercase',
                marginLeft: 4,
              }}
            >
              📷 Memórias eternas
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {memoryPhotos.map((m) => {
                const size = (SCREEN_W - 40 - 12) / 3;
                return (
                  <View
                    key={m.id}
                    style={{
                      width: size,
                      height: size,
                      borderRadius: 12,
                      overflow: 'hidden',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <Image
                      source={{ uri: m.url }}
                      style={{ width: '100%', height: '100%', opacity: 0.92 }}
                      contentFit="cover"
                    />
                  </View>
                );
              })}
            </View>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 11,
                color: '#737373',
                textAlign: 'center',
                marginTop: 2,
              }}
            >
              {memoryPhotos.length} {memoryPhotos.length === 1 ? 'momento guardado' : 'momentos guardados'} pra sempre 🌈
            </Text>
          </View>
        ) : null}

        {/* Compose */}
        {session ? (
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 14,
              gap: 10,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#1A1410' }}>
              Deixe uma mensagem 🕯️
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={`Conta sua história com ${pet.name}, uma memória especial, qualquer carinho...`}
              placeholderTextColor="#A3A3A3"
              multiline
              maxLength={500}
              style={{
                minHeight: 80,
                backgroundColor: '#FAFAFA',
                borderRadius: 12,
                padding: 12,
                fontFamily: FONTS.body,
                fontSize: 14,
                color: '#1A1410',
                textAlignVertical: 'top',
              }}
            />
            <Button
              title="Postar mensagem"
              onPress={() => sendMut.mutate()}
              disabled={!draft.trim() || sendMut.isPending}
              loading={sendMut.isPending}
              fullWidth
            />
          </View>
        ) : null}

        {/* Messages */}
        <View style={{ gap: 10 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.4,
              color: '#737373',
              textTransform: 'uppercase',
              marginLeft: 4,
            }}
          >
            {messages.length} {messages.length === 1 ? 'mensagem' : 'mensagens'} de carinho
          </Text>
          {messages.map((m) => (
            <MessageCard key={m.id} message={m} />
          ))}
        </View>

        {/* Dono: opção de remover memorial */}
        {isOwner ? (
          <Pressable
            onPress={() =>
              Alert.alert(
                'Remover memorial?',
                'Vai voltar ao perfil normal. Mensagens permanecem.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Remover', style: 'destructive', onPress: () => unmarkMut.mutate() },
                ],
              )
            }
            style={{ alignItems: 'center', paddingVertical: 16, marginTop: 12 }}
          >
            <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#737373' }}>
              Remover memorial
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function MessageCard({ message }: { message: MemorialMessageWithProfile }) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        gap: 6,
        borderLeftWidth: 3,
        borderLeftColor: '#9333EA',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#1A1410' }}>
          {message.profile.display_name}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3' }}>
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ptBR })}
        </Text>
      </View>
      <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: '#404040', lineHeight: 20 }}>
        {message.message}
      </Text>
    </View>
  );
}
