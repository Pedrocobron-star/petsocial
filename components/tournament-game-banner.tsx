import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { DIFF_META, type GameDifficulty, type GameKey } from '@/lib/games';
import { fetchActiveTournament, formatCountdown, qkTournament } from '@/lib/tournaments';

/**
 * Faixa dentro da tela do jogo avisando que há um torneio ativo PRA ESTE jogo:
 * quanto falta + se o score vai contar (precisa estar na dificuldade mínima).
 * Antes o jogador não tinha como saber que estava disputando — um run no Fácil
 * abaixo do mínimo não contava, em silêncio. Quando dá, oferece subir a
 * dificuldade num toque. Some quando não há torneio ativo pra este jogo.
 *
 * Cores fixas (a tela do jogo é um "arcade" escuro fixo, não usa theme.*).
 */
export function TournamentGameBanner({
  game,
  difficulty,
  onRaiseDifficulty,
}: {
  game: GameKey;
  difficulty: GameDifficulty;
  onRaiseDifficulty?: (d: GameDifficulty) => void;
}) {
  const activeQuery = useQuery({
    queryKey: qkTournament.active(),
    queryFn: fetchActiveTournament,
    staleTime: 60_000,
  });
  const t = activeQuery.data ?? null;

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!t || t.game !== game) return null;

  const minDiff = ((t.min_difficulty as GameDifficulty) ?? 2) as GameDifficulty;
  const counts = difficulty >= minDiff;
  const remaining = formatCountdown(new Date(t.ends_at).getTime() - nowMs);
  const minLabel = DIFF_META[minDiff].label;

  return (
    <View
      style={{
        width: '100%',
        backgroundColor: counts ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.14)',
        borderWidth: 1,
        borderColor: counts ? 'rgba(74,222,128,0.5)' : 'rgba(251,191,36,0.6)',
        borderRadius: 14,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Text style={{ fontSize: 15 }}>🏆</Text>
        <Text style={{ flex: 1, fontFamily: FONTS.bodyBold, fontSize: 12.5, color: '#FDE68A' }}>
          Torneio ativo · acaba em {remaining}
        </Text>
      </View>
      {counts ? (
        <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#86EFAC', lineHeight: 17 }}>
          ✅ Seu score nesta dificuldade ({DIFF_META[difficulty].label}) conta pro torneio!
        </Text>
      ) : (
        <>
          <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#FCD34D', lineHeight: 17 }}>
            ⚠️ No {DIFF_META[difficulty].label} seu run NÃO conta pro torneio — jogue no {minLabel}+.
          </Text>
          {onRaiseDifficulty ? (
            <Pressable
              onPress={() => onRaiseDifficulty(minDiff)}
              accessibilityRole="button"
              accessibilityLabel={`Mudar pra dificuldade ${minLabel}`}
              style={({ pressed }) => ({
                alignSelf: 'flex-start',
                backgroundColor: '#FBBF24',
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="arrow-up" size={13} color="#1A1410" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#1A1410' }}>
                Jogar no {minLabel}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}
