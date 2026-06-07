import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { DIFF_META, GAME_META, type GameDifficulty, type GameKey } from '@/lib/games';
import { haptic } from '@/lib/haptics';
import { gamesUrl, sharePost } from '@/lib/share';

interface Props {
  game: GameKey;
  score: number;
  difficulty: GameDifficulty;
  petName?: string | null;
}

/**
 * Botão "Compartilhar resultado" — texto viral + link pro Cassino Pet.
 * Usa Web Share API (mobile/desktop modernos) com fallback de clipboard.
 * O texto é o artefato compartilhável (estilo Wordle): carrega o placar e o
 * desafio direto, sem depender de imagem. Plugado na tela de fim de cada jogo.
 */
export function GameResultShareButton({ game, score, difficulty, petName }: Props) {
  const [state, setState] = useState<'idle' | 'shared' | 'copied'>('idle');

  const onShare = async () => {
    const m = GAME_META[game];
    const tier = DIFF_META[difficulty];
    const who = petName?.trim();
    const intro = who ? `Eu e ${who}` : 'Eu';
    const text =
      `🎰 Cassino Pet · ${m.emoji} ${m.label}\n` +
      `${intro} fizemos ${score} ${m.scoreLabel} no ${tier.emoji} ${tier.label}!\n` +
      `Cadê o seu? Me supera 👇`;
    haptic.light();
    const r = await sharePost({ title: `Cassino Pet · ${m.label}`, message: text, url: gamesUrl() });
    if (r === 'shared') {
      setState('shared');
      haptic.success();
    } else if (r === 'copied') {
      setState('copied');
      haptic.success();
    }
  };

  const label =
    state === 'shared'
      ? '✅ Compartilhado!'
      : state === 'copied'
        ? '✅ Link copiado!'
        : '📤 Compartilhar resultado';

  return (
    <Pressable
      onPress={onShare}
      accessibilityRole="button"
      accessibilityLabel="Compartilhar resultado do jogo"
      style={({ pressed }) => ({
        width: '100%',
        backgroundColor: state === 'idle' ? 'rgba(255,255,255,0.1)' : 'rgba(34,197,94,0.2)',
        borderWidth: 1.5,
        borderColor: state === 'idle' ? 'rgba(255,255,255,0.25)' : '#22C55E',
        borderRadius: 14,
        paddingVertical: 13,
        alignItems: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14.5, color: '#fff' }}>{label}</Text>
    </Pressable>
  );
}
