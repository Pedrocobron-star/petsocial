/**
 * Nível do jogador (XP cross-game da Arena Pet).
 *
 * O XP é o "total_score" do placar geral combinado (soma do melhor score
 * efetivo de cada um dos 3 jogos). Aqui mapeamos esse XP num nível + título,
 * com uma curva triangular: o XP acumulado pra ALCANÇAR o nível L é
 * B * L*(L-1)/2. Níveis iniciais vêm rápido (engajamento), depois ficam mais
 * caros (long-term). Tudo client-side, sem custo de banco extra.
 */

const B = 100;

/** XP acumulado necessário pra ALCANÇAR o nível `level` (nível 1 = 0 XP). */
function cumulativeXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round((B * level * (level - 1)) / 2);
}

interface TitleBand {
  min: number; // nível mínimo pra ganhar este título
  title: string;
  emoji: string;
}

const TITLES: TitleBand[] = [
  { min: 1, title: 'Filhote Curioso', emoji: '🐶' },
  { min: 3, title: 'Aprendiz de Tutor', emoji: '🦴' },
  { min: 5, title: 'Tutor Dedicado', emoji: '🐕' },
  { min: 8, title: 'Tutor Experiente', emoji: '🏅' },
  { min: 12, title: 'Mestre dos Pets', emoji: '🎖️' },
  { min: 16, title: 'Lenda da Arena Pet', emoji: '👑' },
];

export interface PlayerLevel {
  level: number;
  title: string;
  emoji: string;
  xp: number; // XP total (total_score do placar geral)
  levelStartXp: number; // XP acumulado no início do nível atual
  nextLevelXp: number; // XP acumulado pra alcançar o próximo nível
  intoLevel: number; // XP dentro do nível atual (xp - levelStartXp)
  span: number; // tamanho do nível atual (nextLevelXp - levelStartXp)
  toNext: number; // XP que falta pro próximo nível
  progress: number; // 0..1 dentro do nível atual
}

export function computePlayerLevel(xp: number): PlayerLevel {
  const totalXp = Math.max(0, Math.floor(xp || 0));
  let level = 1;
  // sobe enquanto o XP cobrir o custo do próximo nível (teto de segurança)
  while (level < 999 && cumulativeXpForLevel(level + 1) <= totalXp) level += 1;

  const levelStartXp = cumulativeXpForLevel(level);
  const nextLevelXp = cumulativeXpForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - levelStartXp);
  const intoLevel = totalXp - levelStartXp;
  const band = [...TITLES].reverse().find((t) => level >= t.min) ?? TITLES[0];

  return {
    level,
    title: band.title,
    emoji: band.emoji,
    xp: totalXp,
    levelStartXp,
    nextLevelXp,
    intoLevel,
    span,
    toNext: Math.max(0, nextLevelXp - totalXp),
    progress: Math.min(1, Math.max(0, intoLevel / span)),
  };
}
