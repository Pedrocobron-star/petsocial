import { Text, View } from 'react-native';

interface Props {
  count?: number;
  opacity?: number;
}

// Posições pré-definidas pra criar um pattern "natural" sem ser aleatório a cada render.
const POSITIONS = [
  { top: '5%', left: '8%', rotate: -15, size: 28 },
  { top: '12%', left: '78%', rotate: 25, size: 22 },
  { top: '22%', left: '32%', rotate: -8, size: 32 },
  { top: '32%', left: '88%', rotate: -30, size: 24 },
  { top: '42%', left: '12%', rotate: 18, size: 26 },
  { top: '50%', left: '60%', rotate: -22, size: 30 },
  { top: '62%', left: '24%', rotate: 12, size: 22 },
  { top: '72%', left: '82%', rotate: 30, size: 28 },
  { top: '82%', left: '8%', rotate: -10, size: 24 },
  { top: '92%', left: '70%', rotate: 20, size: 26 },
  { top: '17%', left: '52%', rotate: 8, size: 20 },
  { top: '38%', left: '48%', rotate: -18, size: 22 },
  { top: '58%', left: '42%', rotate: 24, size: 20 },
  { top: '78%', left: '50%', rotate: -12, size: 24 },
];

export function PawPrintsBg({ count = 14, opacity = 0.06 }: Props) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
    >
      {POSITIONS.slice(0, count).map((p, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: p.top as `${number}%`,
            left: p.left as `${number}%`,
            transform: [{ rotate: `${p.rotate}deg` }],
            opacity,
          }}
        >
          <Text style={{ fontSize: p.size }}>🐾</Text>
        </View>
      ))}
    </View>
  );
}
