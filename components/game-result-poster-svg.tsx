import { View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { DIFF_META, GAME_META, type GameDifficulty, type GameKey } from '@/lib/games';

const ACCENT: Record<GameKey, { a: string; b: string }> = {
  treats: { a: '#F97316', b: '#DB2777' },
  quiz: { a: '#7C3AED', b: '#2563EB' },
  caminho: { a: '#0EA5E9', b: '#22C55E' },
  runner: { a: '#16A34A', b: '#0D9488' },
};

interface Props {
  game: GameKey;
  score: number;
  difficulty: GameDifficulty;
  petName?: string | null;
  size?: number;
  style?: ViewStyle;
}

/**
 * Cartaz quadrado (1024) do resultado de um jogo da Arena Pet, pra exportar
 * como PNG e compartilhar. Usa só formas + texto (robusto no export pra canvas).
 * fontWeight bold sem fonte custom → renderiza igual no canvas de qualquer
 * browser.
 */
export function GameResultPosterSvg({ game, score, difficulty, petName, size = 1024, style }: Props) {
  const meta = GAME_META[game];
  const diff = DIFF_META[difficulty];
  const acc = ACCENT[game];
  const who = petName?.trim();
  const V = 1024;

  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox={`0 0 ${V} ${V}`}>
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#1A1030" />
            <Stop offset="1" stopColor="#2A1A4A" />
          </LinearGradient>
          <LinearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={acc.a} />
            <Stop offset="1" stopColor={acc.b} />
          </LinearGradient>
        </Defs>

        {/* fundo */}
        <Rect x="0" y="0" width={V} height={V} fill="url(#bg)" />
        {/* moldura accent */}
        <Rect x="28" y="28" width={V - 56} height={V - 56} rx="44" fill="none" stroke="url(#accent)" strokeWidth="10" />

        {/* wordmark */}
        <SvgText x={V / 2} y="150" fontSize="46" fontWeight="800" fill="#FBBF24" textAnchor="middle" letterSpacing="2">
          🏆 CASSINO PET
        </SvgText>

        {/* emoji do jogo */}
        <SvgText x={V / 2} y="350" fontSize="150" textAnchor="middle">
          {meta.emoji}
        </SvgText>

        {/* nome do jogo */}
        <SvgText x={V / 2} y="440" fontSize="54" fontWeight="800" fill="#FFFFFF" textAnchor="middle">
          {meta.label}
        </SvgText>

        {/* score gigante */}
        <SvgText x={V / 2} y="660" fontSize="200" fontWeight="800" fill="#FBBF24" textAnchor="middle">
          {String(score)}
        </SvgText>
        <SvgText x={V / 2} y="720" fontSize="40" fontWeight="700" fill="rgba(255,255,255,0.85)" textAnchor="middle">
          {meta.scoreLabel}
        </SvgText>

        {/* pill de dificuldade */}
        <Rect x={V / 2 - 200} y="770" width="400" height="74" rx="37" fill="url(#accent)" />
        <SvgText x={V / 2} y="820" fontSize="36" fontWeight="800" fill="#FFFFFF" textAnchor="middle">
          {diff.emoji} {diff.label}
        </SvgText>

        {/* pet / desafio */}
        <SvgText x={V / 2} y="908" fontSize="34" fontWeight="600" fill="rgba(255,255,255,0.8)" textAnchor="middle">
          {who ? `com ${who} 🐾` : 'me supera? 🐾'}
        </SvgText>

        {/* rodapé */}
        <SvgText x={V / 2} y="980" fontSize="28" fontWeight="600" fill="rgba(255,255,255,0.5)" textAnchor="middle">
          maestropet.com
        </SvgText>
      </Svg>
    </View>
  );
}
