import { View, type ViewStyle } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

interface Props {
  size?: number;
  style?: ViewStyle;
}

/**
 * Selo de Pet Pro — estilo "verificado" do Instagram, porém dourado e com uma
 * patinha branca no centro. Borda escalopada + gradiente + brilho dão cara de
 * artigo caro/premium. Usar ao lado do nome em perfil/feed/comentários.
 *
 * API estável (size): todos os pontos de uso herdam o novo visual automaticamente.
 */

// --- Selo escalopado (10 "pétalas" arredondadas), gerado uma vez no módulo. ---
function buildScallopPath(cx: number, cy: number, peakR: number, valleyR: number, bumps: number): string {
  const step = (Math.PI * 2) / bumps;
  const start = -Math.PI / 2;
  const valley = (i: number): [number, number] => {
    const a = start + i * step;
    return [cx + valleyR * Math.cos(a), cy + valleyR * Math.sin(a)];
  };
  const peak = (i: number): [number, number] => {
    const a = start + i * step + step / 2;
    return [cx + peakR * Math.cos(a), cy + peakR * Math.sin(a)];
  };
  const v0 = valley(0);
  let d = `M ${v0[0].toFixed(2)} ${v0[1].toFixed(2)}`;
  for (let i = 0; i < bumps; i++) {
    const p = peak(i);
    const vn = valley((i + 1) % bumps);
    d += ` Q ${p[0].toFixed(2)} ${p[1].toFixed(2)} ${vn[0].toFixed(2)} ${vn[1].toFixed(2)}`;
  }
  return `${d} Z`;
}

const SEAL_PATH = buildScallopPath(50, 50, 48, 37, 10);

// Patinha (4 dedinhos + coxim central), centrada e levemente pra cima.
const PAW_PAD =
  'M50 47 C41 47 34.5 54 34.5 61.5 C34.5 69.5 41.5 73.5 50 73.5 C58.5 73.5 65.5 69.5 65.5 61.5 C65.5 54 59 47 50 47 Z';

export function PremiumBadge({ size = 14, style }: Props) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        // Sem shadow*: no RN Web a sombra vira box-shadow RETANGULAR e desenha
        // um "quadrado" feio ao redor do selo. O gradiente do SVG já dá relevo.
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="ppGold" x1="18" y1="10" x2="86" y2="92" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FDE68A" />
            <Stop offset="0.4" stopColor="#FBBF24" />
            <Stop offset="0.72" stopColor="#F59E0B" />
            <Stop offset="1" stopColor="#B45309" />
          </LinearGradient>
          <RadialGradient id="ppShine" cx="36" cy="30" r="42" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
            <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Selo dourado escalopado + borda de "moeda" */}
        <Path d={SEAL_PATH} fill="url(#ppGold)" stroke="#92400E" strokeWidth={2} strokeOpacity={0.55} />
        {/* Anel interno sutil pra dar profundidade */}
        <Path d={SEAL_PATH} fill="none" stroke="#FFFFFF" strokeWidth={1.4} strokeOpacity={0.28} transform="scale(0.82) translate(11 11)" />
        {/* Brilho no topo-esquerda */}
        <Path d={SEAL_PATH} fill="url(#ppShine)" />

        {/* Patinha branca: coxim + 4 dedinhos */}
        <Path d={PAW_PAD} fill="#FFFFFF" />
        <Ellipse cx="36" cy="44" rx="6" ry="7.5" fill="#FFFFFF" />
        <Ellipse cx="45.5" cy="37.5" rx="6" ry="8" fill="#FFFFFF" />
        <Ellipse cx="54.5" cy="37.5" rx="6" ry="8" fill="#FFFFFF" />
        <Ellipse cx="64" cy="44" rx="6" ry="7.5" fill="#FFFFFF" />
      </Svg>
    </View>
  );
}
