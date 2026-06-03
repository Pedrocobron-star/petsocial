import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/providers/toast-provider';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (password.length < 6) {
      setError('Senha precisa ter pelo menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não conferem');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      toast.success('Senha atualizada!', 'Você já tá logado com a nova senha.');
      router.replace('/(app)/(tabs)');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Tente novamente.';
      setError(msg);
      toast.error('Erro ao atualizar', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6"
      >
        <View className="mb-8">
          <Text className="text-4xl">🔐</Text>
          <Text className="mt-2 text-3xl font-bold text-neutral-900">Nova senha</Text>
          <Text className="mt-1 text-base text-neutral-600">
            Escolha uma senha forte e fácil de lembrar.
          </Text>
        </View>

        <View className="gap-3">
          <PasswordInput
            label="Nova senha"
            placeholder="No mínimo 6 caracteres"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (error) setError(null);
            }}
            error={error && error.toLowerCase().includes('senha') && !error.includes('conferem') ? error : undefined}
            showStrength
          />
          <PasswordInput
            label="Confirmar senha"
            placeholder="Digite de novo"
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              if (error && error.includes('conferem')) setError(null);
            }}
            error={error && error.includes('conferem') ? error : undefined}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
          <Button title="Atualizar senha" onPress={onSubmit} loading={submitting} fullWidth />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
