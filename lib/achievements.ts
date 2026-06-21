import { TUTOR_TIERS } from './tutor-level';
import type { Pet, Vaccination } from './types';

export interface AchievementDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
  /** Tier afeta cor do badge (1=bronze, 2=prata, 3=ouro). */
  tier: 1 | 2 | 3;
}

const BASE_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_pet',
    emoji: '🐾',
    title: 'Bem-vindo à matilha',
    description: 'Cadastrou seu primeiro pet',
    tier: 1,
  },
  {
    id: 'first_post',
    emoji: '📸',
    title: 'Primeiro clique',
    description: 'Publicou o primeiro post',
    tier: 1,
  },
  {
    id: 'first_follower',
    emoji: '🐶',
    title: 'Tem fã',
    description: 'Conseguiu o primeiro seguidor',
    tier: 1,
  },
  {
    id: 'social_butterfly',
    emoji: '🦋',
    title: 'Borboleta social',
    description: 'Pet com 10+ seguidores',
    tier: 2,
  },
  {
    id: 'celebrity',
    emoji: '⭐',
    title: 'Pet celebridade',
    description: 'Pet com 50+ seguidores',
    tier: 3,
  },
  {
    id: 'prolific',
    emoji: '✍️',
    title: 'Posta direto',
    description: 'Tem 10+ posts publicados',
    tier: 2,
  },
  {
    id: 'multi_pet',
    emoji: '🐾',
    title: 'Pet parent múltiplo',
    description: 'Cadastrou 3+ pets na mesma conta',
    tier: 2,
  },
  {
    id: 'host',
    emoji: '🎉',
    title: 'Anfitrião',
    description: 'Criou o primeiro encontro',
    tier: 1,
  },
  {
    id: 'super_host',
    emoji: '🏆',
    title: 'Super anfitrião',
    description: 'Hospedou 5+ encontros',
    tier: 3,
  },
  {
    id: 'vaccinated',
    emoji: '💉',
    title: 'Saúde em dia',
    description: 'Pelo menos um pet com carteira de vacinação',
    tier: 1,
  },
  {
    id: 'helper',
    emoji: '🤝',
    title: 'Bom samaritano',
    description: 'Reportou um pet encontrado',
    tier: 2,
  },
  // ============================================================================
  // Conquistas da Arena Pet (jogos)
  // ============================================================================
  {
    id: 'gamer',
    emoji: '🎮',
    title: 'Pet gamer',
    description: 'Jogou um jogo da Arena Pet',
    tier: 1,
  },
  {
    id: 'arcade_explorer',
    emoji: '🕹️',
    title: 'Explorador da Arena',
    description: 'Jogou 3 jogos diferentes da Arena Pet',
    tier: 2,
  },
  {
    id: 'hardcore',
    emoji: '🔥',
    title: 'Modo difícil',
    description: 'Pontuou no Difícil de algum jogo',
    tier: 3,
  },
  {
    id: 'tournament_champ',
    emoji: '🏆',
    title: 'Campeão de torneio',
    description: 'Entrou no pódio (top 10) de um Torneio da Arena',
    tier: 3,
  },
  // ============================================================================
  // Conquistas da Missão do Dia (foto do dia)
  // ============================================================================
  {
    id: 'mission_first',
    emoji: '🎯',
    title: 'Foto do dia',
    description: 'Cumpriu a primeira missão do dia',
    tier: 1,
  },
  {
    id: 'mission_week',
    emoji: '📅',
    title: 'Semana fotogênica',
    description: 'Cumpriu 7 missões do dia',
    tier: 2,
  },
  {
    id: 'mission_streak',
    emoji: '🔥',
    title: 'Sequência de fogo',
    description: '7 dias seguidos cumprindo a missão do dia',
    tier: 3,
  },
  {
    id: 'mission_month',
    emoji: '🏅',
    title: 'Mês completo',
    description: 'Cumpriu 30 missões do dia',
    tier: 3,
  },
];

// ============================================================================
// Conquistas de marco de Pontos de Tutor (economia unificada)
// Derivadas DIRETO das faixas do Nível de Tutor (TUTOR_TIERS) — sem redigitar
// limiares, então se as faixas forem recalibradas as badges acompanham sozinhas.
// São read-only sobre o total imutável de PT (my_tutor_points): não creditam
// nada, só dão um destino visível ao acúmulo. id = `pt_<min>`.
// ============================================================================
const ptBadgeTier = (min: number): 1 | 2 | 3 => (min < 1000 ? 1 : min < 3000 ? 2 : 3);

const PT_ACHIEVEMENTS: AchievementDef[] = TUTOR_TIERS.filter((t) => t.min > 0).map((t) => ({
  id: `pt_${t.min}`,
  emoji: t.emoji,
  title: t.title,
  description: `Acumulou ${t.min.toLocaleString('pt-BR')} Pontos de Tutor`,
  tier: ptBadgeTier(t.min),
}));

export const ACHIEVEMENTS: AchievementDef[] = [...BASE_ACHIEVEMENTS, ...PT_ACHIEVEMENTS];

export interface AchievementUnlockState {
  def: AchievementDef;
  unlocked: boolean;
  progress?: { current: number; target: number };
}

interface ComputeInput {
  myPets: Pet[];
  totalPosts: number;
  maxFollowers: number;
  hostedMeetupsCount: number;
  vaccinations: Vaccination[];
  foundReportsCount: number;
  distinctGamesPlayed: number;
  maxGameDifficulty: number;
  tournamentWins: number;
  missionsCompleted: number;
  missionStreak: number;
  /** Total vitalício de Pontos de Tutor (my_tutor_points) — alimenta as badges pt_*. */
  tutorPoints: number;
}

/**
 * Calcula no client o estado de cada conquista baseado em queries existentes.
 * Mais simples e barato do que persistir; o estado é sempre derivado.
 */
export function computeAchievements(input: ComputeInput): AchievementUnlockState[] {
  const {
    myPets,
    totalPosts,
    maxFollowers,
    hostedMeetupsCount,
    vaccinations,
    foundReportsCount,
    distinctGamesPlayed,
    maxGameDifficulty,
    tournamentWins,
    missionsCompleted,
    missionStreak,
    tutorPoints,
  } = input;

  return ACHIEVEMENTS.map((def) => {
    let unlocked = false;
    let progress: AchievementUnlockState['progress'] | undefined;

    // Badges de marco de PT: limiar embutido no id (`pt_<min>`), lido do total
    // imutável de Pontos de Tutor. Sempre mostra progresso (current/target).
    if (def.id.startsWith('pt_')) {
      const target = Number(def.id.slice(3));
      unlocked = tutorPoints >= target;
      progress = { current: Math.min(tutorPoints, target), target };
      return { def, unlocked, progress };
    }

    switch (def.id) {
      case 'first_pet':
        unlocked = myPets.length >= 1;
        if (!unlocked) progress = { current: myPets.length, target: 1 };
        break;
      case 'first_post':
        unlocked = totalPosts >= 1;
        if (!unlocked) progress = { current: totalPosts, target: 1 };
        break;
      case 'first_follower':
        unlocked = maxFollowers >= 1;
        if (!unlocked) progress = { current: maxFollowers, target: 1 };
        break;
      case 'social_butterfly':
        unlocked = maxFollowers >= 10;
        progress = { current: Math.min(maxFollowers, 10), target: 10 };
        break;
      case 'celebrity':
        unlocked = maxFollowers >= 50;
        progress = { current: Math.min(maxFollowers, 50), target: 50 };
        break;
      case 'prolific':
        unlocked = totalPosts >= 10;
        progress = { current: Math.min(totalPosts, 10), target: 10 };
        break;
      case 'multi_pet':
        unlocked = myPets.length >= 3;
        progress = { current: Math.min(myPets.length, 3), target: 3 };
        break;
      case 'host':
        unlocked = hostedMeetupsCount >= 1;
        if (!unlocked) progress = { current: hostedMeetupsCount, target: 1 };
        break;
      case 'super_host':
        unlocked = hostedMeetupsCount >= 5;
        progress = { current: Math.min(hostedMeetupsCount, 5), target: 5 };
        break;
      case 'vaccinated':
        unlocked = vaccinations.length >= 1;
        if (!unlocked) progress = { current: vaccinations.length, target: 1 };
        break;
      case 'helper':
        unlocked = foundReportsCount >= 1;
        if (!unlocked) progress = { current: foundReportsCount, target: 1 };
        break;
      case 'gamer':
        unlocked = distinctGamesPlayed >= 1;
        if (!unlocked) progress = { current: distinctGamesPlayed, target: 1 };
        break;
      case 'arcade_explorer':
        unlocked = distinctGamesPlayed >= 3;
        progress = { current: Math.min(distinctGamesPlayed, 3), target: 3 };
        break;
      case 'hardcore':
        unlocked = maxGameDifficulty >= 3;
        if (!unlocked) progress = { current: Math.min(maxGameDifficulty, 3), target: 3 };
        break;
      case 'tournament_champ':
        unlocked = tournamentWins >= 1;
        if (!unlocked) progress = { current: tournamentWins, target: 1 };
        break;
      case 'mission_first':
        unlocked = missionsCompleted >= 1;
        if (!unlocked) progress = { current: missionsCompleted, target: 1 };
        break;
      case 'mission_week':
        unlocked = missionsCompleted >= 7;
        progress = { current: Math.min(missionsCompleted, 7), target: 7 };
        break;
      case 'mission_streak':
        unlocked = missionStreak >= 7;
        progress = { current: Math.min(missionStreak, 7), target: 7 };
        break;
      case 'mission_month':
        unlocked = missionsCompleted >= 30;
        progress = { current: Math.min(missionsCompleted, 30), target: 30 };
        break;
    }

    return { def, unlocked, progress };
  });
}

export function tierColors(tier: 1 | 2 | 3): { bg: string; border: string; text: string } {
  switch (tier) {
    case 3:
      return { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' }; // ouro
    case 2:
      return { bg: '#F1F5F9', border: '#94A3B8', text: '#475569' }; // prata
    default:
      return { bg: '#FFEDD5', border: '#FB923C', text: '#9A3412' }; // bronze
  }
}
