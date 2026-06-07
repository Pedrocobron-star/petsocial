import { Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { type AppThemeKey } from '@/lib/app-themes';
import { AREA_IDENTITY, type HeroShape } from '@/lib/area-identity';
import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

const VW = 400; // unidades do viewBox (largura)
const VH = 150; // altura renderizada (px) — 1:1 vertical
const Y0 = 126; // baseline onde começa a silhueta da borda

/** Borda inferior shaped (volta de (VW,Y0) até (0,Y0)) — a "assinatura" da área. */
function bottomEdge(shape: HeroShape): string {
  switch (shape) {
    case 'wave':
      return `C 300 ${Y0 + 14}, 250 ${Y0 - 14}, 200 ${Y0} S 100 ${Y0 + 14}, 0 ${Y0}`;
    case 'scallop': {
      let d = '';
      for (let x = VW; x > 0; x -= 50) d += ` A 25 16 0 0 1 ${x - 50} ${Y0}`;
      return d.trim();
    }
    case 'zigzag': {
      let d = '';
      let down = true;
      for (let x = VW; x > 0; x -= 25) {
        d += ` L ${x - 25} ${down ? Y0 + 15 : Y0}`;
        down = !down;
      }
      return d.trim();
    }
    case 'notch':
      return `L ${VW / 2} ${Y0 + 20} L 0 ${Y0}`;
    case 'ticket':
    default:
      return `L 0 ${Y0}`;
  }
}

function PatternLayer({ emoji }: { emoji: string }) {
  const pts: [number, number, number][] = [
    [30, 38, -12],
    [112, 70, 8],
    [192, 30, -6],
    [272, 64, 14],
    [350, 40, -10],
    [70, 106, 10],
    [152, 110, -8],
    [240, 100, 6],
    [330, 104, -14],
    [388, 80, 0],
  ];
  return (
    <>
      {pts.map(([x, y, r], i) => (
        <SvgText
          key={i}
          x={x}
          y={y}
          fontSize="26"
          fill="#FFFFFF"
          opacity={0.14}
          textAnchor="middle"
          transform={`rotate(${r} ${x} ${y})`}
        >
          {emoji}
        </SvgText>
      ))}
    </>
  );
}

/**
 * Hero de identidade da área: gradiente + textura de motivos + silhueta de
 * borda inferior única por seção (onda, festão, zigue-zague, fita, ticket).
 * Dá "cara própria" forte a cada "app" sem mexer no resto do design system.
 */
export function AreaHero({
  area,
  title,
  tagline,
}: {
  area: Exclude<AppThemeKey, 'default'>;
  title?: string;
  tagline?: string;
}) {
  const { theme } = useTheme();
  const id = AREA_IDENTITY[area];
  const coloredPath = `M0 0 L${VW} 0 L${VW} ${Y0} ${bottomEdge(id.shape)} Z`;
  const isTicket = id.shape === 'ticket';

  return (
    <View style={{ width: '100%', height: VH }}>
      <Svg width="100%" height={VH} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`hg-${area}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={id.grad[0]} />
            <Stop offset="1" stopColor={id.grad[1]} />
          </LinearGradient>
        </Defs>
        <Path d={coloredPath} fill={`url(#hg-${area})`} />
        <PatternLayer emoji={id.pattern} />
        {isTicket ? (
          <>
            <Path d={`M0 ${Y0 * 0.5 - 15} A 15 15 0 0 1 0 ${Y0 * 0.5 + 15} Z`} fill={theme.bg} />
            <Path d={`M${VW} ${Y0 * 0.5 - 15} A 15 15 0 0 0 ${VW} ${Y0 * 0.5 + 15} Z`} fill={theme.bg} />
            <Line x1="16" y1={Y0 - 3} x2={VW - 16} y2={Y0 - 3} stroke={theme.bg} strokeWidth="2.5" strokeDasharray="7 7" />
          </>
        ) : null}
      </Svg>

      {/* conteúdo sobre o hero (acima da silhueta) */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          height: Y0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 22,
        }}
      >
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.22)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.35)',
          }}
        >
          <Text style={{ fontSize: 30 }}>{id.motif}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 28, color: '#FFFFFF' }}>{title ?? id.title}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 1 }}>
            {tagline ?? id.tagline}
          </Text>
        </View>
      </View>
    </View>
  );
}
