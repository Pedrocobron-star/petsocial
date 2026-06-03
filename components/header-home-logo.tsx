import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';

/**
 * Header completo — combina back button (que volta UMA tela) + logo (volta pra home).
 * Use como headerLeft quando quiser oferecer as duas opções.
 */
import { Ionicons } from '@expo/vector-icons';

/**
 * Logo "🐾 Pet Social" clicável usado como headerLeft em todas as telas.
 * Substitui o back button padrão por uma logo home que SEMPRE leva pra
 * `/(app)/(tabs)`, funcionando mesmo quando o histórico de navegação está
 * vazio (caso de quem entrou direto pela URL no web).
 */
export function HeaderHomeLogo() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.replace('/(app)/(tabs)' as never)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Ir pra tela principal"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Text style={{ fontSize: 18 }}>🐾</Text>
      <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#1A1410' }}>
        Pet Social
      </Text>
    </Pressable>
  );
}

/**
 * Variante compacta — só o ícone da pata. Pra telas que precisam do header
 * mais limpo (ex: chat com nome do contato grande).
 */
export function HeaderHomeIcon() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.replace('/(app)/(tabs)' as never)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Ir pra tela principal"
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 22 }}>🐾</Text>
    </Pressable>
  );
}

export function HeaderBackAndHome() {
  const router = useRouter();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Pressable
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(app)/(tabs)' as never);
          }
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        style={{ paddingHorizontal: 6, paddingVertical: 4 }}
      >
        <Ionicons name="chevron-back" size={24} color="#1A1410" />
      </Pressable>
      <HeaderHomeLogo />
    </View>
  );
}
