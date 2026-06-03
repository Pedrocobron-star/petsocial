import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { AnimatedPet } from '@/components/animated-pet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Screen } from '@/components/ui/screen';
import { FONTS } from '@/lib/fonts';
import { useTranslation } from '@/lib/i18n';
import { signInSchema } from '@/lib/validators';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/providers/toast-provider';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useSession();
  const toast = useToast();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as 'email' | 'password';
        fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
      router.replace('/(app)/(tabs)');
    } catch (e) {
      toast.error(t('auth.signIn.error'), e instanceof Error ? e.message : t('common.retry'));
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
            <AnimatedPet kind="cat" size={36} delay={250} />
          </View>
          <Text style={{ fontFamily: FONTS.display, fontSize: 36, color: '#1A1410', marginTop: 8 }}>
            {t('auth.signIn.title')}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 15, color: '#525252', marginTop: 4 }}>
            {t('auth.signIn.subtitle')}
          </Text>
        </View>

        <View className="gap-3">
          <Input
            label={t('auth.signIn.emailLabel')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder={t('auth.signIn.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            returnKeyType="next"
            onSubmitEditing={onSubmit}
          />
          <PasswordInput
            label={t('auth.signIn.passwordLabel')}
            autoComplete="password"
            placeholder="••••••"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
          <Button title={t('auth.signIn.submit')} onPress={onSubmit} loading={loading} fullWidth />
        </View>

        <View className="mt-4 items-center">
          <Link href="/(auth)/forgot-password" className="text-sm font-medium text-brand-dark">
            {t('auth.signIn.forgotPassword')}
          </Link>
        </View>

        <View className="mt-6 flex-row justify-center gap-1">
          <Text className="text-neutral-600">{t('auth.signIn.noAccount')}</Text>
          <Link href="/(auth)/sign-up" className="font-semibold text-brand-dark">
            {t('auth.signIn.goToSignUp')}
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
