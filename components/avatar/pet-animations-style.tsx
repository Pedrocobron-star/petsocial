import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Injeta os keyframes CSS do Pet Avatar no <head> do documento (web only).
 *
 * Por que aqui e não no global.css?
 * O Expo web roda o global.css através do Metro + PostCSS Tailwind, mas
 * regras CSS depois das diretivas `@tailwind` podem ser ignoradas no bundle
 * final em alguns pipelines. Injetar via JS direto no <head> garante 100%
 * de carregamento, ignora qualquer transformação do bundler e tem precedência
 * via !important nas próprias regras.
 *
 * Em iOS/Android: no-op total (CSS não existe).
 */
export function PetAnimationsStyle() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    if (document.getElementById('pet-animations-css')) return;

    const style = document.createElement('style');
    style.id = 'pet-animations-css';
    style.textContent = PET_ANIMATIONS_CSS;
    document.head.appendChild(style);
  }, []);

  return null;
}

const PET_ANIMATIONS_CSS = `
@keyframes pet-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(0.97); }
}
@keyframes pet-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes pet-wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-3deg); }
  75% { transform: rotate(3deg); }
}
@keyframes pet-dance {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-6px) rotate(-4deg); }
  75% { transform: translateY(-6px) rotate(4deg); }
}
@keyframes pet-pop {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes pet-jump {
  0%, 100% { transform: translateY(0); }
  20% { transform: translateY(-12px) scale(1.05); }
  40% { transform: translateY(0); }
  60% { transform: translateY(-6px) scale(1.02); }
  80% { transform: translateY(0); }
}
@keyframes pet-float-y {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes pet-spin-once {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes pet-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
@keyframes pet-head-tilt {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-8deg); }
  60% { transform: rotate(6deg); }
  80% { transform: rotate(-2deg); }
}
@keyframes pet-sleep {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(2px) scale(0.98); }
}
@keyframes pet-wag {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-4deg) translateX(-1px); }
  75% { transform: rotate(4deg) translateX(1px); }
}
@keyframes pet-yawn {
  0%, 100% { transform: scale(1); }
  30% { transform: scale(1.08, 0.96); }
  60% { transform: scale(0.98, 1.06); }
}
@keyframes pet-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-3px) rotate(-2deg); }
  40%, 80% { transform: translateX(3px) rotate(2deg); }
}
@keyframes pet-zoom-in {
  0% { transform: scale(0.3); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes pet-heart-burst {
  0% { transform: scale(0) rotate(-15deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(5deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
/* Pro-only: aura colorida pulsante */
@keyframes pet-rainbow-aura {
  0%, 100% { filter: drop-shadow(0 0 4px #EC4899) drop-shadow(0 0 8px #A855F7); transform: scale(1); }
  33% { filter: drop-shadow(0 0 6px #FBBF24) drop-shadow(0 0 10px #F97316); transform: scale(1.02); }
  66% { filter: drop-shadow(0 0 6px #3B82F6) drop-shadow(0 0 10px #10B981); transform: scale(1.02); }
}
/* Pro-only: brilho sutil ao redor pulsando */
@keyframes pet-sparkle-orbit {
  0%, 100% { filter: drop-shadow(0 0 3px #FBBF24) brightness(1.05); }
  50% { filter: drop-shadow(0 0 8px #FBBF24) brightness(1.15); }
}

.pet-anim-breathe { animation: pet-breathe 2.8s ease-in-out infinite !important; transform-origin: 50% 60% !important; }
.pet-anim-bob { animation: pet-bob 2.4s ease-in-out infinite !important; }
.pet-anim-wiggle { animation: pet-wiggle 0.8s ease-in-out infinite !important; transform-origin: 50% 80% !important; }
.pet-anim-dance { animation: pet-dance 1.2s ease-in-out infinite !important; transform-origin: 50% 80% !important; }
.pet-anim-float { animation: pet-float-y 3s ease-in-out infinite !important; }
.pet-anim-pulse { animation: pet-pulse 1.6s ease-in-out infinite !important; transform-origin: 50% 50% !important; }
.pet-anim-pop { animation: pet-pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both !important; transform-origin: 50% 80% !important; }
.pet-anim-jump { animation: pet-jump 1.2s ease-in-out both !important; }
.pet-anim-spin { animation: pet-spin-once 0.8s ease-in-out both !important; transform-origin: 50% 50% !important; }
.pet-anim-peek { transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1) !important; }
.pet-anim-peek:hover { transform: scale(1.06) rotate(-2deg) !important; }

/* Override prefers-reduced-motion — animações do pet são feature core */
@media (prefers-reduced-motion: reduce) {
  .pet-anim-breathe { animation: pet-breathe 2.8s ease-in-out infinite !important; }
  .pet-anim-bob { animation: pet-bob 2.4s ease-in-out infinite !important; }
  .pet-anim-wiggle { animation: pet-wiggle 0.8s ease-in-out infinite !important; }
  .pet-anim-dance { animation: pet-dance 1.2s ease-in-out infinite !important; }
  .pet-anim-float { animation: pet-float-y 3s ease-in-out infinite !important; }
  .pet-anim-pulse { animation: pet-pulse 1.6s ease-in-out infinite !important; }
  .pet-anim-pop { animation: pet-pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both !important; }
  .pet-anim-jump { animation: pet-jump 1.2s ease-in-out both !important; }
  .pet-anim-spin { animation: pet-spin-once 0.8s ease-in-out both !important; }
}
`;
