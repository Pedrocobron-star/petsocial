/**
 * Desafio Diário da Arena Pet.
 *
 * Todo dia (fuso BR, vira à meia-noite) o app fixa UM jogo + UMA dificuldade,
 * iguais pra todo mundo — o que permite um placar diário compartilhado e
 * comparação social (motor de FOMO/retorno-diário, estilo Wordle).
 *
 * A escolha é determinística a partir do número do dia: passo 5 (coprimo de 12)
 * percorre as 12 combinações (4 jogos × 3 dificuldades) antes de repetir, e a
 * tabela é intercalada por jogo, então nunca cai no mesmo jogo dois dias
 * seguidos. Tudo puro/testável; só o cálculo da data usa o relógio.
 */
import type { GameDifficulty, GameKey } from './games';

interface Combo {
  game: GameKey;
  difficulty: GameDifficulty;
}

/** Tabela base intercalada por jogo (não agrupada) → dias seguidos trocam de jogo. */
const COMBOS: Combo[] = [
  { game: 'treats', difficulty: 1 }, // 0
  { game: 'quiz', difficulty: 2 }, // 1
  { game: 'caminho', difficulty: 3 }, // 2
  { game: 'runner', difficulty: 1 }, // 3
  { game: 'treats', difficulty: 2 }, // 4
  { game: 'quiz', difficulty: 3 }, // 5
  { game: 'caminho', difficulty: 1 }, // 6
  { game: 'runner', difficulty: 2 }, // 7
  { game: 'treats', difficulty: 3 }, // 8
  { game: 'quiz', difficulty: 1 }, // 9
  { game: 'caminho', difficulty: 2 }, // 10
  { game: 'runner', difficulty: 3 }, // 11
];

const STEP = 5; // coprimo de 12 → cobre as 12 combinações antes de repetir

/** PURO. Mesmo dayNumber → mesmo {game, difficulty}, sempre. Lida com negativos. */
export function pickDailyChallenge(dayNumber: number): Combo {
  const n = Math.trunc(dayNumber);
  const len = COMBOS.length;
  const idx = (((n * STEP) % len) + len) % len;
  return COMBOS[idx];
}

/** Deriva o número do dia + a data 'YYYY-MM-DD' no fuso BR a partir do relógio. */
export function brDayInfo(date: Date = new Date()): { dayNumber: number; dateStr: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = Number(parts.find((p) => p.type === 'year')?.value);
    const m = Number(parts.find((p) => p.type === 'month')?.value);
    const d = Number(parts.find((p) => p.type === 'day')?.value);
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
    return { dayNumber, dateStr };
  } catch {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { dayNumber: Math.floor(Date.UTC(y, m - 1, d) / 86400000), dateStr };
  }
}

export interface TodayChallenge {
  game: GameKey;
  difficulty: GameDifficulty;
  dateStr: string;
}

/** O desafio de hoje (jogo + dificuldade + data BR). */
export function todayChallenge(date: Date = new Date()): TodayChallenge {
  const { dayNumber, dateStr } = brDayInfo(date);
  const c = pickDailyChallenge(dayNumber);
  return { game: c.game, difficulty: c.difficulty, dateStr };
}

/** Hash de string determinístico (FNV-1a 32-bit) → uint32 bem distribuído. */
export function hashStr(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export interface ChestReward {
  id: string;
  emoji: string;
  label: string;
  copy: string;
}

/** Recompensas cosméticas do baú (sem efeito de jogo, sem schema novo). */
export const CHEST_REWARDS: ChestReward[] = [
  { id: 'osso_dourado', emoji: '🦴', label: 'Osso Dourado', copy: 'Você achou o Osso Dourado! Seu pet tá babando de inveja. 🤤' },
  { id: 'petisco_lendario', emoji: '🍖', label: 'Petisco Lendário', copy: 'Petisco Lendário desbloqueado! Cheirinho de vitória no ar. 😋' },
  { id: 'coroa_au', emoji: '👑', label: 'Coroa do Au-Au', copy: 'Coroa do Au-Au na cabeça! Hoje você reina no quintal. 👑' },
  { id: 'estrela_pet', emoji: '⭐', label: 'Estrela Pet', copy: 'Uma Estrela Pet brilhou pra você! Tá shining, hein. ✨' },
  { id: 'bolinha_magica', emoji: '🎾', label: 'Bolinha Mágica', copy: 'Bolinha Mágica! Joga pro alto que ela sempre volta. 🎾' },
  { id: 'pata_sorte', emoji: '🐾', label: 'Patinha da Sorte', copy: 'Patinha da Sorte! Dizem que dá miado de campeão. 🍀' },
  { id: 'coracao_pet', emoji: '💖', label: 'Coração de Pet', copy: 'Coração de Pet cheinho de amor! Que fofura. 💖' },
  { id: 'trofeu_quintal', emoji: '🏆', label: 'Troféu do Quintal', copy: 'Troféu do Quintal é seu! Lata de petisco em dobro (na imaginação). 🏆' },
];

/** PURO. Baú "pessoal" do dia: estável pro mesmo user+dia, varia entre users. */
export function pickChest(dateStr: string, userId: string): ChestReward {
  const h = hashStr(`${dateStr}:${userId}`);
  return CHEST_REWARDS[h % CHEST_REWARDS.length];
}
