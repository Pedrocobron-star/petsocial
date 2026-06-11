import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

/**
 * Selo verificado dourado — perfil/conta oficial (ex: o Mozart, anfitrião da
 * plataforma). Círculo dourado com check escuro. Diferente do `PremiumBadge`
 * (pata dourada do Pet Pro).
 */
export function OfficialBadge({ size = 14 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FBBF24',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="checkmark" size={Math.round(size * 0.64)} color="#1A1410" />
    </View>
  );
}
