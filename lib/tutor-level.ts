/**
 * Nível de Tutor — progressão que os PONTOS da Missão do Dia alimentam.
 *
 * Antes os pontos só apareciam no card e morriam no banco. Agora eles têm
 * destino: somam num total (`total_points` de `get_today_mission`) que sobe o
 * Nível de Tutor — um título fofo que cresce conforme você cuida e participa.
 *
 * É 100% client-side a partir do total de pontos (sem tabela nova). Os limiares
 * assumem ~15-25 pts/dia: um tutor ativo sobe alguns níveis por mês.
 */

interface TutorTier {
  /** Pontos mínimos pra estar nesse nível. */
  min: number;
  title: string;
  emoji: string;
}

const TUTOR_TIERS: TutorTier[] = [
  { min: 0, title: 'Filhote', emoji: '🐣' },
  { min: 45, title: 'Curioso', emoji: '🐶' },
  { min: 120, title: 'Companheiro', emoji: '🦴' },
  { min: 250, title: 'Parceiro', emoji: '🐾' },
  { min: 450, title: 'Melhor Amigo', emoji: '❤️' },
  { min: 750, title: 'Tutor Dedicado', emoji: '🌟' },
  { min: 1200, title: 'Tutor Master', emoji: '🏆' },
  { min: 2000, title: 'Lenda Pet', emoji: '👑' },
];

export interface TutorLevel {
  /** Nível 1..N. */
  level: number;
  title: string;
  emoji: string;
  points: number;
  /** Título do próximo nível (null se já é o máximo). */
  nextTitle: string | null;
  /** Pontos que faltam pro próximo nível (0 se máximo). */
  toNext: number;
  /** Progresso dentro do nível atual, 0..1. */
  progress: number;
  isMax: boolean;
}

export function computeTutorLevel(points: number): TutorLevel {
  const p = Math.max(0, Math.floor(points || 0));
  let idx = 0;
  for (let i = 0; i < TUTOR_TIERS.length; i++) {
    if (p >= TUTOR_TIERS[i].min) idx = i;
    else break;
  }
  const cur = TUTOR_TIERS[idx];
  const next = TUTOR_TIERS[idx + 1] ?? null;
  const isMax = !next;
  const toNext = next ? Math.max(0, next.min - p) : 0;
  const span = next ? next.min - cur.min : 1;
  const progress = next ? Math.max(0, Math.min(1, (p - cur.min) / span)) : 1;
  return {
    level: idx + 1,
    title: cur.title,
    emoji: cur.emoji,
    points: p,
    nextTitle: next?.title ?? null,
    toNext,
    progress,
    isMax,
  };
}
