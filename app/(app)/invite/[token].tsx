import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { CenteredColumn } from '@/components/ui/centered-column';
import { FONTS } from '@/lib/fonts';
import { acceptCaretakerInvite } from '@/lib/queries';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

/**
 * Tela de aceitar convite via link/QR.
 * URL: /invite/[token] → chama RPC accept_caretaker_invite e leva pro pet.
 */
export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { session } = useSession();
  const { theme } = useTheme();
  const [state, setState] = useState<'ready' | 'loading' | 'success' | 'error'>('ready');
  const [errorMsg, setErrorMsg] = useState('');
  const [petId, setPetId] = useState<string | null>(null);

  const acceptMutation = useMutation({
    mutationFn: () => acceptCaretakerInvite(token),
    onMutate: () => setState('loading'),
    onSuccess: (pid) => {
      setPetId(pid);
      setState('success');
    },
    onError: (e) => {
      setErrorMsg(e instanceof Error ? e.message : 'Não foi possível aceitar o convite');
      setState('error');
    },
  });

  // Se não tem sessão, redireciona pro login (depois volta pra cá)
  useEffect(() => {
    if (!session) {
      // Em produção, salvar o destino e redirecionar pra (auth)/sign-in
      // Por enquanto, deixa o user clicar manualmente
    }
  }, [session]);

  const handleAccept = () => {
    if (!session) {
      router.push('/(auth)/sign-in' as never);
      return;
    }
    acceptMutation.mutate();
  };

  const handleGoToPet = () => {
    if (petId) {
      router.replace({ pathname: '/pet/[id]' as never, params: { id: petId } as never });
    } else {
      router.replace('/(app)/(tabs)' as never);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Convite', headerBackTitle: 'Voltar' }} />

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <CenteredColumn maxWidth={420}>
          <View style={{ paddingHorizontal: 16, gap: 16, alignItems: 'center' }}>
            {state === 'loading' ? (
              <>
                <ActivityIndicator size="large" color={theme.brand} />
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 14,
                    color: theme.textDim,
                  }}
                >
                  Aceitando convite...
                </Text>
              </>
            ) : state === 'success' ? (
              <>
                <Animated.View entering={FadeInDown.duration(400)}>
                  <View
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: 48,
                      backgroundColor: '#DCFCE7',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 50 }}>🎉</Text>
                  </View>
                </Animated.View>
                <Animated.View entering={FadeInUp.delay(150).duration(400)} style={{ alignItems: 'center', gap: 8 }}>
                  <Text
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: 26,
                      color: theme.text,
                      letterSpacing: -0.5,
                      textAlign: 'center',
                    }}
                  >
                    Você entrou no time! 🐾
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 14,
                      color: theme.textDim,
                      textAlign: 'center',
                      paddingHorizontal: 24,
                    }}
                  >
                    Agora você pode ajudar a cuidar e ver a agenda completa.
                  </Text>
                </Animated.View>
                <View style={{ width: '100%', marginTop: 8 }}>
                  <Button title="Ver perfil do pet" onPress={handleGoToPet} fullWidth />
                </View>
              </>
            ) : state === 'error' ? (
              <>
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: '#FEE2E2',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="alert" size={50} color="#991B1B" />
                </View>
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Text
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: 22,
                      color: theme.text,
                      letterSpacing: -0.4,
                      textAlign: 'center',
                    }}
                  >
                    Convite inválido
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 13,
                      color: theme.textDim,
                      textAlign: 'center',
                      paddingHorizontal: 24,
                    }}
                  >
                    {errorMsg || 'Esse link já foi usado ou expirou. Peça um novo pro dono do pet.'}
                  </Text>
                </View>
                <View style={{ width: '100%', marginTop: 4 }}>
                  <Button
                    title="Ir pra home"
                    variant="secondary"
                    onPress={() => router.replace('/(app)/(tabs)' as never)}
                    fullWidth
                  />
                </View>
              </>
            ) : (
              <>
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    backgroundColor: theme.brandLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 50 }}>🤝</Text>
                </View>
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Text
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: 26,
                      color: theme.text,
                      letterSpacing: -0.5,
                      textAlign: 'center',
                    }}
                  >
                    Você foi convidado(a) 🐾
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 14,
                      color: theme.textDim,
                      textAlign: 'center',
                      paddingHorizontal: 24,
                      lineHeight: 20,
                    }}
                  >
                    Aceite pra ajudar a cuidar de um pet:{'\n'}ver agenda, marcar eventos e
                    anexar fotos.
                  </Text>
                </View>
                <View style={{ width: '100%', marginTop: 4 }}>
                  <Button title="Aceitar convite" onPress={handleAccept} fullWidth />
                  {!session ? (
                    <Pressable
                      onPress={() => router.push('/(auth)/sign-in' as never)}
                      style={{ paddingVertical: 12, alignItems: 'center', marginTop: 4 }}
                    >
                      <Text
                        style={{
                          fontFamily: FONTS.body,
                          fontSize: 13,
                          color: theme.textDim,
                        }}
                      >
                        Você precisa estar logado.{' '}
                        <Text style={{ fontFamily: FONTS.bodyBold, color: theme.brand }}>
                          Entrar
                        </Text>
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            )}
          </View>
        </CenteredColumn>
      </View>
    </View>
  );
}
