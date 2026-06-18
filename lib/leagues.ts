/**
 * Ligas semanais da Arena Pet.
 *
 * Toda semana (BR, começa segunda) os pontos efetivos somados dos 3 jogos
 * colocam o tutor numa liga: Bronze → Prata → Ouro → Platina → Diamante.
 * Como os pontos contam só a semana atual, a liga "reseta" sozinha toda
 * segunda — competição recorrente, sem job de limpeza. A pontuação é a mesma
 * regra de score efetivo (score × multiplicador de dificuldade) do placar.
 */

export interface League {
  key: string;
  name: string;
  emoji: string;
  min: number; // pontos semanais mínimos pra estar nesta liga
  color: string;
}

export const LEAGUES: League[] = [
  { key: 'bronze', name: 'Bronze', emoji: '🥉', min: 0, color: '#CD7F32' },
  { key: 'prata', name: 'Prata', emoji: '🥈', min: 150, color: '#CBD5E1' },
  { key: 'ouro', name: 'Ouro', emoji: '🥇', min: 400, color: '#FBBF24' },
  { key: 'platina', name: 'Platina', emoji: '💎', min: 800, color: '#67E8F9' },
  { key: 'diamante', name: 'Diamante', emoji: '👑', min: 1500, color: '#A78BFA' },
];

export interface LeagueProgress {
  current: League;
  next: League | null;
  points: number;
  toNext: number; // pontos que faltam pra próxima liga (0 se no topo)
  progress: number; // 0..1 dentro da liga atual
}

export function computeLeague(points: number): LeagueProgress {
  const pts = Math.max(0, Math.floor(points || 0));
  let idx = 0;
  for (let i = 0; i < LEAGUES.length; i++) {
    if (pts >= LEAGUES[i].min) idx = i;
  }
  const current = LEAGUES[idx];
  const next = idx < LEAGUES.length - 1 ? LEAGUES[idx + 1] : null;
  const span = next ? Math.max(1, next.min - current.min) : 1;
  const into = pts - current.min;
  return {
    current,
    next,
    points: pts,
    toNext: next ? Math.max(0, next.min - pts) : 0,
    progress: next ? Math.min(1, Math.max(0, into / span)) : 1,
  };
}
