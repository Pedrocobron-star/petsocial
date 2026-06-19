import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/providers/theme-provider';

/**
 * Tela de carregamento simples (spinner centralizado no fundo do tema). Usada nas
 * rotas que buscam dados e antes só renderizavam null no isLoading (tela branca).
 */
export function ScreenLoading() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
      <ActivityIndicator size="large" color={theme.brand} />
    </View>
  );
}
