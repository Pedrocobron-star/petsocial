import { Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { DIFF_META, type GameDifficulty } from '@/lib/games';

const TIERS: GameDifficulty[] = [1, 2, 3];

/**
 * Seletor de dificuldade compartilhado pelos jogos (tema escuro da Arena Pet).
 * Mostra Fácil/Médio/Difícil + o multiplicador de score de cada tier.
 */
export function GameDifficultyPicker({
  value,
  onChange,
  disabled,
}: {
  value: GameDifficulty;
  onChange: (d: GameDifficulty) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
      {TIERS.map((d) => {
        const active = d === value;
        const m = DIFF_META[d];
        return (
          <Pressable
            key={d}
            disabled={disabled}
            onPress={() => onChange(d)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 12,
              alignItems: 'center',
              gap: 1,
              backgroundColor: active ? 'rgba(251,191,36,0.22)' : 'rgba(255,255,255,0.06)',
              borderWidth: active ? 1.5 : 1,
              borderColor: active ? '#FBBF24' : 'rgba(255,255,255,0.10)',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: '#fff' }}>
              {m.emoji} {m.label}
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 10.5, color: 'rgba(255,255,255,0.6)' }}>
              ×{m.mult}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
