import { Redirect, Stack, useSegments } from 'expo-router';

import { useSession } from '@/providers/session-provider';

export default function AuthLayout() {
  const { session, loading } = useSession();
  const segments = useSegments();
  const isResetPassword = segments[segments.length - 1] === 'reset-password';
  // Reset password é acessível mesmo logado (o user vem pelo link do email já autenticado).
  if (!loading && session && !isResetPassword) return <Redirect href="/(app)/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
