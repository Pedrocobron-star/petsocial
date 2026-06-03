import type { Pet, Vaccination } from './types';

export interface AchievementDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
  /** Tier afeta cor do badge (1=bronze, 2=prata, 3=ouro). */
  tier: 1 | 2 | 3;
}

export const ACHIEVEMENTS: AchievementDef[] = [
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
  // Conquistas Pro — só desbloqueiam com features exclusivas (Pet Pro)
  // ============================================================================
  {
    id: 'avatar_artist',
    emoji: '🎨',
    title: 'Artista do avatar',
    description: 'Personalizou um pet com customizações Pro (charm, cor custom, cenário ou heterocromia)',
    tier: 2,
  },
  {
    id: 'scene_traveler',
    emoji: '🌍',
    title: 'Pet viajado',
    description: 'Usou cenários diferentes em pelo menos 2 pets',
    tier: 3,
  },
  {
    id: 'bling_master',
    emoji: '💎',
    title: 'Realeza',
    description: 'Pet com coleira dourada e pingente — visual de luxo',
    tier: 3,
  },
];

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
}

/**
 * Calcula no client o estado de cada conquista baseado em queries existentes.
 * Mais simples e barato do que persistir; o estado é sempre derivado.
 */
export function computeAchievements(input: ComputeInput): AchievementUnlockState[] {
  const { myPets, totalPosts, maxFollowers, hostedMeetupsCount, vaccinations, foundReportsCount } = input;

  return ACHIEVEMENTS.map((def) => {
    let unlocked = false;
    let progress: AchievementUnlockState['progress'] | undefined;

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
      case 'avatar_artist': {
        // Pelo menos 1 pet com customização Pro
        const hasProCustomization = myPets.some((p) => {
          const c = p.avatar_config;
          if (!c) return false;
          return (
            !!c.collar_charm ||
            !!c.background_scene ||
            !!c.hair_accent ||
            !!c.eye_color_right
          );
        });
        unlocked = hasProCustomization;
        if (!unlocked) progress = { current: 0, target: 1 };
        break;
      }
      case 'scene_traveler': {
        // 2+ pets distintos com background_scene definido (qualquer)
        const petsWithScene = myPets.filter((p) => !!p.avatar_config?.background_scene).length;
        unlocked = petsWithScene >= 2;
        progress = { current: Math.min(petsWithScene, 2), target: 2 };
        break;
      }
      case 'bling_master': {
        // Pet com coleira gold + qualquer collar_charm
        const hasBling = myPets.some((p) => {
          const c = p.avatar_config;
          return c?.collar === 'gold' && c?.collar_charm && c.collar_charm !== 'none';
        });
        unlocked = hasBling;
        if (!unlocked) progress = { current: 0, target: 1 };
        break;
      }
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
