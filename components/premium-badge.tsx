import { Ionicons } from '@expo/vector-icons';
import { View, type ViewStyle } from 'react-native';

interface Props {
  size?: number;
  style?: ViewStyle;
}

/**
 * Badge dourada de Pet Pro — usar ao lado do nome em perfil/comments/feed.
 * Visualmente: estrela de 6 pontas dourada com brilho.
 */
export function PremiumBadge({ size = 14, style }: Props) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#F59E0B',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#F59E0B',
          shadowOpacity: 0.6,
          shadowRadius: size / 3,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    >
      <Ionicons name="star" size={size * 0.65} color="#fff" />
    </View>
  );
}
