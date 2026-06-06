import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, Text, View } from 'react-native';

import { AnimatedPet } from '@/components/animated-pet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Screen } from '@/components/ui/screen';
import { FONTS } from '@/lib/fonts';
import { signUpSchema } from '@/lib/validators';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/providers/toast-provider';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useSession();
  const toast = useToast();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<{
    display_name?: string;
    email?: string;
    password?: string;
    terms?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const parsed = signUpSchema.safeParse({ display_name: displayName, email, password });
    const fieldErrors: typeof errors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path[0] as keyof typeof errors] = issue.message;
      }
    }
    if (!acceptedTerms) {
      fieldErrors.terms = 'Você precisa aceitar os termos pra continuar';
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    if (!parsed.success) return; // não deveria, mas safety
    setLoading(true);
    try {
      await signUp(parsed.data.email, parsed.data.password, parsed.data.display_name);
      router.replace('/(app)/phone');
    } catch (e) {
      toast.error('Erro ao criar conta', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6"
      >
        <View className="mb-8">
          <View className="mb-2 flex-row items-center gap-1">
            <AnimatedPet kind="dog" size={36} delay={0} />
            <AnimatedPet kind="rabbit" size={36} delay={300} />
            <AnimatedPet kind="parrot" size={36} delay={600} />
          </View>
          <Text style={{ fontFamily: FONTS.display, fontSize: 36, color: '#1A1410', marginTop: 8 }}>
            Cadastre seu pet em 30s
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 15, color: '#525252', marginTop: 4 }}>
            Calendário de saúde pronto na hora — é grátis.
          </Text>
        </View>

        <View className="gap-3">
          <Input
            label="Seu nome"
            placeholder="Como podemos te chamar"
            value={displayName}
            onChangeText={setDisplayName}
            error={errors.display_name}
            returnKeyType="next"
          />
          <Input
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="voce@email.com"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            returnKeyType="next"
          />
          <PasswordInput
            label="Senha"
            autoComplete="password-new"
            placeholder="No mínimo 6 caracteres"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            showStrength
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />

          {/* Aceite de termos */}
          <Pressable
            onPress={() => setAcceptedTerms((a) => !a)}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 10,
              paddingVertical: 8,
              paddingHorizontal: 4,
              marginTop: 4,
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            accessibilityLabel="Aceitar termos e política de privacidade"
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: errors.terms
                  ? '#DC2626'
                  : acceptedTerms
                    ? '#F97316'
                    : '#A8A29E',
                backgroundColor: acceptedTerms ? '#F97316' : '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              {acceptedTerms ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
            </View>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 13,
                color: '#525252',
                flex: 1,
                lineHeight: 18,
              }}
            >
              Li e aceito os{' '}
              <Text
                onPress={(e) => {
                  e.stopPropagation();
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.open('/legal/terms', '_blank');
                  } else {
                    Linking.openURL('/legal/terms').catch(() => {});
                  }
                }}
                style={{ fontFamily: FONTS.bodyBold, color: '#C2410C', textDecorationLine: 'underline' }}
              >
                Termos de Uso
              </Text>{' '}
              e a{' '}
              <Text
                onPress={(e) => {
                  e.stopPropagation();
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.open('/legal/privacy', '_blank');
                  } else {
                    Linking.openURL('/legal/privacy').catch(() => {});
                  }
                }}
                style={{ fontFamily: FONTS.bodyBold, color: '#C2410C', textDecorationLine: 'underline' }}
              >
                Política de Privacidade
              </Text>
              {'. '}Concedo licença ao Pet Social pra usar fotos, vídeos e dados do meu pet
              dentro do app (seção 3 dos Termos).
            </Text>
          </Pressable>
          {errors.terms ? (
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#DC2626', marginTop: -4 }}>
              {errors.terms}
            </Text>
          ) : null}

          <Button title="Criar conta" onPress={onSubmit} loading={loading} fullWidth />
        </View>

        <View className="mt-8 flex-row justify-center gap-1">
          <Text className="text-neutral-600">Já tem conta?</Text>
          <Link href="/(auth)/sign-in" className="font-semibold text-brand-dark">
            Entrar
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
