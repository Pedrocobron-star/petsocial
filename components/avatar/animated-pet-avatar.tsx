import { memo, useEffect } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { PetAvatarConfig } from '@/lib/types';
import { useMotion } from '@/providers/motion-provider';

import { PetAvatarSvg } from './pet-avatar-svg';
import { useInViewport } from './use-in-viewport';

export type AvatarAnimation =
  | 'breathe'    // loop: respiração sutil
  | 'bob'        // loop: bobbing vertical leve
  | 'wiggle'     // loop: balanço
  | 'dance'      // loop: vai e vem com rotação
  | 'float'      // loop: float Y mais amplo
  | 'pulse'      // loop: pulsa de escala
  | 'sleep'      // loop: respiração devagar (dormindo)
  | 'wag'        // loop: rabinho abanando (rotação pequena)
  | 'pop'        // one-shot: entrada com escala
  | 'jump'       // one-shot: pula
  | 'spin'       // one-shot: rotação 360
  | 'head_tilt'  // one-shot: head tilt curioso
  | 'yawn'       // one-shot: boceja
  | 'shake'      // one-shot: sacode (típica de cachorro molhado)
  | 'zoom_in'    // one-shot: entrada zoom
  | 'heart_burst'// one-shot: anima com coração (love/like)
  | 'rainbow_aura'  // Pro loop: aura arco-íris pulsante
  | 'sparkle_orbit' // Pro loop: brilho dourado pulsando
  | 'peek'       // hover: leve scale (web only)
  | null;

interface Props {
  config: PetAvatarConfig | null | undefined;
  size?: number;
  showBackground?: boolean;
  expression?:
    | 'happy'
    | 'sad'
    | 'surprised'
    | 'love'
    | 'cry'
    | 'angry'
    | 'sleep'
    | null;
  animation?: AvatarAnimation;
  /** Re-trigger one-shot animations quando essa chave mudar */
  triggerKey?: string | number;
  /** Piscadinha automática. Default true. Memorial/avatars estáticos passam false. */
  idleBlink?: boolean;
  /** Seed determinístico (ex: pet.id) pra variar pintas/manchas. */
  seed?: string;
  /** Faixa etária — afeta olhos/grisalho. Calcule com petAgeStage(pet.birthdate). */
  ageStage?: 'puppy' | 'adult' | 'senior';
  style?: ViewStyle;
}

/**
 * Wrapper inteligente do PetAvatarSvg com animações.
 *
 * Estratégia:
 *  - Web: usa classe CSS (`pet-anim-*`) que bypassa Reanimated/reduce motion.
 *  - Native: usa Reanimated com `ReduceMotion.Never` em todas as chamadas.
 *
 * Animações em loop (breathe, bob, wiggle, dance, float, pulse) ficam rodando
 * enquanto o componente está montado. One-shots (pop, jump, spin) rodam ao
 * montar OU quando `triggerKey` muda.
 */
function AnimatedPetAvatarInner({
  config,
  size = 80,
  showBackground = true,
  expression = null,
  animation = null,
  triggerKey,
  idleBlink = true,
  seed,
  ageStage,
  style,
}: Props) {
  const { animationsEnabled } = useMotion();
  const [viewportRef, inView] = useInViewport();
  // Pausa animação se: user desativou ou avatar está off-screen (web).
  // One-shot animations (pop, jump, etc) continuam mesmo off-screen pra não
  // perder o efeito quando o user rolar de volta — só loops pausam.
  const isLoopAnim = animation && LOOP_ANIMATIONS.has(animation);
  const effectiveAnimation = animationsEnabled
    ? isLoopAnim && !inView
      ? null
      : animation
    : null;

  // ------------------- WEB: aplica animation via inline style --------------
  // (mais robusto que className — RN Web acumula classes em remounts).
  if (Platform.OS === 'web') {
    const animStyle = effectiveAnimation ? buildWebAnimationStyle(effectiveAnimation) : null;
    return (
      <View
        ref={viewportRef as never}
        // Re-mount quando triggerKey muda pra reiniciar one-shots
        key={`${effectiveAnimation ?? 'static'}-${triggerKey ?? ''}`}
        style={[{ width: size, height: size }, animStyle as never, style]}
      >
        <PetAvatarSvg
          config={config}
          size={size}
          showBackground={showBackground}
          expression={expression}
          idleBlink={idleBlink}
          seed={seed}
          ageStage={ageStage}
        />
      </View>
    );
  }

  // ----------------- NATIVE: usa Reanimated com fallback robusto -----------
  return (
    <NativeAnimated
      config={config}
      size={size}
      showBackground={showBackground}
      expression={expression}
      animation={effectiveAnimation}
      triggerKey={triggerKey}
      idleBlink={idleBlink}
      seed={seed}
      ageStage={ageStage}
      style={style}
    />
  );
}

/**
 * Comparator do React.memo: shallow no config (objeto plano do banco).
 */
function areAnimatedPropsEqual(prev: Props, next: Props): boolean {
  if (
    prev.size !== next.size ||
    prev.showBackground !== next.showBackground ||
    prev.expression !== next.expression ||
    prev.animation !== next.animation ||
    prev.triggerKey !== next.triggerKey ||
    prev.idleBlink !== next.idleBlink ||
    prev.seed !== next.seed ||
    prev.ageStage !== next.ageStage ||
    prev.style !== next.style
  ) {
    return false;
  }
  if (prev.config === next.config) return true;
  if (!prev.config || !next.config) return false;
  const a = prev.config as unknown as Record<string, unknown>;
  const b = next.config as unknown as Record<string, unknown>;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export const AnimatedPetAvatar = memo(AnimatedPetAvatarInner, areAnimatedPropsEqual);

/**
 * Animação ambiente baseada na personalidade do pet — dá identidade
 * a cada um sem precisar configurar manualmente.
 */
export function animationForPersonality(
  personality: string | null | undefined,
): AvatarAnimation {
  switch (personality) {
    case 'adventurer':
      return 'bob'; // sempre curioso, mexendo
    case 'playful':
      return 'wag'; // rabinho/corpo animado
    case 'royal':
      return 'pulse'; // postura altiva
    case 'shy':
    case 'cuddler':
    case 'independent':
    default:
      return 'breathe'; // calmo
  }
}

/** Animações em loop que devem pausar quando off-screen. One-shots passam direto. */
const LOOP_ANIMATIONS: Set<NonNullable<AvatarAnimation>> = new Set([
  'breathe',
  'bob',
  'wiggle',
  'dance',
  'float',
  'pulse',
  'sleep',
  'wag',
  'rainbow_aura',
  'sparkle_orbit',
]);

// CSS animation params por tipo. Map exato pro que está em PetAnimationsStyle.
const WEB_ANIMATION_CONFIG: Record<Exclude<AvatarAnimation, null | 'peek'>, {
  name: string;
  duration: string;
  iteration: string;
  easing: string;
  fillMode?: string;
  origin?: string;
}> = {
  breathe: { name: 'pet-breathe', duration: '2.8s', iteration: 'infinite', easing: 'ease-in-out', origin: '50% 60%' },
  bob: { name: 'pet-bob', duration: '2.4s', iteration: 'infinite', easing: 'ease-in-out' },
  wiggle: { name: 'pet-wiggle', duration: '0.8s', iteration: 'infinite', easing: 'ease-in-out', origin: '50% 80%' },
  dance: { name: 'pet-dance', duration: '1.2s', iteration: 'infinite', easing: 'ease-in-out', origin: '50% 80%' },
  float: { name: 'pet-float-y', duration: '3s', iteration: 'infinite', easing: 'ease-in-out' },
  pulse: { name: 'pet-pulse', duration: '1.6s', iteration: 'infinite', easing: 'ease-in-out', origin: '50% 50%' },
  sleep: { name: 'pet-sleep', duration: '3.6s', iteration: 'infinite', easing: 'ease-in-out' },
  wag: { name: 'pet-wag', duration: '0.5s', iteration: 'infinite', easing: 'ease-in-out', origin: '50% 80%' },
  pop: { name: 'pet-pop', duration: '0.42s', iteration: '1', easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fillMode: 'both', origin: '50% 80%' },
  jump: { name: 'pet-jump', duration: '1.2s', iteration: '1', easing: 'ease-in-out', fillMode: 'both' },
  spin: { name: 'pet-spin-once', duration: '0.8s', iteration: '1', easing: 'ease-in-out', fillMode: 'both', origin: '50% 50%' },
  head_tilt: { name: 'pet-head-tilt', duration: '1.2s', iteration: '1', easing: 'ease-in-out', fillMode: 'both', origin: '50% 70%' },
  yawn: { name: 'pet-yawn', duration: '1.4s', iteration: '1', easing: 'ease-in-out', fillMode: 'both', origin: '50% 60%' },
  shake: { name: 'pet-shake', duration: '0.6s', iteration: '1', easing: 'ease-in-out', fillMode: 'both', origin: '50% 50%' },
  zoom_in: { name: 'pet-zoom-in', duration: '0.5s', iteration: '1', easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fillMode: 'both', origin: '50% 50%' },
  heart_burst: { name: 'pet-heart-burst', duration: '0.6s', iteration: '1', easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fillMode: 'both', origin: '50% 50%' },
  rainbow_aura: { name: 'pet-rainbow-aura', duration: '3s', iteration: 'infinite', easing: 'ease-in-out', origin: '50% 50%' },
  sparkle_orbit: { name: 'pet-sparkle-orbit', duration: '2s', iteration: 'infinite', easing: 'ease-in-out', origin: '50% 50%' },
};

function buildWebAnimationStyle(animation: Exclude<AvatarAnimation, null>): Record<string, string> | null {
  if (animation === 'peek') {
    return {
      transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    };
  }
  const cfg = WEB_ANIMATION_CONFIG[animation];
  if (!cfg) return null;
  const animValue = `${cfg.name} ${cfg.duration} ${cfg.easing} ${cfg.iteration}${cfg.fillMode ? ` ${cfg.fillMode}` : ''}`;
  return {
    animation: animValue,
    transformOrigin: cfg.origin ?? '50% 50%',
  };
}

function NativeAnimated({
  config,
  size = 80,
  showBackground = true,
  expression = null,
  animation,
  triggerKey,
  idleBlink = true,
  seed,
  ageStage,
  style,
}: Props) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    // Reset
    scale.value = 1;
    translateY.value = 0;
    rotate.value = 0;

    if (!animation) return;

    switch (animation) {
      case 'breathe':
        scale.value = withRepeat(
          withSequence(
            withTiming(0.97, { duration: 1400, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
            withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          ),
          -1, false, undefined, ReduceMotion.Never,
        );
        break;
      case 'bob':
      case 'float':
        translateY.value = withRepeat(
          withSequence(
            withTiming(animation === 'float' ? -8 : -4, { duration: 1200, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
            withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          ),
          -1, false, undefined, ReduceMotion.Never,
        );
        break;
      case 'wiggle':
        rotate.value = withRepeat(
          withSequence(
            withTiming(-3, { duration: 400, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
            withTiming(3, { duration: 400, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          ),
          -1, true, undefined, ReduceMotion.Never,
        );
        break;
      case 'dance':
        translateY.value = withRepeat(
          withSequence(
            withTiming(-6, { duration: 600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
            withTiming(0, { duration: 600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          ),
          -1, false, undefined, ReduceMotion.Never,
        );
        rotate.value = withRepeat(
          withSequence(
            withTiming(-4, { duration: 600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
            withTiming(4, { duration: 600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          ),
          -1, true, undefined, ReduceMotion.Never,
        );
        break;
      case 'pulse':
        scale.value = withRepeat(
          withSequence(
            withTiming(1.06, { duration: 800, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
            withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          ),
          -1, false, undefined, ReduceMotion.Never,
        );
        break;
      case 'pop':
        scale.value = 0;
        scale.value = withSpring(1, {
          damping: 8, stiffness: 200, mass: 0.6, reduceMotion: ReduceMotion.Never,
        });
        break;
      case 'jump':
        translateY.value = withSequence(
          withTiming(-12, { duration: 240, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
          withTiming(0, { duration: 280, easing: Easing.bounce, reduceMotion: ReduceMotion.Never }),
          withTiming(-6, { duration: 200, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
          withTiming(0, { duration: 240, easing: Easing.bounce, reduceMotion: ReduceMotion.Never }),
        );
        scale.value = withSequence(
          withTiming(1.05, { duration: 240, reduceMotion: ReduceMotion.Never }),
          withTiming(1, { duration: 280, reduceMotion: ReduceMotion.Never }),
        );
        break;
      case 'spin':
        rotate.value = withTiming(360, {
          duration: 800, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never,
        });
        break;
      case 'sleep':
        // Respiração devagar, dormindo
        translateY.value = withRepeat(
          withSequence(
            withTiming(2, { duration: 1800, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
            withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          ),
          -1, false, undefined, ReduceMotion.Never,
        );
        scale.value = withRepeat(
          withSequence(
            withTiming(0.98, { duration: 1800, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
            withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          ),
          -1, false, undefined, ReduceMotion.Never,
        );
        break;
      case 'wag':
        // Rabinho abanando (rotação rápida pequena)
        rotate.value = withRepeat(
          withSequence(
            withTiming(-4, { duration: 250, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
            withTiming(4, { duration: 250, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          ),
          -1, true, undefined, ReduceMotion.Never,
        );
        break;
      case 'head_tilt':
        // Head tilt curioso — uma rotação ida e volta
        rotate.value = withSequence(
          withTiming(-8, { duration: 240, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
          withTiming(6, { duration: 480, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          withTiming(-2, { duration: 240, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          withTiming(0, { duration: 240, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
        );
        break;
      case 'yawn':
        // Bocejo — esquica e estica
        scale.value = withSequence(
          withTiming(1.08, { duration: 400, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
          withTiming(0.98, { duration: 600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          withTiming(1, { duration: 400, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
        );
        break;
      case 'shake':
        // Sacode (cachorro molhado)
        rotate.value = withSequence(
          withTiming(-6, { duration: 80, reduceMotion: ReduceMotion.Never }),
          withTiming(6, { duration: 80, reduceMotion: ReduceMotion.Never }),
          withTiming(-5, { duration: 80, reduceMotion: ReduceMotion.Never }),
          withTiming(5, { duration: 80, reduceMotion: ReduceMotion.Never }),
          withTiming(-3, { duration: 80, reduceMotion: ReduceMotion.Never }),
          withTiming(0, { duration: 120, reduceMotion: ReduceMotion.Never }),
        );
        break;
      case 'zoom_in':
        scale.value = 0.3;
        scale.value = withSpring(1, {
          damping: 10, stiffness: 180, mass: 0.7, reduceMotion: ReduceMotion.Never,
        });
        break;
      case 'heart_burst':
        scale.value = 0;
        scale.value = withSpring(1, {
          damping: 8, stiffness: 220, mass: 0.5, reduceMotion: ReduceMotion.Never,
        });
        rotate.value = withSequence(
          withTiming(-15, { duration: 150, reduceMotion: ReduceMotion.Never }),
          withTiming(5, { duration: 250, reduceMotion: ReduceMotion.Never }),
          withTiming(0, { duration: 200, reduceMotion: ReduceMotion.Never }),
        );
        break;
      case 'peek':
        // No native, peek é um hover-like (sem hover real) — ignorado
        break;
      case 'rainbow_aura':
      case 'sparkle_orbit':
        // Pro: efeitos com drop-shadow/filter — web only por enquanto.
        // No native, fallback pra leve pulse pra dar feedback visual.
        scale.value = withRepeat(
          withSequence(
            withTiming(1.04, { duration: 1000, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
            withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          ),
          -1, false, undefined, ReduceMotion.Never,
        );
        break;
    }
  }, [animation, triggerKey, scale, translateY, rotate]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[{ width: size, height: size }, animStyle, style]}>
      <PetAvatarSvg
        config={config}
        size={size}
        showBackground={showBackground}
        expression={expression}
        idleBlink={idleBlink}
        seed={seed}
        ageStage={ageStage}
      />
    </Animated.View>
  );
}
