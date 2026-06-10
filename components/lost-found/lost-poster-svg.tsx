import { View, type ViewStyle } from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  Image as SvgImage,
  Rect,
  Text as SvgText,
  TSpan,
} from 'react-native-svg';

import type { LostReportWithPet } from '@/lib/types';

interface Props {
  report: LostReportWithPet;
  /** Tamanho do cartaz no SVG viewBox — exportado fica em alta resolução. */
  size?: number;
  style?: ViewStyle;
}

/**
 * Cartaz SVG no estilo "PROCURA-SE" pra share viral.
 * Dimensões fixas (800x1000) — quadrado-portrait que cabe em stories
 * (9:16 quando recortado) e feed (1:1 com crop).
 *
 * Renderizado off-screen pra exportar como PNG.
 */
export function LostPosterSvg({ report, size = 400, style }: Props) {
  const W = 800;
  const H = 1000;
  const displayName = report.pet?.name ?? report.pet_name ?? 'Sem nome';
  const isLost = report.kind === 'lost';
  const photo = report.photo_url ?? report.pet?.avatar_url;

  // Cores do cartaz baseadas em kind
  const accent = isLost ? '#DC2626' : '#16A34A';
  const accentDark = isLost ? '#7F1D1D' : '#14532D';
  const accentLight = isLost ? '#FEE2E2' : '#DCFCE7';

  // Título principal
  const title = isLost ? 'PROCURA-SE' : 'ENCONTRADO';

  // Truncate longo
  const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  return (
    <View style={[{ width: size, aspectRatio: W / H }, style]}>
      <Svg width={size} height={size * (H / W)} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <ClipPath id="photo-clip">
            <Rect x="100" y="240" width="600" height="450" rx="24" />
          </ClipPath>
        </Defs>

        {/* Fundo creme */}
        <Rect x="0" y="0" width={W} height={H} fill="#FFF7ED" />

        {/* Header colorido com título */}
        <Rect x="0" y="0" width={W} height="180" fill={accent} />
        <SvgText
          x={W / 2}
          y="80"
          fontSize="36"
          fontWeight="bold"
          fill="#FFFFFF"
          textAnchor="middle"
          opacity="0.9"
        >
          {isLost ? 'AJUDE A ENCONTRAR' : 'ALGUÉM ESTÁ PROCURANDO'}
        </SvgText>
        <SvgText
          x={W / 2}
          y="148"
          fontSize="84"
          fontWeight="900"
          fill="#FFFFFF"
          textAnchor="middle"
        >
          {title}
        </SvgText>

        {/* Foto / placeholder */}
        <Rect x="100" y="240" width="600" height="450" rx="24" fill={accentLight} />
        {photo ? (
          <SvgImage
            x="100"
            y="240"
            width="600"
            height="450"
            href={photo}
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#photo-clip)"
          />
        ) : (
          <SvgText
            x={W / 2}
            y="490"
            fontSize="240"
            textAnchor="middle"
          >
            🐾
          </SvgText>
        )}
        {/* Moldura */}
        <Rect
          x="100"
          y="240"
          width="600"
          height="450"
          rx="24"
          fill="none"
          stroke={accent}
          strokeWidth="6"
        />

        {/* Nome */}
        <SvgText
          x={W / 2}
          y="780"
          fontSize="68"
          fontWeight="900"
          fill="#1A1410"
          textAnchor="middle"
        >
          {trunc(displayName.toUpperCase(), 18)}
        </SvgText>

        {/* Características */}
        {(() => {
          const species = report.pet?.species ?? report.species;
          const breed = report.pet?.breed ?? report.breed;
          const color = report.color;
          const parts: string[] = [];
          if (species) {
            const speciesNames: Record<string, string> = {
              dog: 'Cachorro',
              cat: 'Gato',
              rabbit: 'Coelho',
              bird: 'Pássaro',
              fish: 'Peixe',
              rodent: 'Roedor',
              reptile: 'Réptil',
              other: 'Pet',
            };
            parts.push(speciesNames[species] ?? 'Pet');
          }
          if (breed) parts.push(breed);
          if (color) parts.push(color);
          const text = parts.join(' · ');
          return text ? (
            <SvgText
              x={W / 2}
              y="822"
              fontSize="28"
              fill="#525252"
              textAnchor="middle"
            >
              {trunc(text, 50)}
            </SvgText>
          ) : null;
        })()}

        {/* Local */}
        <Rect x="60" y="858" width={W - 120} height="60" rx="12" fill={accentLight} />
        <SvgText
          x={W / 2}
          y="898"
          fontSize="26"
          fontWeight="bold"
          fill={accentDark}
          textAnchor="middle"
        >
          <TSpan>📍 </TSpan>
          <TSpan>{trunc(report.last_seen_location, 44)}</TSpan>
        </SvgText>

        {/* Contato */}
        <SvgText
          x={W / 2}
          y="950"
          fontSize="32"
          fontWeight="900"
          fill="#1A1410"
          textAnchor="middle"
        >
          <TSpan>📞 </TSpan>
          <TSpan>{trunc(report.contact_info, 32)}</TSpan>
        </SvgText>

        {/* Rodapé */}
        <SvgText
          x={W / 2}
          y="985"
          fontSize="16"
          fill="#A3A3A3"
          textAnchor="middle"
        >
          Maestro Pet · ajude a espalhar
        </SvgText>
      </Svg>
    </View>
  );
}
