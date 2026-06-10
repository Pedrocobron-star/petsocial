import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AppQuickActions } from '@/components/app-quick-actions';
import { ErrorBoundary } from '@/components/error-boundary';
import { HeaderHomeIcon } from '@/components/header-home-logo';
import { HealthNotificationHandler } from '@/components/health-notification-handler';
import { ActivePetProvider } from '@/providers/active-pet-provider';
import { RealtimeProvider } from '@/providers/realtime-provider';
import { useSession } from '@/providers/session-provider';

// O "celular do pet" (/phone) é a tela base do app — assim o "voltar" de
// qualquer função volta pro celular, não pro feed.
export const unstable_settings = {
  initialRouteName: 'phone',
};

export default function AppLayout() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator color="#F97316" />
      </View>
    );
  }
  if (!session) return <Redirect href="/welcome" />;

  return (
    <ErrorBoundary>
      <ActivePetProvider>
        <RealtimeProvider>
          <HealthNotificationHandler />
          <AppQuickActions />
          <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: 250,
            headerTitleStyle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 17 },
            headerBackTitle: '',
            contentStyle: { backgroundColor: '#FFFBF5' },
            // headerLeft = só o Mozart pequeno (volta pra home /phone).
            // Funciona mesmo se histórico vazio (caso de entrar direto pela URL no web).
            headerLeft: () => <HeaderHomeIcon />,
            headerBackVisible: false, // desabilita o back automático pra evitar duplicação
          }}
        >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="onboarding"
          options={{ presentation: 'modal', gestureEnabled: false }}
        />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal', title: 'Editar perfil' }} />
        <Stack.Screen name="pet/new" options={{ presentation: 'modal', title: 'Novo pet' }} />
        <Stack.Screen name="pet/[id]/index" options={{ headerShown: true, title: '' }} />
        <Stack.Screen
          name="pet/[id]/edit"
          options={{ presentation: 'modal', headerShown: true, title: 'Editar pet' }}
        />
        <Stack.Screen name="pet/[id]/followers" options={{ headerShown: true }} />
        <Stack.Screen name="pet/[id]/following" options={{ headerShown: true }} />
        <Stack.Screen name="pet/[id]/gallery" options={{ headerShown: true }} />
        <Stack.Screen name="pet/[id]/vaccinations" options={{ headerShown: true }} />
        <Stack.Screen name="pet/[id]/diary" options={{ headerShown: true }} />
        <Stack.Screen name="pet/[id]/health" options={{ headerShown: true }} />
        <Stack.Screen name="pet/[id]/health-alerts" options={{ headerShown: true, title: 'Alertas' }} />
        <Stack.Screen name="pet/[id]/health-calendar" options={{ headerShown: true, title: 'Calendário' }} />
        <Stack.Screen name="pet/[id]/medications" options={{ headerShown: true }} />
        <Stack.Screen name="pet/[id]/vet-visits" options={{ headerShown: true }} />
        <Stack.Screen name="pet/[id]/symptoms" options={{ headerShown: true, title: 'Sintomas' }} />
        <Stack.Screen name="pet/[id]/diet" options={{ headerShown: true, title: 'Dieta' }} />
        <Stack.Screen name="pet/[id]/weight" options={{ headerShown: true }} />
        <Stack.Screen name="pet/[id]/documents/index" options={{ headerShown: true, title: 'Exames & Laudos' }} />
        <Stack.Screen name="pet/[id]/expenses" options={{ headerShown: true, title: 'Gastos' }} />
        <Stack.Screen name="pet/[id]/birthday" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="pet/[id]/quiz" options={{ headerShown: true, title: 'Quiz', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="pet/[id]/memorial" options={{ headerShown: true, title: 'Memorial', animation: 'fade' }} />
        <Stack.Screen name="pet/[id]/time-capsule" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="pet/[id]/recap" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="pet/[id]/ai-assistant" options={{ headerShown: true }} />
        <Stack.Screen name="pet/[id]/id-card" options={{ headerShown: true, title: 'Carteirinha' }} />
        <Stack.Screen name="pet/[id]/caretakers" options={{ headerShown: true, title: 'Cuidadores' }} />
        <Stack.Screen name="pet/[id]/agenda" options={{ headerShown: true, title: 'Agenda' }} />
        <Stack.Screen name="pet/[id]/agenda-photos" options={{ headerShown: true, title: 'Fotos da agenda' }} />
        <Stack.Screen name="pet/[id]/agenda-costs" options={{ headerShown: true, title: 'Custos' }} />
        <Stack.Screen name="pet/[id]/parasites" options={{ headerShown: true, title: 'Parasitas' }} />
        <Stack.Screen name="post/[id]" options={{ headerShown: true, title: 'Post' }} />
        <Stack.Screen name="meetup/new" options={{ presentation: 'modal', title: 'Novo encontro' }} />
        <Stack.Screen name="meetup/[id]/index" options={{ headerShown: true, title: 'Encontro' }} />
        <Stack.Screen
          name="meetup/[id]/edit"
          options={{ presentation: 'modal', headerShown: true, title: 'Editar encontro' }}
        />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notificações' }} />
        <Stack.Screen name="saved" options={{ headerShown: true, title: 'Posts salvos' }} />
        <Stack.Screen name="lost-found/index" options={{ headerShown: true }} />
        <Stack.Screen
          name="lost-found/report"
          options={{ presentation: 'modal', headerShown: true, title: 'Reportar pet' }}
        />
        <Stack.Screen name="lost-found/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="achievements" options={{ headerShown: true, title: 'Conquistas' }} />
        <Stack.Screen name="wall-of-fame" options={{ headerShown: true }} />
        <Stack.Screen name="messages" options={{ headerShown: true, title: 'Mensagens' }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="tag/[name]" options={{ headerShown: true }} />
        <Stack.Screen name="places/index" options={{ headerShown: true, title: 'Pet Map' }} />
        <Stack.Screen name="places/new" options={{ presentation: 'modal', headerShown: true }} />
        <Stack.Screen name="places/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="agenda" options={{ headerShown: true, title: 'Minha agenda' }} />
        <Stack.Screen name="phone" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="games/index" options={{ headerShown: true }} />
        <Stack.Screen name="games/treats" options={{ headerShown: true, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="games/quiz" options={{ headerShown: true, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="games/caminho" options={{ headerShown: true, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="news/index" options={{ headerShown: true, title: 'Notícias' }} />
        <Stack.Screen name="news/[slug]" options={{ headerShown: true, title: 'Notícia' }} />
        <Stack.Screen name="news/category/[slug]" options={{ headerShown: true, title: 'Categoria' }} />
        <Stack.Screen name="admin/news/index" options={{ headerShown: true, title: 'Notícias · Redação' }} />
        <Stack.Screen name="admin/news/new" options={{ presentation: 'modal', headerShown: true, title: 'Nova matéria' }} />
        <Stack.Screen name="admin/news/[id]" options={{ headerShown: true, title: 'Editar matéria' }} />
        <Stack.Screen name="pro" options={{ headerShown: true, title: 'Pet Pro' }} />
        <Stack.Screen name="offers" options={{ headerShown: true, title: 'Vantagens' }} />
        <Stack.Screen name="adoption/index" options={{ headerShown: true, title: 'Adoção' }} />
        <Stack.Screen name="adoption/new" options={{ headerShown: true, title: 'Anunciar', presentation: 'modal' }} />
        <Stack.Screen name="adoption/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="account" options={{ headerShown: true, title: 'Minha conta' }} />
        <Stack.Screen name="notification-settings" options={{ headerShown: true, title: 'Notificações' }} />
        <Stack.Screen name="language" options={{ headerShown: true, title: 'Idioma' }} />
          <Stack.Screen name="pets-overview" options={{ headerShown: true, title: 'Meus pets · Saúde' }} />
          <Stack.Screen name="reminders" options={{ headerShown: true, title: 'Lembretes' }} />
          <Stack.Screen name="shared-pets" options={{ headerShown: true, title: 'Pets que cuido' }} />
          <Stack.Screen name="admin" options={{ headerShown: true, title: 'Admin' }} />
          <Stack.Screen name="admin/users" options={{ headerShown: true, title: 'Usuários' }} />
          <Stack.Screen name="admin/users/[id]" options={{ headerShown: true, title: 'Usuário' }} />
          <Stack.Screen name="admin/sponsored/index" options={{ headerShown: true, title: 'Sponsored' }} />
          <Stack.Screen name="admin/sponsored/new" options={{ headerShown: true, title: 'Novo sponsored', presentation: 'modal' }} />
          <Stack.Screen name="admin/sponsored/[id]" options={{ headerShown: true, title: 'Editar sponsored' }} />
          <Stack.Screen name="admin/engagement" options={{ headerShown: true, title: 'Engajamento' }} />
          <Stack.Screen name="admin/activity" options={{ headerShown: true, title: 'Atividade' }} />
          <Stack.Screen name="admin/recalls/index" options={{ headerShown: true, title: 'Recalls' }} />
          <Stack.Screen name="admin/recalls/new" options={{ headerShown: true, title: 'Novo recall', presentation: 'modal' }} />
          <Stack.Screen name="admin/recalls/[id]" options={{ headerShown: true, title: 'Editar recall' }} />
          <Stack.Screen name="admin/offers/index" options={{ headerShown: true, title: 'Ofertas' }} />
          <Stack.Screen name="admin/offers/new" options={{ headerShown: true, title: 'Nova oferta', presentation: 'modal' }} />
          <Stack.Screen name="admin/offers/[id]" options={{ headerShown: true, title: 'Editar oferta' }} />
          <Stack.Screen name="admin/places/index" options={{ headerShown: true, title: 'Lugares' }} />
          <Stack.Screen name="admin/places/new" options={{ headerShown: true, title: 'Novo lugar', presentation: 'modal' }} />
          <Stack.Screen name="admin/places/[id]" options={{ headerShown: true, title: 'Editar lugar' }} />
          <Stack.Screen name="admin/adoption" options={{ headerShown: true, title: 'Adoção · Moderação' }} />
          <Stack.Screen name="admin/notifications" options={{ headerShown: true, title: 'Notificações · Admin' }} />
          <Stack.Screen name="admin/ratings" options={{ headerShown: true, title: 'Avaliações' }} />
          <Stack.Screen name="admin/mozart" options={{ headerShown: true, title: 'Mozart · Admin' }} />
          <Stack.Screen name="admin/mozart-posts" options={{ headerShown: true, title: 'Posts do Mozart · Admin' }} />
          <Stack.Screen name="admin/daily-missions" options={{ headerShown: true, title: 'Missão do Dia · Admin' }} />
        </Stack>
        </RealtimeProvider>
      </ActivePetProvider>
    </ErrorBoundary>
  );
}
