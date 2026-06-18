import { useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { GameResultPosterSvg } from '@/components/game-result-poster-svg';
import { sharePngDataUrl, svgNodeToPng } from '@/lib/avatar-export';
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
 * Compartilhar resultado: botão de texto+link (Web Share/clipboard) + um botão
 * que gera um CARD PNG bonito (poster quadrado) e compartilha como imagem
 * (Web Share com arquivo, ou download). O texto é o artefato base; o card é o
 * upgrade visual pra redes. Plugado na tela de fim de cada jogo.
 */
export function GameResultShareButton({ game, score, difficulty, petName }: Props) {
  const [textState, setTextState] = useState<'idle' | 'shared' | 'copied'>('idle');
  const [cardState, setCardState] = useState<'idle' | 'shared' | 'saved'>('idle');
  const [busy, setBusy] = useState(false);
  const posterRef = useRef<View>(null);

  const onShareText = async () => {
    const m = GAME_META[game];
    const tier = DIFF_META[difficulty];
    const who = petName?.trim();
    const intro = who ? `Eu e ${who}` : 'Eu';
    const text =
      `🏆 Arena Pet · ${m.emoji} ${m.label}\n` +
      `${intro} fizemos ${score} ${m.scoreLabel} no ${tier.emoji} ${tier.label}!\n` +
      `Cadê o seu? Me supera 👇`;
    haptic.light();
    const r = await sharePost({ title: `Arena Pet · ${m.label}`, message: text, url: gamesUrl() });
    if (r === 'shared') {
      setTextState('shared');
      haptic.success();
    } else if (r === 'copied') {
      setTextState('copied');
      haptic.success();
    }
  };

  const onShareCard = async () => {
    if (Platform.OS !== 'web' || busy) return;
    setBusy(true);
    haptic.light();
    try {
      const node = posterRef.current as unknown as Element | null;
      const svg = node?.querySelector('svg');
      if (!svg) return;
      const dataUrl = await svgNodeToPng(svg, 1024);
      if (!dataUrl) return;
      const m = GAME_META[game];
      const shared = await sharePngDataUrl(dataUrl, `arena-pet-${game}.png`, `Arena Pet · ${m.label}`);
      setCardState(shared ? 'shared' : 'saved');
      haptic.success();
    } catch {
      // silencioso — o botão de texto continua disponível
    } finally {
      setBusy(false);
    }
  };

  const textLabel =
    textState === 'shared'
      ? '✅ Compartilhado!'
      : textState === 'copied'
        ? '✅ Link copiado!'
        : '📤 Compartilhar resultado';

  const cardLabel = busy
    ? '🎨 Gerando card...'
    : cardState === 'shared'
      ? '✅ Card compartilhado!'
      : cardState === 'saved'
        ? '✅ Card salvo!'
        : '📸 Gerar card de imagem';

  return (
    <View style={{ width: '100%', gap: 8 }}>
      {/* poster escondido em alta resolução pro export (web) */}
      {Platform.OS === 'web' ? (
        <View ref={posterRef} style={{ position: 'absolute', left: -9999, top: -9999, width: 1024 }} pointerEvents="none" aria-hidden>
          <GameResultPosterSvg game={game} score={score} difficulty={difficulty} petName={petName} size={1024} />
        </View>
      ) : null}

      <Pressable
        onPress={onShareText}
        accessibilityRole="button"
        accessibilityLabel="Compartilhar resultado do jogo"
        style={({ pressed }) => ({
          width: '100%',
          backgroundColor: textState === 'idle' ? 'rgba(255,255,255,0.1)' : 'rgba(34,197,94,0.2)',
          borderWidth: 1.5,
          borderColor: textState === 'idle' ? 'rgba(255,255,255,0.25)' : '#22C55E',
          borderRadius: 14,
          paddingVertical: 13,
          alignItems: 'center',
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14.5, color: '#fff' }}>{textLabel}</Text>
      </Pressable>

      {Platform.OS === 'web' ? (
        <Pressable
          onPress={onShareCard}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Gerar card de imagem do resultado"
          style={({ pressed }) => ({
            width: '100%',
            backgroundColor: cardState === 'idle' ? 'rgba(244,114,182,0.16)' : 'rgba(34,197,94,0.2)',
            borderWidth: 1.5,
            borderColor: cardState === 'idle' ? 'rgba(244,114,182,0.5)' : '#22C55E',
            borderRadius: 14,
            paddingVertical: 13,
            alignItems: 'center',
            opacity: pressed || busy ? 0.7 : 1,
          })}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14.5, color: '#fff' }}>{cardLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
