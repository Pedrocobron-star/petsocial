import { Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { computeTutorLevel } from '@/lib/tutor-level';

/**
 * Barra do Nível de Tutor — mostra que os pontos acumulados da Missão do Dia
 * sobem o seu nível (Filhote → Lenda Pet). Usada no card da missão (feed) e no
 * perfil do tutor.
 */
export function TutorLevelBar({ points }: { points: number }) {
  const lvl = computeTutorLevel(points);
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 11,
        borderWidth: 1,
        borderColor: '#FED7AA',
        gap: 7,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18 }}>{lvl.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.body, fontSize: 9, letterSpacing: 1, color: '#C2410C' }}>
            NÍVEL DE TUTOR
          </Text>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#1A1410', marginTop: -1 }}>
            {lvl.title}
          </Text>
        </View>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#C2410C' }}>
          {lvl.points} pts
        </Text>
      </View>
      <View style={{ height: 7, borderRadius: 999, backgroundColor: '#FFEDD5', overflow: 'hidden' }}>
        <View
          style={{
            width: `${Math.round(lvl.progress * 100)}%`,
            height: '100%',
            backgroundColor: '#F97316',
            borderRadius: 999,
          }}
        />
      </View>
      <Text style={{ fontFamily: FONTS.body, fontSize: 10.5, color: '#9A3412' }}>
        {lvl.isMax
          ? 'Nível máximo! você é uma Lenda Pet 👑'
          : `Faltam ${lvl.toNext} pts pra virar ${lvl.nextTitle}`}
      </Text>
    </View>
  );
}
