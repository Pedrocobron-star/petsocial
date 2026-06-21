import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { fetchGlobalMyRank, qkGames } from '@/lib/games';
import { computePlayerLevel } from '@/lib/player-level';

/**
 * Card de Nível do Jogador (XP cross-game). O XP é o total combinado dos 3
 * jogos (mesma fonte do placar geral). Mostra nível, título, barra de progresso
 * e quanto falta pro próximo nível — dá uma meta de longo prazo pro tutor.
 */
export function PlayerLevelCard() {
  const q = useQuery({
    queryKey: qkGames.globalMyRank(),
    queryFn: () => fetchGlobalMyRank(),
  });

  const xp = q.data?.total_score ?? 0;
  const lvl = computePlayerLevel(xp);
  const pct = Math.round(lvl.progress * 100);

  return (
    <View
      style={{
        backgroundColor: 'rgba(124,58,237,0.16)',
        borderRadius: 20,
        padding: 16,
        gap: 10,
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.4)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: 'rgba(167,139,250,0.22)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 26 }}>{lvl.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#fff' }}>
            Nível {lvl.level} · {lvl.title}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
            {xp > 0
              ? `${lvl.xp} XP · faltam ${lvl.toNext} pro nível ${lvl.level + 1}`
              : 'Jogue os jogos pra ganhar XP e subir de nível!'}
          </Text>
        </View>
      </View>

      {/* barra de progresso (flex ratios pra evitar cast de DimensionValue) */}
      <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', flexDirection: 'row' }}>
        <View style={{ flex: Math.max(0.001, lvl.progress), backgroundColor: '#A78BFA' }} />
        <View style={{ flex: Math.max(0.001, 1 - lvl.progress) }} />
      </View>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10.5, color: 'rgba(167,139,250,0.95)', textAlign: 'right' }}>
        {pct}% pro nível {lvl.level + 1}
      </Text>
    </View>
  );
}
