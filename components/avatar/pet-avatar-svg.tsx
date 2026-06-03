/**
 * Renderer SVG do Pet Avatar customizado.
 * Recebe um PetAvatarConfig e compõe as partes em um único <Svg>.
 *
 * Sistema de coordenadas: viewBox 100x100.
 * Centro do canvas: (50, 50). Cabeça desenhada centrada nesse ponto.
 * Orelhas são posicionadas relativas à cabeça.
 * Acessórios são posicionados sobre a cabeça.
 *
 * Animações sutis: avatar pode "respirar" suavemente (scale 0.98 ↔ 1) via
 * prop `breathing` e ter uma expressão de "feliz" via prop `expression`.
 */

import { memo, useEffect, useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
  LinearGradient,
} from 'react-native-svg';

import {
  COLLAR_HEX,
  resolveAvatarConfig,
} from '@/lib/pet-avatar-config';
import type {
  AvatarAccessory,
  AvatarEars,
  AvatarEyes,
  AvatarHeadShape,
  AvatarMouth,
  AvatarPattern,
  AvatarSpecies,
  PetAvatarConfig,
} from '@/lib/types';
import { useMotion } from '@/providers/motion-provider';

import { useInViewport } from './use-in-viewport';

interface Props {
  config: PetAvatarConfig | null | undefined;
  size?: number;
  /** Mostra fundo circular? Default true. */
  showBackground?: boolean;
  /** Animação sutil de respiração. Default false. */
  breathing?: boolean;
  /** Sobrescreve a expressão (útil pra reações). */
  expression?:
    | 'happy'
    | 'sad'
    | 'surprised'
    | 'love'
    | 'cry'
    | 'angry'
    | 'sleep'
    | null;
  /** Piscadinha automática a cada 3–6s. Default true. */
  idleBlink?: boolean;
  /**
   * Seed para variação determinística (ex: pet.id). Dois pets do mesmo preset
   * com seeds diferentes ficam levemente distintos (posição de pintas, etc).
   */
  seed?: string;
  /** Label customizado pra leitor de tela. Default: "Avatar de pet customizado". */
  accessibilityLabel?: string;
  /**
   * Faixa etária — altera levemente o visual:
   *  - puppy: olhos maiores (1.15×)
   *  - adult: padrão
   *  - senior: alguns fios brancos no focinho
   */
  ageStage?: 'puppy' | 'adult' | 'senior';
  /**
   * Mounting lazy: até primeiro intersect, renderiza só fundo + placeholder.
   * Útil em listas longas. Web only. Default false. Native sempre monta tudo.
   */
  lazyMount?: boolean;
  style?: ViewStyle;
}

function PetAvatarSvgInner({
  config: rawConfig,
  size = 80,
  showBackground = true,
  breathing = false,
  expression = null,
  idleBlink = true,
  seed,
  accessibilityLabel,
  ageStage = 'adult',
  lazyMount = false,
  style,
}: Props) {
  const config = resolveAvatarConfig(rawConfig);
  const { animationsEnabled } = useMotion();
  // Pausa animações quando off-screen (web only — economiza CPU em listas).
  const [viewportRef, inView] = useInViewport();
  const animActive = animationsEnabled && inView;

  // Lazy mount: marca true na primeira vez que entra no viewport. Nunca volta
  // pra false (evita flash quando rola lista). Se lazyMount=false, sempre mounta.
  const [hasBeenVisible, setHasBeenVisible] = useState(!lazyMount);
  useEffect(() => {
    if (inView && !hasBeenVisible) setHasBeenVisible(true);
  }, [inView, hasBeenVisible]);

  // Idle blink: pisca aleatoriamente a cada 3-6 segundos por ~140ms.
  // 30% das vezes faz wink (só 1 olho), 70% pisca os dois. Wink mais longo (200ms).
  // Não pisca se a expression já estiver forçada, nem se o usuário desativou animações.
  const [blinking, setBlinking] = useState<'none' | 'both' | 'left' | 'right'>('none');

  // Look around: a cada 8-13s os pupilos olham pro lado por ~800ms, depois voltam.
  const [gaze, setGaze] = useState<'center' | 'left' | 'right' | 'up'>('center');
  useEffect(() => {
    if (!idleBlink || expression || !animActive) {
      setBlinking('none');
      return;
    }
    let blinkTimeout: ReturnType<typeof setTimeout> | null = null;
    let nextTimeout: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      const delay = 3000 + Math.random() * 3000; // 3-6s
      nextTimeout = setTimeout(() => {
        // Decide o tipo: 30% wink (50/50 esquerdo/direito), 70% blink duplo
        const roll = Math.random();
        const next: 'both' | 'left' | 'right' =
          roll < 0.7 ? 'both' : roll < 0.85 ? 'left' : 'right';
        setBlinking(next);
        const duration = next === 'both' ? 140 : 220; // wink dura mais
        blinkTimeout = setTimeout(() => {
          setBlinking('none');
          schedule();
        }, duration);
      }, delay);
    };
    schedule();

    return () => {
      if (blinkTimeout) clearTimeout(blinkTimeout);
      if (nextTimeout) clearTimeout(nextTimeout);
    };
  }, [idleBlink, expression, animActive]);

  // Look around loop — separado do blink pra eventos não coincidirem.
  useEffect(() => {
    if (!idleBlink || expression || !animActive) {
      setGaze('center');
      return;
    }
    let returnTimeout: ReturnType<typeof setTimeout> | null = null;
    let nextTimeout: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      const delay = 8000 + Math.random() * 5000; // 8-13s
      nextTimeout = setTimeout(() => {
        const directions = ['left', 'right', 'up'] as const;
        const next = directions[Math.floor(Math.random() * directions.length)];
        setGaze(next);
        returnTimeout = setTimeout(() => {
          setGaze('center');
          schedule();
        }, 800);
      }, delay);
    };
    schedule();

    return () => {
      if (returnTimeout) clearTimeout(returnTimeout);
      if (nextTimeout) clearTimeout(nextTimeout);
    };
  }, [idleBlink, expression, animActive]);

  const scale = useSharedValue(1);
  useEffect(() => {
    if (!breathing || !animActive) {
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(
      withSequence(
        withTiming(0.97, { duration: 1400, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
      ),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [breathing, scale, animActive]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sizeMod = config.size_mod ?? 1.0;
  // Wrapper de scale: re-centraliza após escala pra manter o avatar centralizado
  const scaleTransform =
    sizeMod !== 1.0 ? `translate(${50 * (1 - sizeMod)} ${50 * (1 - sizeMod)}) scale(${sizeMod})` : undefined;

  // Antes da hidratação inicial, mostra só placeholder colorido (cheap).
  if (!hasBeenVisible) {
    return (
      <Animated.View
        ref={viewportRef as never}
        accessible={!!accessibilityLabel}
        accessibilityRole={accessibilityLabel ? 'image' : undefined}
        accessibilityLabel={accessibilityLabel}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: showBackground ? config.background_color : 'transparent',
          },
          animStyle,
          style,
        ]}
      />
    );
  }

  return (
    <Animated.View
      ref={viewportRef as never}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[{ width: size, height: size }, animStyle, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {showBackground ? (
          config.background_scene ? (
            renderSceneBackground(config.background_scene)
          ) : (
            <Circle cx="50" cy="50" r="50" fill={config.background_color} />
          )
        ) : null}

        {/* Define gradients shared — incluindo shading 3D pra dar volume */}
        <Defs>
          <LinearGradient id="furShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={config.fur_color} stopOpacity="1" />
            <Stop offset="100%" stopColor={config.fur_color} stopOpacity="0.78" />
          </LinearGradient>
          {/* Overlay 3D — sphere shading mais dramático pra dar volume real */}
          <RadialGradient id="shade3D" cx="32%" cy="25%" r="78%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.42" />
            <Stop offset="20%" stopColor="#FFFFFF" stopOpacity="0.18" />
            <Stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.02" />
            <Stop offset="65%" stopColor="#1A1410" stopOpacity="0.05" />
            <Stop offset="100%" stopColor="#1A1410" stopOpacity="0.32" />
          </RadialGradient>
          {/* Rim light — luz vindo da direita atmosférica (efeito cinematic) */}
          <RadialGradient id="rimLight" cx="80%" cy="55%" r="35%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.15" />
            <Stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.05" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Inner shadow embaixo da cabeça pra dar concavidade no queixo */}
          <RadialGradient id="chinShadow" cx="50%" cy="100%" r="40%">
            <Stop offset="0%" stopColor="#1A1410" stopOpacity="0.3" />
            <Stop offset="70%" stopColor="#1A1410" stopOpacity="0" />
          </RadialGradient>
          {/* Eye shine — highlight branco brilhante no quadrante superior do olho */}
          <RadialGradient id="eyeShine" cx="30%" cy="25%" r="55%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <Stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Nose shine — pequeno highlight branco no topo do focinho */}
          <RadialGradient id="noseShine" cx="35%" cy="25%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </RadialGradient>
          {/* Drop shadow — sombra suave embaixo da cabeça pra dar volume */}
          <RadialGradient id="dropShadow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#1A1410" stopOpacity="0.28" />
            <Stop offset="60%" stopColor="#1A1410" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#1A1410" stopOpacity="0" />
          </RadialGradient>
          {/* Ambient occlusion na base das orelhas — sombra suave onde encontram a cabeça */}
          <RadialGradient id="earBaseAO" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#1A1410" stopOpacity="0.32" />
            <Stop offset="100%" stopColor="#1A1410" stopOpacity="0" />
          </RadialGradient>
          {/* Cheek puff highlight — bolinha de luz nas bochechas pra parecer fofa/inchada */}
          <RadialGradient id="cheekPuff" cx="40%" cy="35%" r="60%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
            <Stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.06" />
            <Stop offset="100%" stopColor="#1A1410" stopOpacity="0.12" />
          </RadialGradient>
          {/* Fur texture overlay — pequena variação radial pra simular pelagem */}
          <RadialGradient id="furTexture" cx="35%" cy="35%" r="65%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.08" />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.02" />
            <Stop offset="100%" stopColor="#1A1410" stopOpacity="0.12" />
          </RadialGradient>
        </Defs>

        <G transform={scaleTransform}>
          {/* Drop shadow — embaixo da cabeça, atrás de tudo, dá sensação de volume/peso */}
          <Ellipse cx="50" cy="92" rx="32" ry="5" fill="url(#dropShadow)" opacity="0.7" />

          {/* Rabo (atrás de tudo) */}
          {renderTail(config)}

          {/* Orelhas atrás da cabeça (algumas) */}
          {renderEars(config, 'back')}

          {/* Cabeça + padrão */}
          {renderHead(config)}

          {/* Orelhas na frente (overlay leve) */}
          {renderEars(config, 'front')}

          {/* Padrão sobre a cabeça (mask, belly, tuxedo) */}
          {renderPattern(config, seed)}

          {/* Adorno extra de cabelo (franja, topknot, etc) */}
          {renderHairAccent(config)}

          {/* Overlay 3D — adiciona shading de esfera por cima da cabeça/padrão.
              Vem DEPOIS de head/ears/pattern e ANTES de eyes/nose/mouth pra não
              dimar os elementos do rosto, que precisam ficar nítidos. */}
          {render3DShadeOverlay(config)}

          {/* Ambient occlusion na base das orelhas — fusão entre orelha e cabeça */}
          {renderEarBaseAO(config)}

          {/* Fur texture — variação sutil simulando pelagem orgânica */}
          {renderFurTexture(config)}

          {/* Rim light — luz atmosférica vindo da direita (efeito 3D realista) */}
          {renderRimLight(config)}

          {/* Cheek puffs — volume das bochechas pra parecer fofa */}
          {renderCheekPuffs(config)}

          {/* Bochechas roseadas — seguem head_shape */}
          {renderCheeks(config)}

          {/* Sobrancelhas sutis — dão profundidade facial, especialmente em cães */}
          {renderBrowRidge(config, expression)}

          {/* Olhos (com idle blink/wink + look around + age stage) */}
          {renderEyes(config, expression, blinking, gaze, ageStage)}

          {/* Nariz */}
          {renderNose(config)}

          {/* Boca */}
          {renderMouth(config, expression)}

          {/* Peito visível embaixo da cabeça */}
          {renderChest(config)}

          {/* Coleira */}
          {renderCollar(config)}

          {/* Pingente da coleira (Pro) */}
          {renderCollarCharm(config)}

          {/* Acessório no topo */}
          {renderAccessory(config)}

          {/* Especial: pena/bico de pássaro / barbatana de peixe */}
          {renderSpeciesExtras(config)}

          {/* Toque sênior: fios brancos no focinho/têmporas */}
          {renderSeniorAccents(config, ageStage)}
        </G>
      </Svg>
    </Animated.View>
  );
}

/**
 * Comparator do React.memo: compara props primitivas + shallow equality no config.
 * O config vem do banco como JSON plano, então shallow basta. Evita re-render
 * quando parent atualiza mas pet/config do avatar não mudou (caso comum em feeds).
 */
function arePropsEqual(prev: Props, next: Props): boolean {
  if (
    prev.size !== next.size ||
    prev.showBackground !== next.showBackground ||
    prev.breathing !== next.breathing ||
    prev.expression !== next.expression ||
    prev.idleBlink !== next.idleBlink ||
    prev.seed !== next.seed ||
    prev.ageStage !== next.ageStage ||
    prev.accessibilityLabel !== next.accessibilityLabel ||
    prev.lazyMount !== next.lazyMount
  ) {
    return false;
  }
  // Style ref equality (não comparamos profundo — overhead alto, raro mudar)
  if (prev.style !== next.style) return false;

  // Config: shallow equal por campo. null/undefined OK.
  if (prev.config === next.config) return true;
  if (!prev.config || !next.config) return false;
  const a = prev.config as unknown as Record<string, unknown>;
  const b = next.config as unknown as Record<string, unknown>;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export const PetAvatarSvg = memo(PetAvatarSvgInner, arePropsEqual);

// ============================================================================
// CHEST (peito)
// ============================================================================

function renderChest(c: PetAvatarConfig) {
  const chest = c.chest ?? 'solid';
  if (chest === 'none') return null;

  let fillColor: string;
  switch (chest) {
    case 'solid':
      fillColor = c.fur_color;
      break;
    case 'white':
      fillColor = '#FFFFFF';
      break;
    case 'cream':
      fillColor = '#FCD9B6';
      break;
    case 'spotted':
      fillColor = '#FFFFFF';
      break;
    case 'fluffy':
      fillColor = c.accent_color;
      break;
    default:
      return null;
  }

  // Sombra do peito pra dar volume (cor escurecida)
  const chestShade = blendWithBlack(fillColor, 0.15);

  return (
    <G>
      {/* Sombra inferior do corpinho */}
      <Ellipse cx="50" cy="94" rx="22" ry="8" fill={chestShade} opacity="0.7" />
      {/* Base do peito — elipse arredondada como pet sentado */}
      <Ellipse cx="50" cy="92" rx="22" ry="8" fill={fillColor} />
      {/* Highlight no topo do peito (luz vinda de cima-esquerda) */}
      <Ellipse cx="44" cy="89" rx="10" ry="3" fill="#FFFFFF" opacity="0.25" />
      {/* Linha de junção pescoço-peito mais natural */}
      <Path
        d="M 34 86 Q 50 81 66 86 L 66 89 Q 50 84 34 89 Z"
        fill={fillColor}
        opacity="0.9"
      />
      {/* Detalhe: pintas no peito do Dálmata */}
      {chest === 'spotted' ? (
        <G>
          <Circle cx="46" cy="92" r="1.6" fill="#1A1410" opacity="0.85" />
          <Circle cx="54" cy="93" r="1.4" fill="#1A1410" opacity="0.85" />
          <Circle cx="50" cy="89" r="1.2" fill="#1A1410" opacity="0.85" />
        </G>
      ) : null}
      {/* Detalhe: peito peludo do Pomerânia/Chow — pufes 3D */}
      {chest === 'fluffy' ? (
        <G>
          {/* Sombra dos pufes */}
          <Circle cx="36" cy="91.5" r="4" fill={chestShade} opacity="0.7" />
          <Circle cx="64" cy="91.5" r="4" fill={chestShade} opacity="0.7" />
          <Circle cx="50" cy="96.5" r="4" fill={chestShade} opacity="0.7" />
          {/* Pufes */}
          <Circle cx="36" cy="91" r="4" fill={fillColor} />
          <Circle cx="64" cy="91" r="4" fill={fillColor} />
          <Circle cx="50" cy="96" r="4" fill={fillColor} />
          {/* Highlights nos pufes */}
          <Circle cx="35" cy="90" r="1.2" fill="#FFFFFF" opacity="0.35" />
          <Circle cx="63" cy="90" r="1.2" fill="#FFFFFF" opacity="0.35" />
          <Circle cx="49" cy="95" r="1.2" fill="#FFFFFF" opacity="0.35" />
        </G>
      ) : null}
    </G>
  );
}

// ============================================================================
// TAIL (rabo)
// ============================================================================

function renderTail(c: PetAvatarConfig) {
  const tail = c.tail ?? 'none';
  if (tail === 'none') return null;
  const fur = c.fur_color;
  // Sombra do rabo: cor escurecida pra dar volume
  const shade = blendWithBlack(fur, 0.22);
  // Stroke fino pra dar contorno definido sem parecer cartoon
  const tailStroke = blendWithBlack(fur, 0.35);

  switch (tail) {
    case 'bushy':
      // Husky/Pastor — rabo grosso e peludo subindo
      return (
        <G>
          {/* Sombra inferior (cor mais escura) */}
          <Ellipse cx="87" cy="80" rx="6" ry="14" fill={shade} transform="rotate(-30 87 80)" />
          {/* Corpo do rabo com contorno */}
          <Ellipse cx="86" cy="78" rx="6" ry="14" fill={fur} stroke={tailStroke} strokeWidth="0.5" strokeOpacity="0.5" transform="rotate(-30 86 78)" />
          {/* Highlight no topo (opacidade maior) */}
          <Ellipse cx="84" cy="74" rx="2.5" ry="8" fill="#FFFFFF" opacity="0.28" transform="rotate(-30 84 74)" />
          {/* Pontinha peluda — opaca (não transparente) */}
          <Ellipse cx="92" cy="70" rx="4" ry="6" fill={fur} stroke={tailStroke} strokeWidth="0.4" strokeOpacity="0.4" transform="rotate(-30 92 70)" />
          {/* Detalhe de pelos no topo */}
          <Path d="M 92 64 L 90 68 M 94 66 L 92 70 M 96 70 L 94 74" stroke={tailStroke} strokeWidth="0.7" strokeOpacity="0.7" strokeLinecap="round" />
        </G>
      );
    case 'curly':
      // Pug/Akita — rabo enrolado pra cima com volume
      return (
        <G>
          <Path d="M 80 80 Q 92 76 92 86 Q 86 92 82 86 Z" fill={shade} />
          <Path d="M 79 79 Q 91 75 91 85 Q 85 91 81 85 Z" fill={fur} stroke={tailStroke} strokeWidth="0.5" strokeOpacity="0.5" />
          {/* Highlight no curvy */}
          <Path d="M 83 78 Q 88 76 89 81" stroke="#FFFFFF" strokeWidth="0.9" strokeOpacity="0.55" fill="none" strokeLinecap="round" />
        </G>
      );
    case 'long':
      // Golden/Lab — rabo longo abanando com volume
      return (
        <G>
          {/* Sombra debaixo */}
          <Path d="M 78 87 Q 92 83 96 71 L 92 71 Q 88 83 76 91 Z" fill={shade} />
          {/* Corpo com stroke definido */}
          <Path d="M 78 86 Q 92 82 96 70 L 92 70 Q 88 82 76 90 Z" fill={fur} stroke={tailStroke} strokeWidth="0.5" strokeOpacity="0.5" />
          {/* Highlight ao longo do rabo (mais visível) */}
          <Path d="M 80 84 Q 89 80 93 71" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.55" fill="none" strokeLinecap="round" />
        </G>
      );
    case 'pointed':
      // Dálmata/Doberman — rabo fino reto saindo pro lado
      return (
        <G>
          <Path d="M 78 83 L 96 77 L 96 81 L 78 87 Z" fill={shade} />
          <Path d="M 78 82 L 96 76 L 96 80 L 78 86 Z" fill={fur} stroke={tailStroke} strokeWidth="0.5" strokeOpacity="0.55" />
          {/* Highlight mais visível */}
          <Path d="M 80 80 L 94 76" stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.6" strokeLinecap="round" />
        </G>
      );
    case 'cropped':
      // Boxer/Pinscher — coto curto pra cima
      return (
        <G>
          <Ellipse cx="82.5" cy="81" rx="3" ry="5" fill={shade} transform="rotate(-20 82.5 81)" />
          <Ellipse cx="82" cy="80" rx="3" ry="5" fill={fur} stroke={tailStroke} strokeWidth="0.4" strokeOpacity="0.5" transform="rotate(-20 82 80)" />
          {/* Mini highlight (opacidade aumentada) */}
          <Ellipse cx="81" cy="78" rx="1" ry="2" fill="#FFFFFF" opacity="0.45" transform="rotate(-20 81 78)" />
        </G>
      );
    default:
      return null;
  }
}

// ============================================================================
// HAIR ACCENT (franja / topknot / parted)
// ============================================================================

function renderHairAccent(c: PetAvatarConfig) {
  if (!c.hair_accent) return null;
  const fur = c.fur_color;
  const accent = c.accent_color;

  switch (c.hair_accent) {
    case 'topknot':
      // Cocada/nó no topo da cabeça — Yorkshire
      // Mecha levantada + lacinho colorido. Coords ajustadas pra ficar
      // ACIMA da cabeça (topo da cabeça round = y=23) mesmo com size_mod.
      return (
        <G>
          {/* Mecha levantada saindo do topo */}
          <Path
            d="M 44 22 Q 50 12 56 22 Q 54 26 50 26 Q 46 26 44 22 Z"
            fill={fur}
            stroke="#1A1410"
            strokeOpacity="0.12"
            strokeWidth="0.6"
          />
          {/* Lacinho rosa no topknot — acima da cabeça */}
          <Ellipse cx="46" cy="18" rx="3.5" ry="2.5" fill="#EC4899" />
          <Ellipse cx="54" cy="18" rx="3.5" ry="2.5" fill="#EC4899" />
          <Circle cx="50" cy="18" r="1.6" fill="#BE185D" />
        </G>
      );
    case 'fringe':
      // Franja caída sobre os olhos — Shih Tzu
      return (
        <G>
          <Path
            d="M 28 40 Q 32 50 36 48 Q 38 46 40 50 Q 44 46 46 50 Q 50 46 54 50 Q 56 46 60 50 Q 62 46 64 48 Q 68 50 72 40 Q 70 38 50 38 Q 30 38 28 40 Z"
            fill={fur}
            opacity="0.95"
            stroke="#1A1410"
            strokeOpacity="0.12"
            strokeWidth="0.5"
          />
          {/* Sombra sob a franja para volume */}
          <Path
            d="M 32 46 Q 38 49 44 47 Q 50 49 56 47 Q 62 49 68 46"
            stroke={accent}
            strokeOpacity="0.55"
            strokeWidth="0.8"
            fill="none"
          />
        </G>
      );
    case 'parted':
      // Cabelo repartido no meio — Maltês de show
      return (
        <G>
          <Path
            d="M 30 32 Q 38 26 44 30 L 44 50 Q 38 44 32 44 Z"
            fill={fur}
            opacity="0.92"
          />
          <Path
            d="M 70 32 Q 62 26 56 30 L 56 50 Q 62 44 68 44 Z"
            fill={fur}
            opacity="0.92"
          />
          {/* Risca central */}
          <Path
            d="M 50 26 L 50 38"
            stroke="#1A1410"
            strokeOpacity="0.15"
            strokeWidth="0.5"
          />
        </G>
      );
    case 'shaggy':
      // Pelos desgrenhados extras — Border Collie / Old English
      return (
        <G>
          <Path
            d="M 22 50 Q 26 44 30 50 Q 26 56 22 50 Z"
            fill={fur}
            opacity="0.85"
          />
          <Path
            d="M 78 50 Q 74 44 70 50 Q 74 56 78 50 Z"
            fill={fur}
            opacity="0.85"
          />
          <Path
            d="M 38 30 Q 42 24 46 30 Z"
            fill={fur}
            opacity="0.8"
          />
          <Path
            d="M 54 30 Q 58 24 62 30 Z"
            fill={fur}
            opacity="0.8"
          />
        </G>
      );
    default:
      return null;
  }
}

// ============================================================================
// SCENE BACKGROUNDS — cenários Pro (parque, praia, etc)
// ============================================================================

function renderSceneBackground(scene: NonNullable<PetAvatarConfig['background_scene']>) {
  switch (scene) {
    case 'park':
      // Gradiente verde grama + sol amarelo
      return (
        <G>
          <Defs>
            <LinearGradient id="bg-park" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#7DD3FC" stopOpacity="1" />
              <Stop offset="60%" stopColor="#DCFCE7" stopOpacity="1" />
              <Stop offset="100%" stopColor="#86EFAC" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#bg-park)" />
          {/* Sol */}
          <Circle cx="78" cy="22" r="6" fill="#FBBF24" opacity="0.85" />
          {/* Pequenas montanhas */}
          <Path d="M 0 70 L 20 50 L 40 70 Z" fill="#16A34A" opacity="0.4" />
          <Path d="M 60 70 L 80 50 L 100 70 Z" fill="#16A34A" opacity="0.4" />
        </G>
      );
    case 'beach':
      // Areia + mar
      return (
        <G>
          <Defs>
            <LinearGradient id="bg-beach" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#7DD3FC" stopOpacity="1" />
              <Stop offset="55%" stopColor="#3B82F6" stopOpacity="0.5" />
              <Stop offset="65%" stopColor="#FEF3C7" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FCD9B6" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#bg-beach)" />
          {/* Sol */}
          <Circle cx="20" cy="20" r="5" fill="#FBBF24" />
          {/* Conchinhas */}
          <Circle cx="14" cy="80" r="2" fill="#FBA9CC" opacity="0.7" />
          <Circle cx="80" cy="84" r="1.5" fill="#FFFFFF" opacity="0.7" />
        </G>
      );
    case 'night':
      // Céu noturno + estrelas
      return (
        <G>
          <Defs>
            <LinearGradient id="bg-night" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#1E3A8A" stopOpacity="1" />
              <Stop offset="100%" stopColor="#7C3AED" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#bg-night)" />
          {/* Estrelas */}
          <Circle cx="15" cy="18" r="0.9" fill="#FFFFFF" />
          <Circle cx="82" cy="14" r="1.2" fill="#FFFFFF" />
          <Circle cx="22" cy="32" r="0.6" fill="#FFFFFF" />
          <Circle cx="78" cy="36" r="0.8" fill="#FFFFFF" />
          <Circle cx="12" cy="62" r="0.7" fill="#FFFFFF" />
          <Circle cx="88" cy="70" r="0.9" fill="#FFFFFF" />
          {/* Lua */}
          <Circle cx="76" cy="22" r="5" fill="#FEF3C7" opacity="0.9" />
          <Circle cx="78" cy="20" r="4" fill="#1E3A8A" />
        </G>
      );
    case 'birthday':
      // Confetes coloridos sobre fundo claro
      return (
        <G>
          <Circle cx="50" cy="50" r="50" fill="#FCE7F3" />
          {/* Confetes — vários retângulos rotacionados */}
          <Rect x="14" y="18" width="3" height="6" fill="#EF4444" transform="rotate(20 15.5 21)" />
          <Rect x="82" y="22" width="3" height="6" fill="#3B82F6" transform="rotate(-30 83.5 25)" />
          <Rect x="20" y="74" width="3" height="6" fill="#10B981" transform="rotate(45 21.5 77)" />
          <Rect x="78" y="76" width="3" height="6" fill="#FBBF24" transform="rotate(-20 79.5 79)" />
          <Rect x="10" y="48" width="3" height="6" fill="#A855F7" transform="rotate(60 11.5 51)" />
          <Rect x="88" y="50" width="3" height="6" fill="#F97316" transform="rotate(-45 89.5 53)" />
          {/* Estrelas brilhando */}
          <Circle cx="25" cy="30" r="1.2" fill="#FBBF24" />
          <Circle cx="76" cy="62" r="1.2" fill="#EC4899" />
        </G>
      );
    case 'snow':
      // Azul claro com flocos
      return (
        <G>
          <Defs>
            <LinearGradient id="bg-snow" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#DBEAFE" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#bg-snow)" />
          {/* Flocos */}
          <Circle cx="18" cy="22" r="1.5" fill="#FFFFFF" stroke="#7DD3FC" strokeWidth="0.4" />
          <Circle cx="78" cy="18" r="1.8" fill="#FFFFFF" stroke="#7DD3FC" strokeWidth="0.4" />
          <Circle cx="86" cy="48" r="1.2" fill="#FFFFFF" stroke="#7DD3FC" strokeWidth="0.4" />
          <Circle cx="14" cy="60" r="1.5" fill="#FFFFFF" stroke="#7DD3FC" strokeWidth="0.4" />
          <Circle cx="24" cy="80" r="1.2" fill="#FFFFFF" stroke="#7DD3FC" strokeWidth="0.4" />
          <Circle cx="82" cy="82" r="1.8" fill="#FFFFFF" stroke="#7DD3FC" strokeWidth="0.4" />
        </G>
      );
    case 'sunset':
      return (
        <G>
          <Defs>
            <LinearGradient id="bg-sunset" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#A855F7" stopOpacity="1" />
              <Stop offset="50%" stopColor="#F97316" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FBBF24" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#bg-sunset)" />
          {/* Sol grande no horizonte */}
          <Circle cx="50" cy="60" r="14" fill="#FEF3C7" opacity="0.7" />
        </G>
      );
    default:
      return <Circle cx="50" cy="50" r="50" fill="#FFEDD5" />;
  }
}

// ============================================================================
// HEAD BOUNDS — fonte da verdade pra patterns, bochechas, olhos, boca, etc.
// ============================================================================

interface HeadBounds {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function getHeadBounds(shape: AvatarHeadShape): HeadBounds {
  switch (shape) {
    case 'round':
      return { cx: 50, cy: 55, rx: 32, ry: 32, top: 23, bottom: 87, left: 18, right: 82 };
    case 'oval':
      return { cx: 50, cy: 55, rx: 28, ry: 34, top: 21, bottom: 89, left: 22, right: 78 };
    case 'wide':
      return { cx: 50, cy: 56, rx: 36, ry: 28, top: 28, bottom: 84, left: 14, right: 86 };
    case 'long':
      return { cx: 50, cy: 58, rx: 24, ry: 36, top: 22, bottom: 94, left: 26, right: 74 };
    case 'square':
      return { cx: 50, cy: 57, rx: 32, ry: 29, top: 28, bottom: 86, left: 18, right: 82 };
    case 'egg':
      return { cx: 50, cy: 53, rx: 27, ry: 31, top: 22, bottom: 84, left: 23, right: 77 };
    default:
      return { cx: 50, cy: 55, rx: 32, ry: 32, top: 23, bottom: 87, left: 18, right: 82 };
  }
}

// ============================================================================
// SEEDED RANDOM — variação dentro da mesma raça (pet.id como seed)
// ============================================================================

/**
 * Hash determinístico de string → número 0-1. Usado pra deslocar pintas/manchas
 * em ±2-3px de acordo com o pet, dando individualidade a dois pets do mesmo preset.
 */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h / 0xffffffff;
}

/**
 * Retorna um número determinístico entre min e max usando seed.
 * Permutado pelo `nonce` (string curta) pra ter múltiplos números independentes
 * a partir do mesmo seed.
 */
function seededRange(seed: string | undefined, nonce: string, min: number, max: number): number {
  if (!seed) return (min + max) / 2;
  return min + hashString(seed + ':' + nonce) * (max - min);
}

// ============================================================================
// HEAD
// ============================================================================

function renderHead(c: PetAvatarConfig) {
  const shape = c.head_shape;
  // Paths anatômicos: cabeça + bochechas + queixo unificados numa silhueta orgânica.
  // Cada formato tem características específicas (snout, jaw, cheekbones).
  // Comum a todos: stroke sutil pra delimitar do background sem parecer cartoon outline.
  const commonProps = {
    fill: 'url(#furShade)',
    // Stroke sutil pra dar definição sem parecer cartoon outline
    stroke: '#1A1410',
    strokeOpacity: 0.12,
    strokeWidth: 0.4,
  };

  switch (shape) {
    case 'round':
      // Cabeça redonda com bochechas saltadas e queixo sutil (Shih Tzu, gato)
      return (
        <Path
          d="
            M 50 22
            C 35 22, 22 32, 20 48
            C 19 56, 21 64, 26 70
            C 30 76, 36 80, 42 82
            C 45 83, 50 83, 50 83
            C 50 83, 55 83, 58 82
            C 64 80, 70 76, 74 70
            C 79 64, 81 56, 80 48
            C 78 32, 65 22, 50 22
            Z
          "
          {...commonProps}
        />
      );
    case 'oval':
      // Cabeça oval com queixo afinado e bochechas suaves (Golden, Labrador)
      return (
        <Path
          d="
            M 50 20
            C 36 20, 24 30, 23 46
            C 22 56, 24 64, 28 71
            C 32 78, 38 83, 44 85
            C 47 86, 50 86, 50 86
            C 50 86, 53 86, 56 85
            C 62 83, 68 78, 72 71
            C 76 64, 78 56, 77 46
            C 76 30, 64 20, 50 20
            Z
          "
          {...commonProps}
        />
      );
    case 'wide':
      // Cabeça larga com bochechas proeminentes e snout achatado (Bulldog, Persa)
      return (
        <Path
          d="
            M 50 26
            C 32 26, 18 36, 16 50
            C 15 58, 18 66, 24 72
            C 30 78, 38 82, 46 83
            C 48 83, 50 83, 50 83
            C 50 83, 52 83, 54 83
            C 62 82, 70 78, 76 72
            C 82 66, 85 58, 84 50
            C 82 36, 68 26, 50 26
            Z
          "
          {...commonProps}
        />
      );
    case 'long':
      // Cabeça longa com focinho proeminente (Collie, Dachshund, raposa)
      return (
        <Path
          d="
            M 50 18
            C 38 18, 28 28, 27 42
            C 26 52, 27 62, 30 70
            C 33 78, 38 84, 44 87
            C 46 88, 50 88, 50 88
            C 50 88, 54 88, 56 87
            C 62 84, 67 78, 70 70
            C 73 62, 74 52, 73 42
            C 72 28, 62 18, 50 18
            Z
          "
          {...commonProps}
        />
      );
    case 'square':
      // Cabeça quadrada com mandíbula proeminente (Boxer, Rottweiler, Pitbull)
      return (
        <Path
          d="
            M 30 26
            C 22 26, 17 32, 17 42
            L 17 64
            C 17 72, 20 78, 26 82
            C 32 86, 40 87, 50 87
            C 60 87, 68 86, 74 82
            C 80 78, 83 72, 83 64
            L 83 42
            C 83 32, 78 26, 70 26
            C 64 25, 58 24, 50 24
            C 42 24, 36 25, 30 26
            Z
          "
          {...commonProps}
        />
      );
    case 'egg':
      // Cabeça em ovo (Bull Terrier) — estreita em cima, larga embaixo
      return (
        <Path
          d="
            M 50 21
            C 40 21, 31 26, 27 36
            C 24 44, 23 54, 25 64
            C 27 74, 33 81, 42 85
            C 45 86, 50 86, 50 86
            C 50 86, 55 86, 58 85
            C 67 81, 73 74, 75 64
            C 77 54, 76 44, 73 36
            C 69 26, 60 21, 50 21
            Z
          "
          {...commonProps}
        />
      );
  }
}

// ============================================================================
// EARS
// ============================================================================

function renderEars(c: PetAvatarConfig, layer: 'back' | 'front') {
  const showInBack = (
    [
      'pointed_up',
      'pointed_side',
      'long_droopy',
      'tall_round',
      'round',
      'bat',
      'cropped',
      'fluffy_down',
    ] as AvatarEars[]
  ).includes(c.ears);
  if (layer === 'back' && !showInBack) return null;
  if (layer === 'front' && showInBack) return null;

  // Pelagem longa cobre parcialmente orelhas peludas/caídas — opacity reduzida
  // dá impressão que estão sob o cabelo (Shih Tzu, Maltês, Lhasa).
  const fadeByLongHair =
    c.pattern === 'long_hair' &&
    (['fluffy_down', 'droopy', 'long_droopy'] as AvatarEars[]).includes(c.ears);

  const fur = c.fur_color;
  const innerColor = blendWithBlack(fur, 0.4);

  const earsContent = renderEarsByShape(c.ears, fur, innerColor);

  if (fadeByLongHair && earsContent) {
    // Reduz menos — antes 0.55 deixava orelhas quase invisíveis sob pelagem longa
    return <G opacity="0.8">{earsContent}</G>;
  }
  return earsContent;
}

function renderEarsByShape(ears: AvatarEars, fur: string, innerColor: string) {
  // Cor rosa do interior da orelha (consistente em todas as variantes que mostram interior)
  const earInnerPink = '#FBA9CC';
  // Cor escurecida pra contornos sutis das orelhas (definição sem parecer cartoon)
  const earStroke = blendWithBlack(fur, 0.3);
  switch (ears) {
    case 'pointed_up':
      // Gato — triângulos pra cima com inner ear definido
      return (
        <G>
          {/* Outer ear shape com stroke sutil pra definir contorno */}
          <Path d="M 20 38 Q 22 14 32 14 Q 40 22 42 34 Q 32 38 20 38 Z" fill={fur} stroke={earStroke} strokeWidth="0.5" strokeOpacity="0.4" />
          <Path d="M 80 38 Q 78 14 68 14 Q 60 22 58 34 Q 68 38 80 38 Z" fill={fur} stroke={earStroke} strokeWidth="0.5" strokeOpacity="0.4" />
          {/* Sombra na base (onde encosta na cabeça) */}
          <Path d="M 24 36 Q 28 33 42 34 Q 38 38 24 38 Z" fill="#1A1410" opacity="0.22" />
          <Path d="M 76 36 Q 72 33 58 34 Q 62 38 76 38 Z" fill="#1A1410" opacity="0.22" />
          {/* Inner ear (rosa) — triângulo menor com opacidade maior */}
          <Path d="M 28 32 Q 30 22 35 22 Q 38 28 36 32 Q 32 33 28 32 Z" fill={earInnerPink} opacity="0.85" />
          <Path d="M 72 32 Q 70 22 65 22 Q 62 28 64 32 Q 68 33 72 32 Z" fill={earInnerPink} opacity="0.85" />
          {/* Highlight no topo de cada orelha */}
          <Path d="M 27 22 Q 30 17 33 17" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.55" fill="none" strokeLinecap="round" />
          <Path d="M 73 22 Q 70 17 67 17" stroke="#FFFFFF" strokeWidth="0.6" strokeOpacity="0.55" fill="none" strokeLinecap="round" />
        </G>
      );
    case 'pointed_side':
      // Shiba — pontudas mas pendendo pros lados, com inner ear
      return (
        <G>
          <Path d="M 16 44 Q 18 22 30 22 Q 40 32 40 38 Q 28 44 16 44 Z" fill={fur} stroke={earStroke} strokeWidth="0.5" strokeOpacity="0.4" />
          <Path d="M 84 44 Q 82 22 70 22 Q 60 32 60 38 Q 72 44 84 44 Z" fill={fur} stroke={earStroke} strokeWidth="0.5" strokeOpacity="0.4" />
          {/* Inner ear com opacidade maior */}
          <Path d="M 22 38 Q 24 28 30 28 Q 32 34 32 38 Q 26 39 22 38 Z" fill={earInnerPink} opacity="0.7" />
          <Path d="M 78 38 Q 76 28 70 28 Q 68 34 68 38 Q 74 39 78 38 Z" fill={earInnerPink} opacity="0.7" />
        </G>
      );
    case 'droopy':
      // Beagle/Cocker/Golden — orelhas caídas com inner ear visível na parte de cima
      return (
        <G>
          {/* Outer orelha com stroke definindo silhueta */}
          <Path d="M 18 38 Q 12 50 16 64 Q 22 70 30 62 Q 34 50 32 38 Q 26 34 18 38 Z" fill={fur} stroke={earStroke} strokeWidth="0.5" strokeOpacity="0.45" />
          <Path d="M 82 38 Q 88 50 84 64 Q 78 70 70 62 Q 66 50 68 38 Q 74 34 82 38 Z" fill={fur} stroke={earStroke} strokeWidth="0.5" strokeOpacity="0.45" />
          {/* Sombra na base (encontra com a cabeça) — mais visível */}
          <Ellipse cx="24" cy="40" rx="8" ry="3" fill="#1A1410" opacity="0.2" />
          <Ellipse cx="76" cy="40" rx="8" ry="3" fill="#1A1410" opacity="0.2" />
          {/* Inner ear (rosa) — visível no topo da orelha, opacidade aumentada */}
          <Path d="M 22 40 Q 19 48 22 56 Q 26 56 27 48 Q 28 42 22 40 Z" fill={earInnerPink} opacity="0.55" />
          <Path d="M 78 40 Q 81 48 78 56 Q 74 56 73 48 Q 72 42 78 40 Z" fill={earInnerPink} opacity="0.55" />
        </G>
      );
    case 'long_droopy':
      // Basset/Dachshund — orelhas muito longas que descem
      return (
        <G>
          <Path d="M 14 38 Q 6 56 12 76 Q 22 80 28 70 Q 34 52 30 36 Q 22 32 14 38 Z" fill={fur} stroke={earStroke} strokeWidth="0.5" strokeOpacity="0.45" />
          <Path d="M 86 38 Q 94 56 88 76 Q 78 80 72 70 Q 66 52 70 36 Q 78 32 86 38 Z" fill={fur} stroke={earStroke} strokeWidth="0.5" strokeOpacity="0.45" />
          {/* Sombra base */}
          <Ellipse cx="22" cy="38" rx="9" ry="3" fill="#1A1410" opacity="0.2" />
          <Ellipse cx="78" cy="38" rx="9" ry="3" fill="#1A1410" opacity="0.2" />
          {/* Inner ear visível — opacidade aumentada */}
          <Path d="M 18 42 Q 14 56 18 70 Q 22 70 24 58 Q 25 46 18 42 Z" fill={earInnerPink} opacity="0.45" />
          <Path d="M 82 42 Q 86 56 82 70 Q 78 70 76 58 Q 75 46 82 42 Z" fill={earInnerPink} opacity="0.45" />
        </G>
      );
    case 'round':
      // Urso/coelho redondo — orelhas circulares
      return (
        <G>
          <Circle cx="22" cy="34" r="10" fill={fur} stroke={earStroke} strokeWidth="0.5" strokeOpacity="0.4" />
          <Circle cx="78" cy="34" r="10" fill={fur} stroke={earStroke} strokeWidth="0.5" strokeOpacity="0.4" />
          {/* Sombra base */}
          <Ellipse cx="24" cy="40" rx="7" ry="2" fill="#1A1410" opacity="0.22" />
          <Ellipse cx="76" cy="40" rx="7" ry="2" fill="#1A1410" opacity="0.22" />
          {/* Inner ear rosa — opacidade aumentada */}
          <Circle cx="23" cy="33" r="5.5" fill={earInnerPink} opacity="0.75" />
          <Circle cx="77" cy="33" r="5.5" fill={earInnerPink} opacity="0.75" />
          {/* Inner core mais escuro pra profundidade */}
          <Circle cx="23" cy="34" r="3" fill={earInnerPink} opacity="0.85" />
          <Circle cx="77" cy="34" r="3" fill={earInnerPink} opacity="0.85" />
        </G>
      );
    case 'tall_round':
      // Coelho — orelhas longas redondas com inner pink profundo
      return (
        <G>
          <Ellipse cx="36" cy="18" rx="6" ry="18" fill={fur} stroke={earStroke} strokeWidth="0.5" strokeOpacity="0.4" />
          <Ellipse cx="64" cy="18" rx="6" ry="18" fill={fur} stroke={earStroke} strokeWidth="0.5" strokeOpacity="0.4" />
          {/* Sombra base */}
          <Ellipse cx="36" cy="34" rx="5" ry="2" fill="#1A1410" opacity="0.22" />
          <Ellipse cx="64" cy="34" rx="5" ry="2" fill="#1A1410" opacity="0.22" />
          {/* Inner ear rosa — opacidade aumentada pra ficar mais visível */}
          <Ellipse cx="36" cy="20" rx="3.5" ry="14" fill={earInnerPink} opacity="0.75" />
          <Ellipse cx="64" cy="20" rx="3.5" ry="14" fill={earInnerPink} opacity="0.75" />
          {/* Inner core mais saturado no centro */}
          <Ellipse cx="36" cy="22" rx="1.8" ry="10" fill={earInnerPink} opacity="0.7" />
          <Ellipse cx="64" cy="22" rx="1.8" ry="10" fill={earInnerPink} opacity="0.7" />
        </G>
      );
    case 'tiny':
      return (
        <G>
          <Ellipse cx="30" cy="32" rx="6" ry="5" fill={fur} />
          <Ellipse cx="70" cy="32" rx="6" ry="5" fill={fur} />
        </G>
      );
    case 'bat':
      // Bulldog Francês / Chihuahua — orelhas GRANDES triangulares arredondadas
      return (
        <G>
          <Path d="M 14 38 Q 12 18 28 16 Q 38 26 36 38 Q 28 42 14 38 Z" fill={fur} />
          <Path d="M 86 38 Q 88 18 72 16 Q 62 26 64 38 Q 72 42 86 38 Z" fill={fur} />
          {/* Interior rosa */}
          <Path d="M 20 32 Q 22 22 28 22 Q 32 30 30 36 Z" fill={innerColor} opacity="0.45" />
          <Path d="M 80 32 Q 78 22 72 22 Q 68 30 70 36 Z" fill={innerColor} opacity="0.45" />
        </G>
      );
    case 'cropped':
      // Doberman / Pinscher / Schnauzer — orelhas pontudas curtas (cropped)
      return (
        <G>
          <Path d="M 26 36 L 28 18 L 38 32 Z" fill={fur} />
          <Path d="M 74 36 L 72 18 L 62 32 Z" fill={fur} />
        </G>
      );
    case 'fluffy_down':
      // Shih Tzu / Yorkshire / Maltês — orelhas pendentes peludas (caem com volume)
      return (
        <G>
          <Path d="M 14 40 Q 8 60 20 78 Q 32 76 30 50 Q 28 38 14 40 Z" fill={fur} />
          <Path d="M 86 40 Q 92 60 80 78 Q 68 76 70 50 Q 72 38 86 40 Z" fill={fur} />
          {/* Textura peluda — pontos pra dar volume */}
          <Circle cx="18" cy="56" r="2" fill={innerColor} opacity="0.2" />
          <Circle cx="22" cy="68" r="2.5" fill={innerColor} opacity="0.2" />
          <Circle cx="82" cy="56" r="2" fill={innerColor} opacity="0.2" />
          <Circle cx="78" cy="68" r="2.5" fill={innerColor} opacity="0.2" />
        </G>
      );
    case 'none':
      return null;
  }
}

// ============================================================================
// PATTERN — desenhado por cima da cabeça (mask, belly, tuxedo, etc)
// ============================================================================

function renderPattern(c: PetAvatarConfig, seed?: string) {
  const h = getHeadBounds(c.head_shape);

  switch (c.pattern) {
    case 'solid':
      return null;
    case 'spots': {
      // Pintas espalhadas — tamanhos variados + jitter seedado.
      // 5 pintas com raio mix (Dálmata real tem pintas grandes e pequenas).
      const dy = (frac: number) => h.top + h.ry * 2 * frac;
      const dx = (frac: number) => h.left + h.rx * 2 * frac;
      const j = (nonce: string) => seededRange(seed, nonce, -2, 2);
      return (
        <G>
          <Circle
            cx={dx(0.28) + j('s1x')}
            cy={dy(0.32) + j('s1y')}
            r={2.5 + seededRange(seed, 's1r', 0, 1.5)}
            fill={c.accent_color}
            opacity="0.88"
          />
          <Circle
            cx={dx(0.65) + j('s2x')}
            cy={dy(0.36) + j('s2y')}
            r={2 + seededRange(seed, 's2r', 0, 1)}
            fill={c.accent_color}
            opacity="0.88"
          />
          <Circle
            cx={dx(0.78) + j('s3x')}
            cy={dy(0.62) + j('s3y')}
            r={3 + seededRange(seed, 's3r', 0, 1.2)}
            fill={c.accent_color}
            opacity="0.88"
          />
          <Circle
            cx={dx(0.32) + j('s4x')}
            cy={dy(0.72) + j('s4y')}
            r={2.5 + seededRange(seed, 's4r', 0, 1)}
            fill={c.accent_color}
            opacity="0.88"
          />
          <Circle
            cx={dx(0.85) + j('s5x')}
            cy={dy(0.5) + j('s5y')}
            r={1.5 + seededRange(seed, 's5r', 0, 0.8)}
            fill={c.accent_color}
            opacity="0.88"
          />
        </G>
      );
    }
    case 'patches': {
      // Duas manchas grandes assimétricas. Posições seguem head bounds + jitter.
      const lx = h.left + h.rx * 0.25;
      const ly = h.cy - h.ry * 0.3;
      const rx = h.right - h.rx * 0.4;
      const ry = h.cy - h.ry * 0.4;
      const j = (nonce: string) => seededRange(seed, nonce, -2.5, 2.5);
      return (
        <G>
          <Path
            d={`M ${lx + j('plx1')} ${ly} Q ${lx - 4} ${ly + 18} ${lx + 10} ${ly + 24} Q ${lx + 16} ${ly + 18} ${lx + 12} ${ly} Z`}
            fill={c.accent_color}
            opacity="0.92"
          />
          <Path
            d={`M ${rx + j('prx1')} ${ry} Q ${rx + 16} ${ry + 2} ${rx + 12} ${ry + 18} Q ${rx + 4} ${ry + 22} ${rx} ${ry + 12} Z`}
            fill={c.accent_color}
            opacity="0.92"
          />
        </G>
      );
    }
    case 'stripes': {
      // Listras tigradas seguindo head_shape + M na testa pra gatos
      const stripes = [
        { y: h.top + h.ry * 0.5, height: 4 },
        { y: h.cy - 5, height: 3 },
        { y: h.cy + h.ry * 0.25, height: 3 },
      ];
      return (
        <G>
          {stripes.map((s, i) => (
            <Path
              key={i}
              d={`M ${h.left + 4} ${s.y} Q 50 ${s.y - 4} ${h.right - 4} ${s.y} L ${h.right - 4} ${s.y + s.height} Q 50 ${s.y + s.height - 4} ${h.left + 4} ${s.y + s.height} Z`}
              fill={c.accent_color}
              opacity="0.5"
            />
          ))}
          {/* M na testa — só gato tigrado real tem */}
          {c.species === 'cat' ? (
            <G stroke={c.accent_color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7">
              <Path d={`M 44 ${h.top + 8} L 47 ${h.top + 14} L 50 ${h.top + 10} L 53 ${h.top + 14} L 56 ${h.top + 8}`} />
            </G>
          ) : null}
        </G>
      );
    }
    case 'mask':
      // Máscara escura ao redor dos olhos — segue largura da cabeça
      return (
        <Ellipse
          cx={h.cx}
          cy={50}
          rx={Math.min(h.rx * 0.7, 24)}
          ry={9}
          fill={c.accent_color}
          opacity="0.85"
        />
      );
    case 'belly':
      // Ventre / queixo mais claro — segue largura da cabeça
      return (
        <Ellipse
          cx={h.cx}
          cy={h.cy + h.ry * 0.6}
          rx={Math.min(h.rx * 0.6, 18)}
          ry={9}
          fill={c.accent_color}
          opacity="0.95"
        />
      );
    case 'tuxedo':
      // Smoking — peito branco em V
      return (
        <Path
          d="M 36 70 Q 50 84 64 70 L 64 90 L 36 90 Z"
          fill={c.accent_color}
          opacity="0.95"
        />
      );
    case 'wrinkles':
      // Pug / Bulldog / Schnauzer — linhas finas de rugas no rosto
      return (
        <G stroke="#1A1410" strokeOpacity="0.18" strokeWidth="0.7" strokeLinecap="round" fill="none">
          <Path d="M 36 46 Q 32 48 30 52" />
          <Path d="M 64 46 Q 68 48 70 52" />
          <Path d="M 40 58 Q 35 60 32 62" />
          <Path d="M 60 58 Q 65 60 68 62" />
          <Path d="M 44 68 Q 42 70 40 71" />
          <Path d="M 56 68 Q 58 70 60 71" />
        </G>
      );
    case 'long_hair': {
      // Shih Tzu / Yorkshire / Maltês / Persa — cabelo longo cobrindo parte da cabeça
      const shadow = blendWithBlack(c.accent_color, 0.35);
      return (
        <G>
          {/* Sombras sob as mechas — dão volume */}
          <Path d="M 30 36 Q 28 46 32 52" stroke={shadow} strokeWidth="1.4" fill="none" opacity="0.5" />
          <Path d="M 70 36 Q 72 46 68 52" stroke={shadow} strokeWidth="1.4" fill="none" opacity="0.5" />
          {/* Franjas no topo (mechas caindo) */}
          <Path
            d="M 26 26 Q 22 40 30 50 L 36 38 Z"
            fill={c.accent_color}
            opacity="0.92"
          />
          <Path
            d="M 38 24 Q 36 42 44 50 L 48 32 Z"
            fill={c.accent_color}
            opacity="0.85"
          />
          <Path
            d="M 50 24 Q 52 42 56 50 L 58 32 Z"
            fill={c.accent_color}
            opacity="0.85"
          />
          <Path
            d="M 62 24 Q 68 42 70 50 L 64 32 Z"
            fill={c.accent_color}
            opacity="0.92"
          />
          {/* Barba/queixo peludo */}
          <Path
            d="M 32 70 Q 30 84 42 86 L 50 76 L 58 86 Q 70 84 68 70 Z"
            fill={c.accent_color}
            opacity="0.55"
          />
          {/* Sombra na divisão de mechas (centro) */}
          <Path d="M 50 32 L 50 46" stroke={shadow} strokeWidth="0.8" opacity="0.4" />
        </G>
      );
    }
    case 'mane': {
      // Pomerânia / Chow Chow / Maine Coon — juba peluda ao redor da cabeça
      const shadow = blendWithBlack(c.accent_color, 0.35);
      return (
        <G>
          {/* Sombra interna em cada pufe — dá volume */}
          <Circle cx="18" cy="46" r="8" fill={shadow} opacity="0.35" />
          <Circle cx="82" cy="46" r="8" fill={shadow} opacity="0.35" />
          {/* Pufes ao redor da cabeça */}
          <Circle cx="18" cy="44" r="8" fill={c.accent_color} opacity="0.95" />
          <Circle cx="82" cy="44" r="8" fill={c.accent_color} opacity="0.95" />
          <Circle cx="22" cy="64" r="7" fill={c.accent_color} opacity="0.95" />
          <Circle cx="78" cy="64" r="7" fill={c.accent_color} opacity="0.95" />
          <Circle cx="38" cy="80" r="7" fill={c.accent_color} opacity="0.95" />
          <Circle cx="62" cy="80" r="7" fill={c.accent_color} opacity="0.95" />
          <Circle cx="50" cy="84" r="6" fill={c.accent_color} opacity="0.95" />
        </G>
      );
    }
    case 'tricolor': {
      // Beagle real: calota preta/marrom escuro + orelhas marrom claro
      // + focinho/queixo branco. Aqui simulamos sem mexer nas orelhas (renderEars
      // cuida disso), só com calota + zona clara no focinho.
      const dark = c.accent_color;
      // Cor marrom intermediária pra "transição" — vem do fur_color (geralmente branco)
      // ou de um marrom genérico.
      const tan = '#92561F';
      return (
        <G>
          {/* Calota superior escura cobrindo testa e topo da cabeça */}
          <Path
            d={`M ${h.left + 2} ${h.cy - 8} Q ${h.left + 6} ${h.top + 2} ${h.cx} ${h.top + 2} Q ${h.right - 6} ${h.top + 2} ${h.right - 2} ${h.cy - 8} Q ${h.right - 12} ${h.cy - 14} ${h.cx} ${h.cy - 14} Q ${h.left + 12} ${h.cy - 14} ${h.left + 2} ${h.cy - 8} Z`}
            fill={dark}
            opacity="0.95"
          />
          {/* Zona marrom intermediária nas bochechas (entre calota e focinho) */}
          <Path
            d={`M ${h.left + 6} ${h.cy + 2} Q ${h.left + 2} ${h.cy + 14} ${h.cx - 12} ${h.cy + 18} L ${h.cx - 12} ${h.cy + 6} Z`}
            fill={tan}
            opacity="0.75"
          />
          <Path
            d={`M ${h.right - 6} ${h.cy + 2} Q ${h.right - 2} ${h.cy + 14} ${h.cx + 12} ${h.cy + 18} L ${h.cx + 12} ${h.cy + 6} Z`}
            fill={tan}
            opacity="0.75"
          />
          {/* Focinho/queixo branco */}
          <Ellipse cx={h.cx} cy={h.cy + h.ry * 0.55} rx={h.rx * 0.5} ry={h.ry * 0.28} fill="#FFFFFF" opacity="0.85" />
        </G>
      );
    }
    case 'saddle':
      // Pastor Alemão — "manto" preto/escuro sobre a parte superior das costas (aqui no topo)
      return (
        <Path
          d="M 20 50 Q 24 30 50 28 Q 76 30 80 50 Q 70 44 50 44 Q 30 44 20 50 Z"
          fill={c.accent_color}
          opacity="0.95"
        />
      );
  }
}

// ============================================================================
// AGE STAGE — fios brancos pra pet sênior, ajuste de olhos pra filhote
// ============================================================================

function renderSeniorAccents(c: PetAvatarConfig, stage: 'puppy' | 'adult' | 'senior') {
  if (stage !== 'senior') return null;
  // Pássaros e peixes não têm focinho onde mostrar grisalho
  if (c.species === 'bird' || c.species === 'fish') return null;
  const h = getHeadBounds(c.head_shape);
  return (
    <G stroke="#F5F5F4" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.85">
      {/* Mecha grisalha no focinho */}
      <Path d={`M ${h.cx - 8} ${h.cy + 6} Q ${h.cx - 6} ${h.cy + 9} ${h.cx - 4} ${h.cy + 7}`} />
      <Path d={`M ${h.cx + 4} ${h.cy + 7} Q ${h.cx + 6} ${h.cy + 9} ${h.cx + 8} ${h.cy + 6}`} />
      {/* Têmporas grisalhas */}
      <Path d={`M ${h.left + 2} ${h.cy - 6} L ${h.left + 6} ${h.cy - 4}`} opacity="0.7" />
      <Path d={`M ${h.right - 2} ${h.cy - 6} L ${h.right - 6} ${h.cy - 4}`} opacity="0.7" />
    </G>
  );
}

// ============================================================================
// CHEEKS — bochechas roseadas adaptadas ao head_shape
// ============================================================================

function renderCheeks(c: PetAvatarConfig) {
  // Pássaros e peixes não têm bochechas no rosto
  if (c.species === 'bird' || c.species === 'fish') return null;

  const h = getHeadBounds(c.head_shape);
  // Posiciona bochechas a ~55% da largura horizontal, ligeiramente abaixo dos olhos
  const leftX = h.cx - h.rx * 0.55;
  const rightX = h.cx + h.rx * 0.55;
  const y = 58;
  // Blush mais natural: 2 ellipses sobrepostos com fade pra parecer rubor real,
  // não dois pontos rosa. Centro mais saturado, bordas dissolvendo na pelagem.
  return (
    <G>
      {/* Outer soft blush (maior, mais transparente) */}
      <Ellipse cx={leftX} cy={y} rx="6.5" ry="4.5" fill="#FBA9CC" opacity="0.25" />
      <Ellipse cx={rightX} cy={y} rx="6.5" ry="4.5" fill="#FBA9CC" opacity="0.25" />
      {/* Inner core blush (menor, mais opaco) */}
      <Ellipse cx={leftX} cy={y} rx="4" ry="2.8" fill="#F8779C" opacity="0.4" />
      <Ellipse cx={rightX} cy={y} rx="4" ry="2.8" fill="#F8779C" opacity="0.4" />
    </G>
  );
}

// ============================================================================
// EYES
// ============================================================================

function renderEyes(
  c: PetAvatarConfig,
  expression: Props['expression'],
  blinking: 'none' | 'both' | 'left' | 'right' = 'none',
  gaze: 'center' | 'left' | 'right' | 'up' = 'center',
  ageStage: 'puppy' | 'adult' | 'senior' = 'adult',
) {
  const color = c.eye_color;
  // Heterocromia: olho direito com cor diferente quando definida (Husky/Aussie)
  const colorRight = c.eye_color_right ?? color;

  // Filhote tem olhos maiores (kawaii); sênior um pouco menores
  const eyeScale = ageStage === 'puppy' ? 1.15 : ageStage === 'senior' ? 0.95 : 1.0;

  // Offset do pupilo branco ("highlight") baseado em gaze. Só round/oval/sparkle/wide têm.
  const gazeOffset = (() => {
    switch (gaze) {
      case 'left': return { x: -1.5, y: 0 };
      case 'right': return { x: 1.5, y: 0 };
      case 'up': return { x: 0, y: -1.2 };
      default: return { x: 0, y: 0 };
    }
  })();

  // Blink duplo: ambos olhos como linhas curvas
  if (blinking === 'both') {
    return (
      <G stroke={color} strokeWidth="2" strokeLinecap="round" fill="none">
        <Path d="M 33 50 Q 38 53 43 50" />
        <Path d="M 57 50 Q 62 53 67 50" />
      </G>
    );
  }

  // Wink: 1 olho fechado, outro normal. Renderiza com curva no fechado +
  // chama recursivamente pra outro com blinking='none'.
  if (blinking === 'left' || blinking === 'right') {
    const closedSide = blinking;
    return (
      <G>
        {/* Olho fechado (curva) */}
        {closedSide === 'left' ? (
          <Path
            d="M 33 50 Q 38 54 43 50"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <Path
            d="M 57 50 Q 62 54 67 50"
            stroke={colorRight}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        )}
        {/* Olho aberto: round como default */}
        {closedSide === 'left' ? (
          <G>
            <Circle cx="62" cy="50" r="4.5" fill={colorRight} />
            <Circle cx="60.5" cy="48" r="1.5" fill="#fff" />
          </G>
        ) : (
          <G>
            <Circle cx="38" cy="50" r="4.5" fill={color} />
            <Circle cx="36.5" cy="48" r="1.5" fill="#fff" />
          </G>
        )}
      </G>
    );
  }

  // Tratamento especial: love → corações; cry → triste + lágrimas; angry → linhas curvas pra baixo
  if (expression === 'love') {
    return (
      <G fill="#EF4444">
        <Path d="M 38 50 m -4 0 a 2.5 2.5 0 0 1 4 -1.5 a 2.5 2.5 0 0 1 4 1.5 q 0 3 -4 5 q -4 -2 -4 -5 z" />
        <Path d="M 62 50 m -4 0 a 2.5 2.5 0 0 1 4 -1.5 a 2.5 2.5 0 0 1 4 1.5 q 0 3 -4 5 q -4 -2 -4 -5 z" />
      </G>
    );
  }

  if (expression === 'cry') {
    return (
      <G>
        <G stroke={color} strokeWidth="2" strokeLinecap="round" fill="none">
          <Path d="M 33 52 Q 38 47 43 52" />
          <Path d="M 57 52 Q 62 47 67 52" />
        </G>
        {/* Lágrimas azuis */}
        <Path d="M 36 55 Q 35 60 38 62 Q 41 60 40 55 Z" fill="#3B82F6" opacity="0.85" />
        <Path d="M 60 55 Q 59 60 62 62 Q 65 60 64 55 Z" fill="#3B82F6" opacity="0.85" />
      </G>
    );
  }

  if (expression === 'angry') {
    return (
      <G>
        {/* Sobrancelhas inclinadas pra dentro */}
        <Path d="M 32 42 L 44 46" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
        <Path d="M 68 42 L 56 46" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
        {/* Olhos pequenos */}
        <Circle cx="38" cy="51" r="3.5" fill={color} />
        <Circle cx="62" cy="51" r="3.5" fill={color} />
        <Circle cx="37" cy="50" r="1" fill="#fff" />
        <Circle cx="61" cy="50" r="1" fill="#fff" />
      </G>
    );
  }

  if (expression === 'sleep') {
    return (
      <G stroke={color} strokeWidth="2" strokeLinecap="round" fill="none">
        <Path d="M 33 50 Q 38 53 43 50" />
        <Path d="M 57 50 Q 62 53 67 50" />
        {/* ZZZ sutil — passamos no renderMouth para não duplicar */}
      </G>
    );
  }

  const eyeStyle = expression === 'happy' ? 'happy'
    : expression === 'sad' ? 'sleepy'
    : expression === 'surprised' ? 'wide'
    : c.eyes;

  switch (eyeStyle) {
    case 'round':
      return (
        <G>
          {/* Iris (cor base) */}
          <Circle cx="38" cy="50" r={4.5 * eyeScale} fill={color} />
          <Circle cx="62" cy="50" r={4.5 * eyeScale} fill={colorRight} />
          {/* Soft 3D shine — gradient overlay com fade do canto superior-esquerdo */}
          <Circle cx="38" cy="50" r={4.5 * eyeScale} fill="url(#eyeShine)" />
          <Circle cx="62" cy="50" r={4.5 * eyeScale} fill="url(#eyeShine)" />
          {/* Sharp pinpoint highlight (catchlight) */}
          <Circle cx={36.5 + gazeOffset.x} cy={48 + gazeOffset.y} r={1.5 * eyeScale} fill="#fff" />
          <Circle cx={60.5 + gazeOffset.x} cy={48 + gazeOffset.y} r={1.5 * eyeScale} fill="#fff" />
          {/* Secondary tiny shine pra dar profundidade */}
          <Circle cx={39.5 + gazeOffset.x} cy={51.5 + gazeOffset.y} r={0.6 * eyeScale} fill="#fff" opacity="0.8" />
          <Circle cx={63.5 + gazeOffset.x} cy={51.5 + gazeOffset.y} r={0.6 * eyeScale} fill="#fff" opacity="0.8" />
        </G>
      );
    case 'oval':
      return (
        <G>
          {/* Iris (cor base) */}
          <Ellipse cx="38" cy="50" rx={3 * eyeScale} ry={5 * eyeScale} fill={color} />
          <Ellipse cx="62" cy="50" rx={3 * eyeScale} ry={5 * eyeScale} fill={colorRight} />
          {/* Soft 3D shine */}
          <Ellipse cx="38" cy="50" rx={3 * eyeScale} ry={5 * eyeScale} fill="url(#eyeShine)" />
          <Ellipse cx="62" cy="50" rx={3 * eyeScale} ry={5 * eyeScale} fill="url(#eyeShine)" />
          {/* Sharp catchlight */}
          <Circle cx={37 + gazeOffset.x} cy={48 + gazeOffset.y} r={1 * eyeScale} fill="#fff" />
          <Circle cx={61 + gazeOffset.x} cy={48 + gazeOffset.y} r={1 * eyeScale} fill="#fff" />
          {/* Mini secondary shine */}
          <Circle cx={39 + gazeOffset.x} cy={52 + gazeOffset.y} r={0.5 * eyeScale} fill="#fff" opacity="0.8" />
          <Circle cx={63 + gazeOffset.x} cy={52 + gazeOffset.y} r={0.5 * eyeScale} fill="#fff" opacity="0.8" />
        </G>
      );
    case 'sleepy':
      // Olhos sonolentos com cílios sutis embaixo
      return (
        <G>
          <G stroke={color} strokeWidth="2" strokeLinecap="round" fill="none">
            <Path d="M 33 50 Q 38 53 43 50" />
            <Path d="M 57 50 Q 62 53 67 50" />
          </G>
          {/* Cílios curtos embaixo das pálpebras */}
          <G stroke={color} strokeWidth="0.6" strokeOpacity="0.6" strokeLinecap="round">
            <Path d="M 35 52 L 35 54" />
            <Path d="M 38 53 L 38 55" />
            <Path d="M 41 52 L 41 54" />
            <Path d="M 59 52 L 59 54" />
            <Path d="M 62 53 L 62 55" />
            <Path d="M 65 52 L 65 54" />
          </G>
        </G>
      );
    case 'happy':
      // ^_^ olhos curvados com cílios sutis
      return (
        <G>
          <G stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none">
            <Path d="M 33 52 Q 38 46 43 52" />
            <Path d="M 57 52 Q 62 46 67 52" />
          </G>
          {/* Cílio pequeno no canto externo de cada olho */}
          <Path d="M 32 51 L 30 49" stroke={color} strokeWidth="0.7" strokeOpacity="0.7" strokeLinecap="round" />
          <Path d="M 68 51 L 70 49" stroke={color} strokeWidth="0.7" strokeOpacity="0.7" strokeLinecap="round" />
        </G>
      );
    case 'wink':
      return (
        <G>
          {/* Olho aberto com shine 3D completo */}
          <Circle cx="38" cy="50" r={4.5 * eyeScale} fill={color} />
          <Circle cx="38" cy="50" r={4.5 * eyeScale} fill="url(#eyeShine)" />
          <Circle cx="36.5" cy="48" r={1.5 * eyeScale} fill="#fff" />
          <Circle cx="39.5" cy="51.5" r={0.6 * eyeScale} fill="#fff" opacity="0.8" />
          {/* Olho fechado piscando */}
          <Path
            d="M 57 52 Q 62 46 67 52"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <Path d="M 68 51 L 70 49" stroke={color} strokeWidth="0.7" strokeOpacity="0.7" strokeLinecap="round" />
        </G>
      );
    case 'sparkle':
      // Olhos com estrelinhas — feature super kawaii
      return (
        <G>
          {/* Iris (cor de base) */}
          <Circle cx="38" cy="50" r="5" fill={color} />
          <Circle cx="62" cy="50" r="5" fill={colorRight} />
          {/* Shine gradient pra dar profundidade */}
          <Circle cx="38" cy="50" r="5" fill="url(#eyeShine)" />
          <Circle cx="62" cy="50" r="5" fill="url(#eyeShine)" />
          {/* Estrela principal (forma de losango/star simplificada) */}
          <Path d={`M ${36.5 + gazeOffset.x} ${46 + gazeOffset.y} L ${38 + gazeOffset.x} ${49 + gazeOffset.y} L ${36.5 + gazeOffset.x} ${50 + gazeOffset.y} L ${35 + gazeOffset.x} ${49 + gazeOffset.y} Z`} fill="#fff" />
          <Path d={`M ${60.5 + gazeOffset.x} ${46 + gazeOffset.y} L ${62 + gazeOffset.x} ${49 + gazeOffset.y} L ${60.5 + gazeOffset.x} ${50 + gazeOffset.y} L ${59 + gazeOffset.x} ${49 + gazeOffset.y} Z`} fill="#fff" />
          {/* Catchlight redondo */}
          <Circle cx={36.5 + gazeOffset.x} cy={48 + gazeOffset.y} r="1.6" fill="#fff" />
          <Circle cx={60.5 + gazeOffset.x} cy={48 + gazeOffset.y} r="1.6" fill="#fff" />
          {/* Mini brilho secundário (estrelinha pequena) */}
          <Circle cx={40 + gazeOffset.x} cy={51.5 + gazeOffset.y} r="0.8" fill="#fff" />
          <Circle cx={64 + gazeOffset.x} cy={51.5 + gazeOffset.y} r="0.8" fill="#fff" />
        </G>
      );
    case 'heart':
      return (
        <G fill="#EF4444">
          <Path d="M 38 50 m -4 0 a 2.5 2.5 0 0 1 4 -1.5 a 2.5 2.5 0 0 1 4 1.5 q 0 3 -4 5 q -4 -2 -4 -5 z" />
          <Path d="M 62 50 m -4 0 a 2.5 2.5 0 0 1 4 -1.5 a 2.5 2.5 0 0 1 4 1.5 q 0 3 -4 5 q -4 -2 -4 -5 z" />
        </G>
      );
    case 'wide':
      // Surpreso — olhos grandes com branco
      return (
        <G>
          <Circle cx="38" cy="50" r="6" fill="#fff" stroke={color} strokeWidth="1" />
          <Circle cx="62" cy="50" r="6" fill="#fff" stroke={colorRight} strokeWidth="1" />
          <Circle cx={38 + gazeOffset.x * 0.7} cy={50 + gazeOffset.y * 0.7} r="3" fill={color} />
          <Circle cx={62 + gazeOffset.x * 0.7} cy={50 + gazeOffset.y * 0.7} r="3" fill={colorRight} />
          <Circle cx={37 + gazeOffset.x * 0.7} cy={49 + gazeOffset.y * 0.7} r="1" fill="#fff" />
          <Circle cx={61 + gazeOffset.x * 0.7} cy={49 + gazeOffset.y * 0.7} r="1" fill="#fff" />
        </G>
      );
  }
}

// ============================================================================
// NOSE
// ============================================================================

function renderNose(c: PetAvatarConfig) {
  // Pássaros e peixes não têm "nose" tradicional — extras lidam com isso
  if (c.species === 'bird' || c.species === 'fish') return null;

  // Snout/focinho — fundo cor de pele levemente mais clara que a pelagem,
  // dando volume ao redor do nariz (como um bigode/bochecha em pets reais)
  const snoutFill = c.accent_color || '#FFFFFF';

  return (
    <G>
      {/* Snout area — área levemente saliente em volta do nariz pra dar volume ao focinho */}
      <Path
        d="M 41 60 Q 41 67 50 70 Q 59 67 59 60 Q 56 56 50 56 Q 44 56 41 60 Z"
        fill={snoutFill}
        opacity="0.45"
      />
      {/* Nariz em si — formato de coração invertido (igual focinho real) */}
      <Path
        d="M 50 58.5
           C 46 58.5, 44.5 60.5, 45 62.5
           C 45.3 63.7, 46.5 64.8, 50 65.5
           C 53.5 64.8, 54.7 63.7, 55 62.5
           C 55.5 60.5, 54 58.5, 50 58.5 Z"
        fill={c.nose_color}
      />
      {/* Linha vertical de divisão do focinho (philtrum) — vai do nariz até a boca */}
      <Path
        d="M 50 65.5 L 50 67.5"
        stroke="#1A1410"
        strokeWidth="0.7"
        strokeOpacity="0.45"
        strokeLinecap="round"
      />
      {/* Highlight 3D — pequena reflexão de luz no topo-esquerdo */}
      <Ellipse cx="48.5" cy="60.5" rx="1.5" ry="1" fill="url(#noseShine)" />
      {/* Mini shine secundário */}
      <Circle cx="47.5" cy="60" r="0.5" fill="#FFFFFF" opacity="0.6" />
    </G>
  );
}

// ============================================================================
// 3D SHADE OVERLAY — aplicado por cima de head/ears/pattern pra dar volume
// ============================================================================

/**
 * Ambient occlusion na base das orelhas — sombra suave onde a orelha encontra
 * a cabeça. Funde os dois elementos pra parecer UMA forma em vez de peça colada.
 */
function renderEarBaseAO(c: PetAvatarConfig) {
  // Só aparece pra orelhas que se conectam visivelmente à cabeça
  const visibleEars = ['droopy', 'long_droopy', 'fluffy_down', 'tiny', 'bat'];
  if (!visibleEars.includes(c.ears)) return null;

  return (
    <G opacity="0.7">
      {/* Sombra suave esquerda — onde orelha encontra cabeça */}
      <Ellipse cx="28" cy="40" rx="8" ry="3" fill="url(#earBaseAO)" />
      {/* Sombra suave direita */}
      <Ellipse cx="72" cy="40" rx="8" ry="3" fill="url(#earBaseAO)" />
    </G>
  );
}

/**
 * Fur texture overlay — variações sutis de luz/sombra simulando pelagem orgânica.
 * Não tenta desenhar pelos individuais (caro em SVG), mas dá impressão de textura
 * via pontos espalhados de cor/luz com low opacity.
 */
function renderFurTexture(c: PetAvatarConfig) {
  // Apenas pra cabeças com pelagem (não pra pássaros/peixes)
  if (c.species === 'bird' || c.species === 'fish') return null;

  // Cor escurecida pra "pontas" de pelos (sombras de fios individuais)
  const furShade = blendWithBlack(c.fur_color, 0.25);

  // Posicionar usando bounds da cabeça pra não sair fora da silhueta
  const h = getHeadBounds(c.head_shape);

  return (
    <G opacity="0.5">
      {/* Pequenos toques de luz/sombra simulando irregularidades de pelagem */}
      {/* Cluster esquerdo (testa) */}
      <Circle cx={h.cx - 12} cy={h.cy - 12} r="1.2" fill="#FFFFFF" opacity="0.15" />
      <Circle cx={h.cx - 9} cy={h.cy - 8} r="0.8" fill={furShade} opacity="0.4" />
      <Circle cx={h.cx - 14} cy={h.cy - 5} r="1" fill="#FFFFFF" opacity="0.1" />
      {/* Cluster direito (testa) */}
      <Circle cx={h.cx + 12} cy={h.cy - 12} r="1.2" fill="#FFFFFF" opacity="0.15" />
      <Circle cx={h.cx + 9} cy={h.cy - 8} r="0.8" fill={furShade} opacity="0.4" />
      <Circle cx={h.cx + 14} cy={h.cy - 5} r="1" fill="#FFFFFF" opacity="0.1" />
      {/* Top central */}
      <Circle cx={h.cx} cy={h.cy - 18} r="1" fill="#FFFFFF" opacity="0.15" />
      <Circle cx={h.cx - 3} cy={h.cy - 16} r="0.7" fill={furShade} opacity="0.3" />
      <Circle cx={h.cx + 3} cy={h.cy - 16} r="0.7" fill={furShade} opacity="0.3" />
    </G>
  );
}

/**
 * Cheek puffs — adiciona volume sutil às bochechas pra parecerem inchadas/fofas.
 * Renderiza por cima das bochechas (blush) sem dimar elas — só dá relevo.
 */
function renderCheekPuffs(c: PetAvatarConfig) {
  if (c.species === 'bird' || c.species === 'fish') return null;

  const h = getHeadBounds(c.head_shape);
  const leftX = h.cx - h.rx * 0.55;
  const rightX = h.cx + h.rx * 0.55;
  const y = 58;

  return (
    <G>
      {/* Puff overlay: highlight + sombra sutil pra dar relevo de bochecha cheia */}
      <Ellipse cx={leftX} cy={y} rx="7" ry="5" fill="url(#cheekPuff)" />
      <Ellipse cx={rightX} cy={y} rx="7" ry="5" fill="url(#cheekPuff)" />
    </G>
  );
}

/**
 * Rim light: luz secundária atmosférica vindo do lado oposto da luz principal.
 * Cria efeito 3D realista de iluminação cinematic.
 */
function renderRimLight(c: PetAvatarConfig) {
  const shape = c.head_shape;
  // Path simplificado da silhueta da cabeça pra aplicar o rim light gradient
  switch (shape) {
    case 'round':
      return <Ellipse cx="50" cy="55" rx="30" ry="30" fill="url(#rimLight)" />;
    case 'oval':
      return <Ellipse cx="50" cy="55" rx="27" ry="33" fill="url(#rimLight)" />;
    case 'wide':
      return <Ellipse cx="50" cy="56" rx="34" ry="27" fill="url(#rimLight)" />;
    case 'long':
      return <Ellipse cx="50" cy="58" rx="23" ry="35" fill="url(#rimLight)" />;
    case 'square':
      return <Ellipse cx="50" cy="55" rx="32" ry="30" fill="url(#rimLight)" />;
    case 'egg':
      return <Ellipse cx="50" cy="55" rx="26" ry="32" fill="url(#rimLight)" />;
  }
}

/**
 * Renderiza um overlay com gradiente radial que simula sombreamento 3D de esfera.
 * Combina com o formato da cabeça pra acompanhar o contorno do avatar.
 * Resultado: cabeça parece esférica/volumétrica em vez de flat 2D.
 */
function render3DShadeOverlay(c: PetAvatarConfig) {
  // Reusa os mesmos paths do renderHead pra que o gradiente cubra exatamente a silhueta
  const shape = c.head_shape;
  switch (shape) {
    case 'round':
      return (
        <Path
          d="M 50 22 C 35 22, 22 32, 20 48 C 19 56, 21 64, 26 70 C 30 76, 36 80, 42 82 C 45 83, 50 83, 50 83 C 50 83, 55 83, 58 82 C 64 80, 70 76, 74 70 C 79 64, 81 56, 80 48 C 78 32, 65 22, 50 22 Z"
          fill="url(#shade3D)"
        />
      );
    case 'oval':
      return (
        <Path
          d="M 50 20 C 36 20, 24 30, 23 46 C 22 56, 24 64, 28 71 C 32 78, 38 83, 44 85 C 47 86, 50 86, 50 86 C 50 86, 53 86, 56 85 C 62 83, 68 78, 72 71 C 76 64, 78 56, 77 46 C 76 30, 64 20, 50 20 Z"
          fill="url(#shade3D)"
        />
      );
    case 'wide':
      return (
        <Path
          d="M 50 26 C 32 26, 18 36, 16 50 C 15 58, 18 66, 24 72 C 30 78, 38 82, 46 83 C 48 83, 50 83, 50 83 C 50 83, 52 83, 54 83 C 62 82, 70 78, 76 72 C 82 66, 85 58, 84 50 C 82 36, 68 26, 50 26 Z"
          fill="url(#shade3D)"
        />
      );
    case 'long':
      return (
        <Path
          d="M 50 18 C 38 18, 28 28, 27 42 C 26 52, 27 62, 30 70 C 33 78, 38 84, 44 87 C 46 88, 50 88, 50 88 C 50 88, 54 88, 56 87 C 62 84, 67 78, 70 70 C 73 62, 74 52, 73 42 C 72 28, 62 18, 50 18 Z"
          fill="url(#shade3D)"
        />
      );
    case 'square':
      return (
        <Path
          d="M 30 26 C 22 26, 17 32, 17 42 L 17 64 C 17 72, 20 78, 26 82 C 32 86, 40 87, 50 87 C 60 87, 68 86, 74 82 C 80 78, 83 72, 83 64 L 83 42 C 83 32, 78 26, 70 26 C 64 25, 58 24, 50 24 C 42 24, 36 25, 30 26 Z"
          fill="url(#shade3D)"
        />
      );
    case 'egg':
      return (
        <Path
          d="M 50 21 C 40 21, 31 26, 27 36 C 24 44, 23 54, 25 64 C 27 74, 33 81, 42 85 C 45 86, 50 86, 50 86 C 50 86, 55 86, 58 85 C 67 81, 73 74, 75 64 C 77 54, 76 44, 73 36 C 69 26, 60 21, 50 21 Z"
          fill="url(#shade3D)"
        />
      );
  }
}

// ============================================================================
// MOUTH
// ============================================================================

function renderMouth(c: PetAvatarConfig, expression: Props['expression']) {
  // Pássaros e peixes têm boca renderizada nos extras
  if (c.species === 'bird' || c.species === 'fish') return null;

  // Expressões especiais com boca custom
  if (expression === 'love') {
    return (
      <G>
        <Path d="M 44 68 Q 50 74 56 68" stroke="#1A1410" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        {/* Línguinha rosinha */}
        <Ellipse cx="50" cy="71" rx="3" ry="1.6" fill="#FBA9CC" />
      </G>
    );
  }
  if (expression === 'cry') {
    return (
      <Path
        d="M 44 71 Q 50 65 56 71"
        stroke="#1A1410"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  if (expression === 'angry') {
    return (
      <G>
        <Path
          d="M 42 70 L 58 70"
          stroke="#1A1410"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        {/* Pequena dente saliente */}
        <Path
          d="M 47 70 L 48 73 L 49 70 Z"
          fill="#FFFFFF"
          stroke="#1A1410"
          strokeWidth="0.5"
        />
      </G>
    );
  }
  if (expression === 'sleep') {
    return (
      <G>
        <Path
          d="M 46 68 Q 50 70 54 68"
          stroke="#1A1410"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
        {/* ZZZ acima da cabeça */}
        <Path
          d="M 74 22 L 80 22 L 74 28 L 80 28"
          stroke="#3B82F6"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 82 16 L 87 16 L 82 21 L 87 21"
          stroke="#3B82F6"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
      </G>
    );
  }

  const mouthStyle = expression === 'happy' ? 'tongue_open'
    : expression === 'sad' ? 'tiny'
    : expression === 'surprised' ? 'open'
    : c.mouth;

  switch (mouthStyle) {
    case 'smile':
      // Sorriso curvado com lábio inferior sutil pra dar volume
      return (
        <G>
          <Path
            d="M 43 69 Q 50 74 57 69"
            stroke="#1A1410"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          {/* Lábio inferior — fina linha mais clara abaixo da boca */}
          <Path
            d="M 45 71.5 Q 50 73 55 71.5"
            stroke="#1A1410"
            strokeWidth="0.6"
            strokeOpacity="0.25"
            strokeLinecap="round"
            fill="none"
          />
        </G>
      );
    case 'neutral':
      return (
        <Path
          d="M 45 70 Q 50 71 55 70"
          stroke="#1A1410"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'tongue_side':
      // Língua de cachorro feliz pra fora do lado
      return (
        <G>
          <Path
            d="M 43 69 Q 48 73 53 71"
            stroke="#1A1410"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          {/* Língua com volume — rosa com gradiente sutil */}
          <Path
            d="M 53 70 Q 58 70 59 73 Q 58 76 54 76 Q 51 75 51 72 Z"
            fill="#FBA9CC"
          />
          {/* Linha central da língua */}
          <Path
            d="M 54 72 L 56 75"
            stroke="#1A1410"
            strokeWidth="0.4"
            strokeOpacity="0.3"
            strokeLinecap="round"
          />
        </G>
      );
    case 'tongue_open':
      // Boca aberta com língua aparecendo (corre-corre feliz)
      return (
        <G>
          {/* Cavidade da boca (escuro) */}
          <Path
            d="M 44 69 Q 50 75 56 69 Q 56 73 50 75 Q 44 73 44 69 Z"
            fill="#1A1410"
          />
          {/* Língua rosa */}
          <Path
            d="M 46 72 Q 50 76 54 72 Q 54 74 50 75 Q 46 74 46 72 Z"
            fill="#FBA9CC"
          />
          {/* Highlight na língua */}
          <Ellipse cx="49" cy="72.5" rx="1.5" ry="0.5" fill="#FFFFFF" opacity="0.4" />
        </G>
      );
    case 'open':
      // Boca aberta neutra
      return (
        <G>
          <Ellipse cx="50" cy="71" rx="4" ry="2.8" fill="#1A1410" />
          {/* Highlight pra dar concavidade */}
          <Ellipse cx="50" cy="72" rx="3" ry="1.6" fill="#5C3317" opacity="0.7" />
        </G>
      );
    case 'tiny':
      // Sorriso pequeno (gato, coelho)
      return (
        <G>
          <Path
            d="M 47 68 Q 50 70 53 68"
            stroke="#1A1410"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </G>
      );
    case 'kiss':
      return (
        <G>
          <Circle cx="50" cy="69" r="2.5" fill="#FBA9CC" />
          <Circle cx="50" cy="69" r="1.5" fill="#EF4444" />
          {/* Highlight no biquinho */}
          <Circle cx="49.3" cy="68.5" r="0.6" fill="#FFFFFF" opacity="0.7" />
        </G>
      );
  }
}

// ============================================================================
// COLLAR
// ============================================================================

function renderCollar(c: PetAvatarConfig) {
  if (c.collar === 'none') return null;
  // Posicionamento: faixa fina no "pescoço" entre cabeça e peito (y=83-86)
  if (c.collar === 'rainbow') {
    return (
      <G>
        <Rect x="28" y="83" width="44" height="1" fill="#EF4444" />
        <Rect x="28" y="84" width="44" height="1" fill="#F97316" />
        <Rect x="28" y="85" width="44" height="1" fill="#FBBF24" />
        <Rect x="28" y="86" width="44" height="1" fill="#10B981" />
        <Rect x="28" y="87" width="44" height="1" fill="#3B82F6" />
        {/* Highlight brilhante atravessando */}
        <Rect x="28" y="83" width="44" height="0.8" fill="#FFFFFF" opacity="0.5" />
        {/* Plaquinha dourada com brilho */}
        <Circle cx="50" cy="86" r="3" fill="#FBBF24" stroke="#92400E" strokeWidth="0.5" />
        <Circle cx="49.2" cy="85.3" r="1" fill="#FFFFFF" opacity="0.6" />
      </G>
    );
  }
  const color = COLLAR_HEX[c.collar];
  // Cor mais escura pra sombra da coleira (parte inferior)
  const collarShade = blendWithBlack(color, 0.25);
  return (
    <G>
      {/* Sombra inferior da coleira */}
      <Rect x="28" y="86" width="44" height="2" rx="1" fill={collarShade} opacity="0.6" />
      {/* Corpo principal da coleira */}
      <Rect x="28" y="83" width="44" height="5" rx="2" fill={color} />
      {/* Highlight brilhante no topo (efeito metálico/couro lustroso) */}
      <Rect x="28" y="83.5" width="44" height="1.2" rx="0.6" fill="#FFFFFF" opacity="0.35" />
      {/* Costura sutil pra dar textura de couro */}
      <Path d="M 30 87 L 70 87" stroke={collarShade} strokeWidth="0.3" strokeOpacity="0.5" strokeDasharray="1,1" />
      {/* Plaquinha dourada com brilho realista */}
      <Circle cx="50" cy="86" r="3" fill="#FBBF24" stroke="#92400E" strokeWidth="0.5" />
      {/* Highlight na plaquinha */}
      <Circle cx="49.2" cy="85.3" r="1" fill="#FFFFFF" opacity="0.7" />
      {/* Mini reflexo secundário */}
      <Circle cx="51" cy="86.5" r="0.4" fill="#FFFFFF" opacity="0.5" />
    </G>
  );
}

// ============================================================================
// COLLAR CHARM (pingente pendurado — Pro only)
// ============================================================================

function renderCollarCharm(c: PetAvatarConfig) {
  // Não renderiza se sem coleira ou sem charm
  if (c.collar === 'none' || !c.collar_charm || c.collar_charm === 'none') return null;

  // Cordão fino conectando coleira ao charm
  const stringPath = <Path d="M 50 88 L 50 91" stroke="#1A1410" strokeWidth="0.6" opacity="0.7" />;

  switch (c.collar_charm) {
    case 'bell':
      // Sininho dourado
      return (
        <G>
          {stringPath}
          <Path d="M 47 91 Q 47 96 50 97 Q 53 96 53 91 Z" fill="#FBBF24" stroke="#92400E" strokeWidth="0.5" />
          <Circle cx="50" cy="97.5" r="0.8" fill="#92400E" />
          <Path d="M 48 92 L 49 91" stroke="#FFFFFF" strokeWidth="0.4" opacity="0.8" />
        </G>
      );
    case 'tag':
      // Plaquinha em formato de osso
      return (
        <G>
          {stringPath}
          <Path
            d="M 46 91 Q 45 91 45 92.5 Q 45 94 46 94 L 54 94 Q 55 94 55 92.5 Q 55 91 54 91 Z"
            fill="#E5E5E5"
            stroke="#1A1410"
            strokeWidth="0.5"
          />
          <Circle cx="45" cy="91" r="1.2" fill="#E5E5E5" stroke="#1A1410" strokeWidth="0.4" />
          <Circle cx="45" cy="94" r="1.2" fill="#E5E5E5" stroke="#1A1410" strokeWidth="0.4" />
          <Circle cx="55" cy="91" r="1.2" fill="#E5E5E5" stroke="#1A1410" strokeWidth="0.4" />
          <Circle cx="55" cy="94" r="1.2" fill="#E5E5E5" stroke="#1A1410" strokeWidth="0.4" />
        </G>
      );
    case 'heart':
      return (
        <G>
          {stringPath}
          <Path
            d="M 50 96 m -3 -2.5 a 1.8 1.8 0 0 1 3 -1 a 1.8 1.8 0 0 1 3 1 q 0 2 -3 3.5 q -3 -1.5 -3 -3.5 z"
            fill="#EF4444"
            stroke="#7F1D1D"
            strokeWidth="0.3"
          />
        </G>
      );
    case 'bone':
      // Ossinho branco
      return (
        <G>
          {stringPath}
          <Path
            d="M 46 92 Q 44.5 92 44.5 93 Q 44.5 94 46 94 L 54 94 Q 55.5 94 55.5 93 Q 55.5 92 54 92 Z"
            fill="#FFFFFF"
            stroke="#1A1410"
            strokeWidth="0.4"
          />
          <Circle cx="45" cy="92" r="1.1" fill="#FFFFFF" stroke="#1A1410" strokeWidth="0.4" />
          <Circle cx="45" cy="94" r="1.1" fill="#FFFFFF" stroke="#1A1410" strokeWidth="0.4" />
          <Circle cx="55" cy="92" r="1.1" fill="#FFFFFF" stroke="#1A1410" strokeWidth="0.4" />
          <Circle cx="55" cy="94" r="1.1" fill="#FFFFFF" stroke="#1A1410" strokeWidth="0.4" />
        </G>
      );
    case 'star':
      return (
        <G>
          {stringPath}
          <Path
            d="M 50 91 L 51 93.5 L 53.8 93.7 L 51.6 95.4 L 52.4 98 L 50 96.6 L 47.6 98 L 48.4 95.4 L 46.2 93.7 L 49 93.5 Z"
            fill="#FBBF24"
            stroke="#92400E"
            strokeWidth="0.3"
          />
        </G>
      );
    case 'diamond':
      return (
        <G>
          {stringPath}
          <Path
            d="M 50 91 L 53 94 L 50 97 L 47 94 Z"
            fill="#7DD3FC"
            stroke="#0369A1"
            strokeWidth="0.4"
          />
          <Path d="M 48.5 93 L 49.5 92 L 50.5 93" stroke="#FFFFFF" strokeWidth="0.5" fill="none" />
        </G>
      );
    case 'paw':
      // Patinha rosa
      return (
        <G>
          {stringPath}
          <Circle cx="50" cy="95" r="1.8" fill="#FBA9CC" />
          <Circle cx="47.5" cy="92.5" r="0.9" fill="#FBA9CC" />
          <Circle cx="52.5" cy="92.5" r="0.9" fill="#FBA9CC" />
          <Circle cx="46" cy="94.5" r="0.7" fill="#FBA9CC" />
          <Circle cx="54" cy="94.5" r="0.7" fill="#FBA9CC" />
        </G>
      );
    default:
      return null;
  }
}

// ============================================================================
// ACCESSORIES
// ============================================================================

function renderAccessory(c: PetAvatarConfig) {
  const h = getHeadBounds(c.head_shape);
  // Delta vertical pra acomodar acessórios "no topo" a head_shapes diferentes
  // (Base = cabeça round, top=23). Cabeça wide top=28 → dy=+5. Long top=22 → dy=-1.
  const dy = h.top - 23;
  const transform = dy !== 0 ? `translate(0 ${dy})` : undefined;

  switch (c.accessory) {
    case 'none':
      return null;
    case 'bow':
      return (
        <G transform={transform}>
          <Path d="M 38 26 L 50 32 L 38 38 Z" fill="#EC4899" />
          <Path d="M 62 26 L 50 32 L 62 38 Z" fill="#EC4899" />
          <Circle cx="50" cy="32" r="2.5" fill="#BE185D" />
        </G>
      );
    case 'top_hat':
      return (
        <G transform={transform}>
          <Rect x="35" y="14" width="30" height="3" fill="#1A1410" />
          <Rect x="40" y="6" width="20" height="10" fill="#1A1410" />
          <Rect x="40" y="11" width="20" height="2" fill="#EF4444" />
        </G>
      );
    case 'cap':
      return (
        <G transform={transform}>
          <Path
            d="M 32 22 Q 50 10 68 22 L 68 28 L 32 28 Z"
            fill="#3B82F6"
          />
          <Path d="M 32 28 L 32 30 L 75 30 L 75 26 Z" fill="#1E40AF" />
        </G>
      );
    case 'glasses':
      // Óculos ficam nos OLHOS (y=50 sempre), não no topo. Sem transform.
      return (
        <G stroke="#1A1410" strokeWidth="1.5" fill="none">
          <Circle cx="38" cy="50" r="7" />
          <Circle cx="62" cy="50" r="7" />
          <Path d="M 45 50 L 55 50" />
        </G>
      );
    case 'sunglasses':
      // Idem — fica nos olhos
      return (
        <G>
          <Path d="M 30 48 L 46 48 L 46 54 L 30 54 Z" fill="#1A1410" />
          <Path d="M 54 48 L 70 48 L 70 54 L 54 54 Z" fill="#1A1410" />
          <Path d="M 46 50 L 54 50" stroke="#1A1410" strokeWidth="1.5" />
        </G>
      );
    case 'bandana':
      return (
        <G transform={transform}>
          <Path d="M 22 28 L 78 28 L 70 36 L 30 36 Z" fill="#EF4444" />
        </G>
      );
    case 'crown':
      return (
        <G transform={transform}>
          <Path
            d="M 32 24 L 38 14 L 44 22 L 50 12 L 56 22 L 62 14 L 68 24 L 32 24 Z"
            fill="#FBBF24"
            stroke="#92400E"
            strokeWidth="0.5"
          />
          <Circle cx="50" cy="18" r="1.5" fill="#EF4444" />
        </G>
      );
    case 'flower':
      return (
        <G transform={transform}>
          <Circle cx="34" cy="28" r="3" fill="#EC4899" />
          <Circle cx="30" cy="30" r="3" fill="#EC4899" />
          <Circle cx="34" cy="32" r="3" fill="#EC4899" />
          <Circle cx="38" cy="30" r="3" fill="#EC4899" />
          <Circle cx="34" cy="30" r="2" fill="#FBBF24" />
        </G>
      );
  }
}

// ============================================================================
// SPECIES EXTRAS (bico, barbatana, etc)
// ============================================================================

function renderSpeciesExtras(c: PetAvatarConfig) {
  switch (c.species) {
    case 'bird':
      // Bico em V com gradiente sutil
      return (
        <G>
          <Path
            d="M 47 62 L 50 70 L 53 62 Z"
            fill={c.nose_color}
            stroke="#92400E"
            strokeOpacity="0.3"
            strokeWidth="0.4"
          />
          {/* Highlight no bico */}
          <Path d="M 48 63 L 49.5 67 L 50 63 Z" fill="#FFFFFF" opacity="0.35" />
        </G>
      );
    case 'fish':
      // Bocazinha tipo "O" + barbatanas pequenas com volume
      return (
        <G>
          {/* Boca */}
          <Circle cx="50" cy="68" r="3" fill="#fff" stroke="#1A1410" strokeWidth="0.5" />
          <Circle cx="49.5" cy="67.5" r="1.2" fill="#FFFFFF" opacity="0.7" />
          {/* Barbatana lateral esquerda com gradient sutil */}
          <Path d="M 18 56 Q 22 68 18 80 Q 28 70 28 60 Z" fill={c.fur_color} opacity="0.85" />
          <Path d="M 21 60 Q 23 68 22 76" stroke={c.accent_color} strokeWidth="0.6" strokeOpacity="0.6" fill="none" />
          {/* Barbatana lateral direita */}
          <Path d="M 82 56 Q 78 68 82 80 Q 72 70 72 60 Z" fill={c.fur_color} opacity="0.85" />
          <Path d="M 79 60 Q 77 68 78 76" stroke={c.accent_color} strokeWidth="0.6" strokeOpacity="0.6" fill="none" />
        </G>
      );
    case 'cat':
      // Bigodes — 3 de cada lado, finos e levemente curvados
      return (
        <G stroke="#1A1410" strokeWidth="0.5" strokeOpacity="0.55" strokeLinecap="round" fill="none">
          {/* Lado esquerdo */}
          <Path d="M 42 63 Q 32 62 24 60" />
          <Path d="M 42 65 Q 32 65 22 65" />
          <Path d="M 42 67 Q 32 68 24 71" />
          {/* Lado direito */}
          <Path d="M 58 63 Q 68 62 76 60" />
          <Path d="M 58 65 Q 68 65 78 65" />
          <Path d="M 58 67 Q 68 68 76 71" />
        </G>
      );
    case 'rabbit':
      // Bigodes finos + dentinhos da frente
      return (
        <G>
          {/* Bigodes mais sutis que de gato */}
          <G stroke="#1A1410" strokeWidth="0.4" strokeOpacity="0.4" strokeLinecap="round" fill="none">
            <Path d="M 42 64 Q 34 64 26 62" />
            <Path d="M 42 66 Q 34 67 26 70" />
            <Path d="M 58 64 Q 66 64 74 62" />
            <Path d="M 58 66 Q 66 67 74 70" />
          </G>
          {/* Dois dentinhos da frente */}
          <Path d="M 48 70 L 48 73 L 50 73 L 50 70 Z" fill="#FFFFFF" stroke="#1A1410" strokeWidth="0.3" />
          <Path d="M 50 70 L 50 73 L 52 73 L 52 70 Z" fill="#FFFFFF" stroke="#1A1410" strokeWidth="0.3" />
        </G>
      );
    default:
      return null;
  }
}

// ============================================================================
// EYEBROWS / BROW RIDGE — sombra sutil acima dos olhos pra dar profundidade facial
// ============================================================================

/**
 * Sobrancelhas sutis acima de cada olho. Não aparecem pra todas espécies/expressões.
 * Mais visíveis pra cães; gatos têm sutil; coelhos/hamsters/pássaros não.
 */
function renderBrowRidge(c: PetAvatarConfig, expression: Props['expression']) {
  // Não renderiza para algumas espécies ou quando expressão já controla sobrancelhas
  if (c.species === 'bird' || c.species === 'fish') return null;
  if (expression === 'angry' || expression === 'sad' || expression === 'cry') return null;
  // Se olhos felizes (curvados ^_^), não precisa de sobrancelha — ficaria poluído
  if (c.eyes === 'happy' || expression === 'happy') return null;

  // Cor da sobrancelha: tom escurecido da pelagem
  const browColor = blendWithBlack(c.fur_color, 0.35);

  // Para gato/coelho: sobrancelhas BEM sutis (quase só uma curva)
  if (c.species === 'cat' || c.species === 'rabbit') {
    return (
      <G stroke={browColor} strokeWidth="0.7" strokeOpacity="0.45" strokeLinecap="round" fill="none">
        <Path d="M 33 44 Q 38 42 43 44" />
        <Path d="M 57 44 Q 62 42 67 44" />
      </G>
    );
  }

  // Cães: sobrancelhas mais expressivas (curvas levemente mais grossas)
  return (
    <G stroke={browColor} strokeWidth="1" strokeOpacity="0.5" strokeLinecap="round" fill="none">
      <Path d="M 32 44 Q 37 41 43 43" />
      <Path d="M 57 43 Q 63 41 68 44" />
    </G>
  );
}

// ============================================================================
// Util
// ============================================================================

function blendWithBlack(hex: string, factor: number): string {
  // Mistura cor com preto. factor 0 = original, 1 = preto
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const nr = Math.round(r * (1 - factor));
  const ng = Math.round(g * (1 - factor));
  const nb = Math.round(b * (1 - factor));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

// Re-exports pra consumo externo (caso precise dos tipos)
export type {
  AvatarSpecies,
  AvatarHeadShape,
  AvatarEars,
  AvatarEyes,
  AvatarMouth,
  AvatarPattern,
  AvatarAccessory,
  PetAvatarConfig,
};
