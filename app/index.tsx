import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/providers/session-provider';

export default function IndexRedirect() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator color="#F97316" />
      </View>
    );
  }

  if (!session) return <Redirect href="/welcome" />;
  return <Redirect href="/(app)/(tabs)" />;
}
