import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Email inválido');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const redirectTo =
        Platform.OS === 'web'
          ? `${globalThis.location.origin}/reset-password`
          : 'petsocial://reset-password';
      const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
      if (err) throw err;
      setSent(true);
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-5xl">📬</Text>
          <Text className="mt-4 text-center text-2xl font-bold text-neutral-900">
            Verifica seu email
          </Text>
          <Text className="mt-2 text-center text-base text-neutral-600">
            Mandamos um link pra <Text className="font-semibold">{email.trim()}</Text>. Abre o email e clica
            pra redefinir sua senha.
          </Text>
          <View className="mt-6 w-full max-w-sm gap-3">
            <Button title="Voltar pro login" onPress={() => router.replace('/(auth)/sign-in')} fullWidth />
            <Button
              title="Mandar de novo"
              variant="ghost"
              onPress={() => {
                setSent(false);
                onSubmit();
              }}
              fullWidth
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6"
      >
        <View className="mb-8">
          <Text className="text-4xl">🔑</Text>
          <Text className="mt-2 text-3xl font-bold text-neutral-900">Esqueceu a senha?</Text>
          <Text className="mt-1 text-base text-neutral-600">
            Digita seu email que mandamos um link pra você redefinir.
          </Text>
        </View>

        <View className="gap-3">
          <Input
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="voce@email.com"
            value={email}
            onChangeText={setEmail}
            error={error ?? undefined}
          />
          <Button title="Enviar link" onPress={onSubmit} loading={submitting} fullWidth />
        </View>

        <View className="mt-8 flex-row justify-center gap-1">
          <Text className="text-neutral-600">Lembrou a senha?</Text>
          <Link href="/(auth)/sign-in" className="font-semibold text-brand-dark">
            Voltar pro login
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
