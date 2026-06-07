import { useQuery } from '@tanstack/react-query';
import { Text } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { DIFF_META, fetchMaxDifficulty, qkGames, type GameDifficulty, type GameKey } from '@/lib/games';
import { useSession } from '@/providers/session-provider';

/**
 * Mostra o "grau máximo" que o tutor já alcançou num jogo (troféu de progressão).
 * variant 'card' = compacto pro hub; 'idle' = linha com o próximo grau a mirar.
 */
export function GameGradeBadge({ game, variant = 'card' }: { game: GameKey; variant?: 'card' | 'idle' }) {
  const { session } = useSession();
  const userId = session?.user.id;
  const q = useQuery({
    queryKey: qkGames.maxDifficulty(game),
    queryFn: () => fetchMaxDifficulty(game),
    enabled: !!userId,
  });
  const grade = (q.data ?? null) as GameDifficulty | null;

  if (variant === 'idle') {
    if (!grade) {
      return (
        <Text style={{ fontFamily: FONTS.body, fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>
          🏆 Jogue pra conquistar seu grau!
        </Text>
      );
    }
    const m = DIFF_META[grade];
    const next = grade < 3 ? DIFF_META[(grade + 1) as GameDifficulty] : null;
    return (
      <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>
        🏆 Seu grau: {m.emoji} {m.label}
        {next ? `   ·   próximo: ${next.emoji} ${next.label}` : '   ·   no topo! 🔥'}
      </Text>
    );
  }

  // variant 'card' (hub, sobre fundo colorido do jogo)
  if (!grade) {
    return (
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 4 }}>
        ✨ Novo pra você
      </Text>
    );
  }
  const m = DIFF_META[grade];
  return (
    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#fff', marginTop: 4 }}>
      🏆 Grau: {m.emoji} {m.label}
    </Text>
  );
}
