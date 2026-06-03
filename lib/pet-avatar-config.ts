/**
 * Catálogo de configs prontas + paletas + defaults pro Pet Avatar customizado.
 * Todas as listas aqui são "fontes da verdade" reusadas pelo customizer e
 * pelos pickers de cores.
 */

import type {
  AvatarAccessory,
  AvatarBackgroundScene,
  AvatarChest,
  AvatarCollar,
  AvatarCollarCharm,
  AvatarEars,
  AvatarEyes,
  AvatarHairAccent,
  AvatarHeadShape,
  AvatarMouth,
  AvatarPattern,
  AvatarSizeMod,
  AvatarSpecies,
  AvatarTail,
  PetAvatarConfig,
} from './types';

// ============================================================================
// Paletas de cores
// ============================================================================

export const FUR_COLORS = [
  // Tons naturais
  '#FFFFFF', '#F5F5F4', '#D6D3D1', '#A8A29E', '#78716C', '#404040', '#1A1410',
  // Marrons / caramelos
  '#FEE2C5', '#FCD9B6', '#E9B587', '#C18454', '#92561F', '#5C3317',
  // Dourados / amarelados
  '#FEF3C7', '#FBBF24', '#D97706',
  // Acinzentados (gato cinza)
  '#E5E5E5', '#A3A3A3', '#737373',
  // Fantasia (porque por que não)
  '#FCE7F3', '#FBA9CC', '#C084FC', '#7DD3FC', '#86EFAC',
];

export const ACCENT_COLORS = [
  '#FFFFFF', '#1A1410', '#404040', '#78716C',
  '#FEE2C5', '#92561F', '#5C3317',
  '#FBBF24', '#F97316', '#EF4444',
  '#FCE7F3', '#A855F7', '#7DD3FC',
];

export const EYE_COLORS = [
  '#1A1410', // preto
  '#5C3317', // marrom escuro
  '#92561F', // marrom claro
  '#10B981', // verde
  '#3B82F6', // azul
  '#F59E0B', // âmbar
  '#A855F7', // roxo (heterocromia/fantasia)
];

export const NOSE_COLORS = [
  '#1A1410', // preto comum
  '#78716C', // cinza
  '#FBA9CC', // rosinha
  '#92561F', // marrom
];

export const BACKGROUND_COLORS = [
  '#FFEDD5', '#FED7AA', '#FBBF24', // warm
  '#FCE7F3', '#FBA9CC',             // pink
  '#DBEAFE', '#7DD3FC',             // blue
  '#DCFCE7', '#86EFAC',             // green
  '#F3E8FF', '#C084FC',             // purple
  '#FEF3C7', '#F5F5F4',             // pastel neutros
];

// ============================================================================
// Opções com label + emoji para o customizer
// ============================================================================

interface OptionMeta<T extends string> {
  value: T;
  label: string;
}

export const SPECIES_OPTIONS: OptionMeta<AvatarSpecies>[] = [
  { value: 'dog', label: 'Cachorro' },
  { value: 'cat', label: 'Gato' },
  { value: 'rabbit', label: 'Coelho' },
  { value: 'bird', label: 'Pássaro' },
  { value: 'fish', label: 'Peixe' },
  { value: 'other', label: 'Outro' },
];

export const HEAD_SHAPE_OPTIONS: OptionMeta<AvatarHeadShape>[] = [
  { value: 'round', label: 'Redonda' },
  { value: 'oval', label: 'Oval' },
  { value: 'wide', label: 'Larga' },
  { value: 'long', label: 'Comprida' },
  { value: 'square', label: 'Quadrada' },
  { value: 'egg', label: 'Oval longa' },
];

export const EARS_OPTIONS: OptionMeta<AvatarEars>[] = [
  { value: 'pointed_up', label: 'Pontudas em pé' },
  { value: 'pointed_side', label: 'Pontudas pro lado' },
  { value: 'droopy', label: 'Caídas curtas' },
  { value: 'long_droopy', label: 'Caídas longas' },
  { value: 'round', label: 'Redondas' },
  { value: 'tall_round', label: 'Redondas altas' },
  { value: 'tiny', label: 'Mini' },
  { value: 'bat', label: 'Morcego' },
  { value: 'fluffy_down', label: 'Peludas pendentes' },
  { value: 'cropped', label: 'Cortadinhas' },
  { value: 'none', label: 'Sem orelhas' },
];

export const EYES_OPTIONS: OptionMeta<AvatarEyes>[] = [
  { value: 'round', label: 'Redondos' },
  { value: 'oval', label: 'Ovais' },
  { value: 'sleepy', label: 'Soninho' },
  { value: 'happy', label: 'Felizes ^_^' },
  { value: 'wink', label: 'Piscadinha' },
  { value: 'sparkle', label: 'Brilho ✨' },
  { value: 'heart', label: 'Coraçãozinhos' },
  { value: 'wide', label: 'Surpresos' },
];

export const MOUTH_OPTIONS: OptionMeta<AvatarMouth>[] = [
  { value: 'smile', label: 'Sorriso' },
  { value: 'neutral', label: 'Neutra' },
  { value: 'tongue_side', label: 'Língua de lado' },
  { value: 'tongue_open', label: 'Boca aberta + língua' },
  { value: 'open', label: 'Arfando' },
  { value: 'tiny', label: 'Boquinha' },
  { value: 'kiss', label: 'Beijinho' },
];

export const PATTERN_OPTIONS: OptionMeta<AvatarPattern>[] = [
  { value: 'solid', label: 'Liso' },
  { value: 'spots', label: 'Pintas' },
  { value: 'patches', label: 'Manchas' },
  { value: 'stripes', label: 'Listrado' },
  { value: 'mask', label: 'Máscara' },
  { value: 'belly', label: 'Ventre claro' },
  { value: 'tuxedo', label: 'Smoking' },
  { value: 'wrinkles', label: 'Rugas' },
  { value: 'long_hair', label: 'Cabelo longo' },
  { value: 'mane', label: 'Juba peluda' },
  { value: 'tricolor', label: 'Tricolor' },
  { value: 'saddle', label: 'Manto' },
];

export const ACCESSORY_OPTIONS: OptionMeta<AvatarAccessory>[] = [
  { value: 'none', label: 'Nada' },
  { value: 'bow', label: 'Lacinho' },
  { value: 'top_hat', label: 'Cartola' },
  { value: 'cap', label: 'Boné' },
  { value: 'glasses', label: 'Óculos' },
  { value: 'sunglasses', label: 'Óculos de sol' },
  { value: 'bandana', label: 'Bandana' },
  { value: 'crown', label: 'Coroa' },
  { value: 'flower', label: 'Florzinha' },
];

export const COLLAR_OPTIONS: OptionMeta<AvatarCollar>[] = [
  { value: 'none', label: 'Sem coleira' },
  { value: 'red', label: 'Vermelha' },
  { value: 'pink', label: 'Rosa' },
  { value: 'blue', label: 'Azul' },
  { value: 'gold', label: 'Dourada' },
  { value: 'rainbow', label: 'Arco-íris' },
];

export const COLLAR_CHARM_OPTIONS: OptionMeta<AvatarCollarCharm>[] = [
  { value: 'none', label: 'Sem pingente' },
  { value: 'bell', label: 'Sininho' },
  { value: 'tag', label: 'Plaquinha' },
  { value: 'heart', label: 'Coração' },
  { value: 'bone', label: 'Ossinho' },
  { value: 'star', label: 'Estrela' },
  { value: 'diamond', label: 'Diamante' },
  { value: 'paw', label: 'Patinha' },
];

export const CHEST_OPTIONS: OptionMeta<AvatarChest>[] = [
  { value: 'none', label: 'Sem peito' },
  { value: 'solid', label: 'Mesma cor' },
  { value: 'white', label: 'Branco' },
  { value: 'cream', label: 'Creme' },
  { value: 'spotted', label: 'Pintado' },
  { value: 'fluffy', label: 'Peludo' },
];

export const TAIL_OPTIONS: OptionMeta<AvatarTail>[] = [
  { value: 'none', label: 'Sem rabo' },
  { value: 'bushy', label: 'Bem peludo' },
  { value: 'curly', label: 'Enrolado' },
  { value: 'long', label: 'Longo' },
  { value: 'pointed', label: 'Fino' },
  { value: 'cropped', label: 'Cortado' },
];

export const HAIR_ACCENT_OPTIONS: OptionMeta<AvatarHairAccent | 'none'>[] = [
  { value: 'none', label: 'Sem' },
  { value: 'topknot', label: 'Topete c/ laço' },
  { value: 'fringe', label: 'Franja' },
  { value: 'parted', label: 'Repartido' },
  { value: 'shaggy', label: 'Tufos' },
];

export const BACKGROUND_SCENE_OPTIONS: { value: AvatarBackgroundScene | 'none'; label: string; emoji: string }[] = [
  { value: 'none', label: 'Cor sólida', emoji: '⬜' },
  { value: 'park', label: 'Parque', emoji: '🌳' },
  { value: 'beach', label: 'Praia', emoji: '🏖️' },
  { value: 'night', label: 'Noite', emoji: '🌙' },
  { value: 'birthday', label: 'Festa', emoji: '🎉' },
  { value: 'snow', label: 'Neve', emoji: '❄️' },
  { value: 'sunset', label: 'Pôr-do-sol', emoji: '🌅' },
];

export const SIZE_MOD_OPTIONS: { value: AvatarSizeMod; label: string; emoji: string }[] = [
  { value: 0.85, label: 'Mini', emoji: '🤏' },
  { value: 0.92, label: 'Pequeno', emoji: '🐾' },
  { value: 1.0, label: 'Médio', emoji: '🐶' },
  { value: 1.08, label: 'Grande', emoji: '🐕' },
  { value: 1.15, label: 'Gigante', emoji: '🦣' },
];

export const COLLAR_HEX: Record<AvatarCollar, string> = {
  none: 'transparent',
  red: '#EF4444',
  pink: '#EC4899',
  blue: '#3B82F6',
  gold: '#FBBF24',
  rainbow: '#A855F7', // base, com listras
};

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_AVATAR_CONFIG: PetAvatarConfig = {
  species: 'dog',
  head_shape: 'round',
  ears: 'droopy',
  eyes: 'round',
  mouth: 'smile',
  pattern: 'solid',
  fur_color: '#E9B587',
  accent_color: '#FFFFFF',
  eye_color: '#1A1410',
  nose_color: '#1A1410',
  collar: 'red',
  accessory: 'none',
  background_color: '#FFEDD5',
};

/**
 * Default smart por espécie — dá um ponto de partida bonito.
 */
export function defaultConfigForSpecies(species: AvatarSpecies): PetAvatarConfig {
  switch (species) {
    case 'cat':
      return {
        ...DEFAULT_AVATAR_CONFIG,
        species: 'cat',
        head_shape: 'oval',
        ears: 'pointed_up',
        eyes: 'oval',
        mouth: 'tiny',
        pattern: 'stripes',
        fur_color: '#FEE2C5',
        accent_color: '#92561F',
        eye_color: '#10B981',
        nose_color: '#FBA9CC',
        collar: 'none',
        background_color: '#FCE7F3',
      };
    case 'rabbit':
      return {
        ...DEFAULT_AVATAR_CONFIG,
        species: 'rabbit',
        head_shape: 'round',
        ears: 'tall_round',
        eyes: 'round',
        mouth: 'tiny',
        pattern: 'belly',
        fur_color: '#F5F5F4',
        accent_color: '#FFFFFF',
        eye_color: '#5C3317',
        nose_color: '#FBA9CC',
        collar: 'pink',
        background_color: '#DCFCE7',
      };
    case 'bird':
      return {
        ...DEFAULT_AVATAR_CONFIG,
        species: 'bird',
        head_shape: 'round',
        ears: 'none',
        eyes: 'round',
        mouth: 'tiny',
        pattern: 'solid',
        fur_color: '#FBBF24',
        accent_color: '#F97316',
        eye_color: '#1A1410',
        nose_color: '#F97316',
        collar: 'none',
        background_color: '#DBEAFE',
      };
    case 'fish':
      return {
        ...DEFAULT_AVATAR_CONFIG,
        species: 'fish',
        head_shape: 'oval',
        ears: 'none',
        eyes: 'round',
        mouth: 'tiny',
        pattern: 'stripes',
        fur_color: '#F97316',
        accent_color: '#FFFFFF',
        eye_color: '#1A1410',
        nose_color: '#1A1410',
        collar: 'none',
        background_color: '#DBEAFE',
      };
    case 'dog':
    default:
      return { ...DEFAULT_AVATAR_CONFIG, species };
  }
}

// ============================================================================
// Presets — "skins" prontas pra escolha rápida
// ============================================================================

export interface AvatarPreset {
  slug: string;
  name: string;
  emoji: string;
  config: PetAvatarConfig;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  // ============================================================
  // CACHORROS — Top 20 raças mais comuns no Brasil
  // ============================================================

  // 1. SRD / Vira-lata caramelo (raça mais comum do Brasil)
  {
    slug: 'caramelo',
    name: 'Caramelo (SRD)',
    emoji: '🐕',
    config: {
      species: 'dog', head_shape: 'oval', ears: 'droopy', eyes: 'happy',
      mouth: 'tongue_side', pattern: 'belly',
      fur_color: '#C18454', accent_color: '#FCD9B6',
      eye_color: '#5C3317', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FFEDD5',
      chest: 'cream', tail: 'long', size_mod: 1.0,
    },
  },
  // 2. Golden Retriever
  {
    slug: 'golden',
    name: 'Golden Retriever',
    emoji: '🐕',
    config: {
      species: 'dog', head_shape: 'oval', ears: 'droopy', eyes: 'happy',
      mouth: 'tongue_side', pattern: 'solid',
      fur_color: '#FCD9B6', accent_color: '#E9B587',
      eye_color: '#5C3317', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FFEDD5',
      chest: 'solid', tail: 'long', size_mod: 1.08,
    },
  },
  // 3. Labrador
  {
    slug: 'labrador',
    name: 'Labrador',
    emoji: '🐕',
    config: {
      species: 'dog', head_shape: 'wide', ears: 'droopy', eyes: 'happy',
      mouth: 'tongue_side', pattern: 'solid',
      fur_color: '#1A1410', accent_color: '#404040',
      eye_color: '#92561F', nose_color: '#1A1410',
      collar: 'blue', accessory: 'none', background_color: '#FED7AA',
      chest: 'solid', tail: 'long', size_mod: 1.08,
    },
  },
  // 4. Shih Tzu
  {
    slug: 'shih-tzu',
    name: 'Shih Tzu',
    emoji: '🐶',
    config: {
      species: 'dog', head_shape: 'round', ears: 'fluffy_down', eyes: 'round',
      mouth: 'tiny', pattern: 'long_hair',
      fur_color: '#FEE2C5', accent_color: '#C18454',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'pink', accessory: 'bow', background_color: '#FCE7F3',
      chest: 'fluffy', tail: 'curly', size_mod: 0.92,
      hair_accent: 'fringe',
    },
  },
  // 5. Poodle (toy)
  {
    slug: 'poodle',
    name: 'Poodle',
    emoji: '🐩',
    config: {
      species: 'dog', head_shape: 'round', ears: 'fluffy_down', eyes: 'sparkle',
      mouth: 'tiny', pattern: 'mane',
      fur_color: '#5C3317', accent_color: '#92561F',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'pink', accessory: 'bow', background_color: '#F3E8FF',
      chest: 'fluffy', tail: 'pointed', size_mod: 0.92,
    },
  },
  // 6. Pug
  {
    slug: 'pug',
    name: 'Pug',
    emoji: '🐶',
    config: {
      species: 'dog', head_shape: 'round', ears: 'tiny', eyes: 'wide',
      mouth: 'tongue_open', pattern: 'wrinkles',
      fur_color: '#FCD9B6', accent_color: '#1A1410',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'pink', accessory: 'none', background_color: '#FCE7F3',
      chest: 'solid', tail: 'curly', size_mod: 0.92,
    },
  },
  // 7. Bulldog Francês
  {
    slug: 'bulldog-frances',
    name: 'Bulldog Francês',
    emoji: '🐶',
    config: {
      species: 'dog', head_shape: 'square', ears: 'bat', eyes: 'wide',
      mouth: 'tiny', pattern: 'wrinkles',
      fur_color: '#D6D3D1', accent_color: '#F5F5F4',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FED7AA',
      chest: 'white', tail: 'cropped', size_mod: 0.95,
    },
  },
  // 8. Yorkshire
  {
    slug: 'yorkshire',
    name: 'Yorkshire',
    emoji: '🐶',
    config: {
      species: 'dog', head_shape: 'round', ears: 'pointed_side', eyes: 'sparkle',
      mouth: 'tiny', pattern: 'long_hair',
      fur_color: '#5C3317', accent_color: '#FCD9B6',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'pink', accessory: 'none', background_color: '#F3E8FF',
      chest: 'cream', tail: 'long', size_mod: 0.85,
      hair_accent: 'topknot',
    },
  },
  // 9. Maltês
  {
    slug: 'maltes',
    name: 'Maltês',
    emoji: '🐶',
    config: {
      species: 'dog', head_shape: 'round', ears: 'fluffy_down', eyes: 'round',
      mouth: 'tiny', pattern: 'long_hair',
      fur_color: '#FFFFFF', accent_color: '#F5F5F4',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'pink', accessory: 'flower', background_color: '#FCE7F3',
      chest: 'fluffy', tail: 'long', size_mod: 0.85,
      hair_accent: 'parted',
    },
  },
  // 10. Pinscher
  {
    slug: 'pinscher',
    name: 'Pinscher',
    emoji: '🐕',
    config: {
      species: 'dog', head_shape: 'long', ears: 'cropped', eyes: 'oval',
      mouth: 'neutral', pattern: 'belly',
      fur_color: '#1A1410', accent_color: '#C18454',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FED7AA',
      chest: 'solid', tail: 'cropped', size_mod: 0.85,
    },
  },
  // 11. Beagle
  {
    slug: 'beagle',
    name: 'Beagle',
    emoji: '🐶',
    config: {
      species: 'dog', head_shape: 'oval', ears: 'long_droopy', eyes: 'happy',
      mouth: 'smile', pattern: 'tricolor',
      fur_color: '#FFFFFF', accent_color: '#92561F',
      eye_color: '#5C3317', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FFEDD5',
      chest: 'white', tail: 'long', size_mod: 0.95,
    },
  },
  // 12. Husky
  {
    slug: 'husky',
    name: 'Husky Siberiano',
    emoji: '🐺',
    config: {
      species: 'dog', head_shape: 'wide', ears: 'pointed_up', eyes: 'round',
      mouth: 'smile', pattern: 'mask',
      fur_color: '#FFFFFF', accent_color: '#404040',
      eye_color: '#3B82F6', nose_color: '#1A1410',
      collar: 'none', accessory: 'none', background_color: '#DBEAFE',
      chest: 'white', tail: 'bushy', size_mod: 1.08,
    },
  },
  // 13. Pastor Alemão
  {
    slug: 'pastor-alemao',
    name: 'Pastor Alemão',
    emoji: '🐕‍🦺',
    config: {
      species: 'dog', head_shape: 'long', ears: 'pointed_up', eyes: 'oval',
      mouth: 'neutral', pattern: 'saddle',
      fur_color: '#C18454', accent_color: '#1A1410',
      eye_color: '#5C3317', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FED7AA',
      chest: 'solid', tail: 'bushy', size_mod: 1.15,
    },
  },
  // 14. Border Collie
  {
    slug: 'border',
    name: 'Border Collie',
    emoji: '🐶',
    config: {
      species: 'dog', head_shape: 'oval', ears: 'pointed_side', eyes: 'sparkle',
      mouth: 'smile', pattern: 'tuxedo',
      fur_color: '#1A1410', accent_color: '#FFFFFF',
      eye_color: '#3B82F6', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#DBEAFE',
      chest: 'white', tail: 'long', size_mod: 1.0,
      hair_accent: 'shaggy',
    },
  },
  // 15. Rottweiler
  {
    slug: 'rottweiler',
    name: 'Rottweiler',
    emoji: '🐕',
    config: {
      species: 'dog', head_shape: 'square', ears: 'droopy', eyes: 'oval',
      mouth: 'neutral', pattern: 'belly',
      fur_color: '#1A1410', accent_color: '#92561F',
      eye_color: '#5C3317', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FED7AA',
      chest: 'solid', tail: 'cropped', size_mod: 1.15,
    },
  },
  // 16. Dachshund (Salsicha)
  {
    slug: 'dachshund',
    name: 'Dachshund',
    emoji: '🌭',
    config: {
      species: 'dog', head_shape: 'long', ears: 'long_droopy', eyes: 'happy',
      mouth: 'tongue_side', pattern: 'solid',
      fur_color: '#92561F', accent_color: '#5C3317',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FFEDD5',
      chest: 'solid', tail: 'long', size_mod: 0.9,
    },
  },
  // 17. Chow Chow
  {
    slug: 'chow-chow',
    name: 'Chow Chow',
    emoji: '🦁',
    config: {
      species: 'dog', head_shape: 'round', ears: 'tiny', eyes: 'sleepy',
      mouth: 'tiny', pattern: 'mane',
      fur_color: '#E9B587', accent_color: '#C18454',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'gold', accessory: 'none', background_color: '#FED7AA',
      chest: 'fluffy', tail: 'curly', size_mod: 1.0,
    },
  },
  // 18. Bull Terrier
  {
    slug: 'bull-terrier',
    name: 'Bull Terrier',
    emoji: '🐶',
    config: {
      species: 'dog', head_shape: 'egg', ears: 'pointed_up', eyes: 'oval',
      mouth: 'neutral', pattern: 'mask',
      fur_color: '#FFFFFF', accent_color: '#92561F',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FFEDD5',
      chest: 'white', tail: 'pointed', size_mod: 1.0,
    },
  },
  // 19. Spitz Alemão / Pomerânia
  {
    slug: 'pomerania',
    name: 'Pomerânia',
    emoji: '🦊',
    config: {
      species: 'dog', head_shape: 'round', ears: 'pointed_up', eyes: 'sparkle',
      mouth: 'smile', pattern: 'mane',
      fur_color: '#F97316', accent_color: '#FBBF24',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'pink', accessory: 'bow', background_color: '#FFEDD5',
      chest: 'fluffy', tail: 'curly', size_mod: 0.85,
    },
  },
  // 20. Chihuahua
  {
    slug: 'chihuahua',
    name: 'Chihuahua',
    emoji: '🐕',
    config: {
      species: 'dog', head_shape: 'round', ears: 'bat', eyes: 'wide',
      mouth: 'tiny', pattern: 'solid',
      fur_color: '#FCD9B6', accent_color: '#FFFFFF',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'pink', accessory: 'flower', background_color: '#FCE7F3',
      chest: 'cream', tail: 'pointed', size_mod: 0.85,
    },
  },
  // 21. Boxer
  {
    slug: 'boxer',
    name: 'Boxer',
    emoji: '🐶',
    config: {
      species: 'dog', head_shape: 'square', ears: 'droopy', eyes: 'happy',
      mouth: 'tongue_side', pattern: 'stripes',
      fur_color: '#E9B587', accent_color: '#FFFFFF',
      eye_color: '#5C3317', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FED7AA',
      chest: 'white', tail: 'cropped', size_mod: 1.08,
    },
  },
  // 22. Doberman
  {
    slug: 'doberman',
    name: 'Doberman',
    emoji: '🐕',
    config: {
      species: 'dog', head_shape: 'long', ears: 'cropped', eyes: 'oval',
      mouth: 'neutral', pattern: 'belly',
      fur_color: '#1A1410', accent_color: '#92561F',
      eye_color: '#5C3317', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FED7AA',
      chest: 'solid', tail: 'pointed', size_mod: 1.15,
    },
  },
  // 23. Cocker Spaniel
  {
    slug: 'cocker',
    name: 'Cocker Spaniel',
    emoji: '🐶',
    config: {
      species: 'dog', head_shape: 'oval', ears: 'long_droopy', eyes: 'sleepy',
      mouth: 'tiny', pattern: 'solid',
      fur_color: '#FCD9B6', accent_color: '#E9B587',
      eye_color: '#5C3317', nose_color: '#1A1410',
      collar: 'pink', accessory: 'none', background_color: '#FFEDD5',
      chest: 'solid', tail: 'long', size_mod: 0.95,
    },
  },
  // 24. Dálmata
  {
    slug: 'dalmatian',
    name: 'Dálmata',
    emoji: '🐕‍🦺',
    config: {
      species: 'dog', head_shape: 'long', ears: 'droopy', eyes: 'round',
      mouth: 'smile', pattern: 'spots',
      fur_color: '#FFFFFF', accent_color: '#1A1410',
      eye_color: '#5C3317', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#DBEAFE',
      chest: 'spotted', tail: 'long', size_mod: 1.05,
    },
  },
  // 25. Shiba Inu
  {
    slug: 'shiba',
    name: 'Shiba Inu',
    emoji: '🦊',
    config: {
      species: 'dog', head_shape: 'wide', ears: 'pointed_up', eyes: 'sleepy',
      mouth: 'smile', pattern: 'mask',
      fur_color: '#E9B587', accent_color: '#FFFFFF',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'blue', accessory: 'none', background_color: '#FED7AA',
      chest: 'white', tail: 'curly', size_mod: 0.95,
    },
  },
  // 26. Schnauzer
  {
    slug: 'schnauzer',
    name: 'Schnauzer',
    emoji: '🐶',
    config: {
      species: 'dog', head_shape: 'long', ears: 'cropped', eyes: 'oval',
      mouth: 'tiny', pattern: 'wrinkles',
      fur_color: '#78716C', accent_color: '#F5F5F4',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#F5F5F4',
      chest: 'solid', tail: 'cropped', size_mod: 0.95,
    },
  },
  // 27. Pitbull
  {
    slug: 'pitbull',
    name: 'Pitbull',
    emoji: '🐕',
    config: {
      species: 'dog', head_shape: 'wide', ears: 'pointed_side', eyes: 'oval',
      mouth: 'tongue_open', pattern: 'belly',
      fur_color: '#FCD9B6', accent_color: '#FFFFFF',
      eye_color: '#92561F', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FED7AA',
      chest: 'white', tail: 'pointed', size_mod: 1.08,
    },
  },
  // 28. Lhasa Apso
  {
    slug: 'lhasa',
    name: 'Lhasa Apso',
    emoji: '🐶',
    config: {
      species: 'dog', head_shape: 'round', ears: 'fluffy_down', eyes: 'round',
      mouth: 'tiny', pattern: 'long_hair',
      fur_color: '#FCD9B6', accent_color: '#92561F',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'pink', accessory: 'bow', background_color: '#FCE7F3',
      chest: 'fluffy', tail: 'curly', size_mod: 0.9,
      hair_accent: 'fringe',
    },
  },
  // 29. Bichon Frisé
  {
    slug: 'bichon',
    name: 'Bichon Frisé',
    emoji: '🐶',
    config: {
      species: 'dog', head_shape: 'round', ears: 'fluffy_down', eyes: 'round',
      mouth: 'tiny', pattern: 'mane',
      fur_color: '#FFFFFF', accent_color: '#F5F5F4',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'pink', accessory: 'flower', background_color: '#F3E8FF',
      chest: 'fluffy', tail: 'curly', size_mod: 0.9,
      hair_accent: 'shaggy',
    },
  },
  // 30. Akita
  {
    slug: 'akita',
    name: 'Akita',
    emoji: '🐺',
    config: {
      species: 'dog', head_shape: 'wide', ears: 'pointed_up', eyes: 'oval',
      mouth: 'neutral', pattern: 'mask',
      fur_color: '#FCD9B6', accent_color: '#FFFFFF',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FFEDD5',
      chest: 'white', tail: 'curly', size_mod: 1.08,
    },
  },
  // 31. Cane Corso
  {
    slug: 'cane-corso',
    name: 'Cane Corso',
    emoji: '🐕',
    config: {
      species: 'dog', head_shape: 'square', ears: 'cropped', eyes: 'oval',
      mouth: 'neutral', pattern: 'solid',
      fur_color: '#404040', accent_color: '#1A1410',
      eye_color: '#92561F', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FED7AA',
      chest: 'solid', tail: 'cropped', size_mod: 1.15,
    },
  },
  // 32. Pastor de Shetland (Mini Collie)
  {
    slug: 'sheltie',
    name: 'Pastor Shetland',
    emoji: '🐶',
    config: {
      species: 'dog', head_shape: 'oval', ears: 'pointed_side', eyes: 'happy',
      mouth: 'smile', pattern: 'mane',
      fur_color: '#C18454', accent_color: '#FFFFFF',
      eye_color: '#5C3317', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#FFEDD5',
      chest: 'white', tail: 'long', size_mod: 0.95,
      hair_accent: 'shaggy',
    },
  },
  // 33. Old English Sheepdog
  {
    slug: 'old-english',
    name: 'Old English Sheepdog',
    emoji: '🐑',
    config: {
      species: 'dog', head_shape: 'round', ears: 'fluffy_down', eyes: 'round',
      mouth: 'tongue_side', pattern: 'long_hair',
      fur_color: '#F5F5F4', accent_color: '#A8A29E',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'blue', accessory: 'none', background_color: '#DBEAFE',
      chest: 'fluffy', tail: 'bushy', size_mod: 1.08,
      hair_accent: 'fringe',
    },
  },
  // 34. São Bernardo
  {
    slug: 'sao-bernardo',
    name: 'São Bernardo',
    emoji: '🐕',
    config: {
      species: 'dog', head_shape: 'square', ears: 'droopy', eyes: 'sleepy',
      mouth: 'tongue_side', pattern: 'saddle',
      fur_color: '#FFFFFF', accent_color: '#92561F',
      eye_color: '#5C3317', nose_color: '#1A1410',
      collar: 'red', accessory: 'none', background_color: '#DBEAFE',
      chest: 'white', tail: 'bushy', size_mod: 1.15,
    },
  },

  // ============================================================
  // GATOS — top raças no Brasil
  // ============================================================

  // 1. SRD / Tricolor
  {
    slug: 'gato-tricolor',
    name: 'Tricolor (SRD)',
    emoji: '🐈',
    config: {
      species: 'cat', head_shape: 'oval', ears: 'pointed_up', eyes: 'sparkle',
      mouth: 'tiny', pattern: 'patches',
      fur_color: '#FCD9B6', accent_color: '#1A1410',
      eye_color: '#F59E0B', nose_color: '#FBA9CC',
      collar: 'pink', accessory: 'flower', background_color: '#FCE7F3',
      chest: 'white', tail: 'long', size_mod: 0.92,
    },
  },
  // 2. Persa
  {
    slug: 'persa',
    name: 'Persa',
    emoji: '🐱',
    config: {
      species: 'cat', head_shape: 'round', ears: 'tiny', eyes: 'sleepy',
      mouth: 'tiny', pattern: 'long_hair',
      fur_color: '#F5F5F4', accent_color: '#D6D3D1',
      eye_color: '#F59E0B', nose_color: '#FBA9CC',
      collar: 'pink', accessory: 'crown', background_color: '#F3E8FF',
      chest: 'fluffy', tail: 'bushy', size_mod: 0.95,
    },
  },
  // 3. Siamês
  {
    slug: 'siames',
    name: 'Siamês',
    emoji: '🐈',
    config: {
      species: 'cat', head_shape: 'long', ears: 'pointed_up', eyes: 'oval',
      mouth: 'tiny', pattern: 'mask',
      fur_color: '#FEE2C5', accent_color: '#92561F',
      eye_color: '#3B82F6', nose_color: '#1A1410',
      collar: 'none', accessory: 'none', background_color: '#DBEAFE',
      chest: 'cream', tail: 'pointed', size_mod: 0.92,
    },
  },
  // 4. Maine Coon
  {
    slug: 'maine-coon',
    name: 'Maine Coon',
    emoji: '🐈',
    config: {
      species: 'cat', head_shape: 'square', ears: 'pointed_up', eyes: 'oval',
      mouth: 'tiny', pattern: 'mane',
      fur_color: '#92561F', accent_color: '#5C3317',
      eye_color: '#10B981', nose_color: '#FBA9CC',
      collar: 'none', accessory: 'none', background_color: '#FED7AA',
      chest: 'fluffy', tail: 'bushy', size_mod: 1.05,
    },
  },
  // 5. Tigrado (tabby)
  {
    slug: 'gato-tigrado',
    name: 'Tigrado',
    emoji: '🐅',
    config: {
      species: 'cat', head_shape: 'oval', ears: 'pointed_up', eyes: 'happy',
      mouth: 'tiny', pattern: 'stripes',
      fur_color: '#E9B587', accent_color: '#5C3317',
      eye_color: '#10B981', nose_color: '#FBA9CC',
      collar: 'red', accessory: 'none', background_color: '#FFEDD5',
      chest: 'solid', tail: 'long', size_mod: 0.92,
    },
  },
  // 6. Preto
  {
    slug: 'gato-preto',
    name: 'Gato Preto',
    emoji: '🐈‍⬛',
    config: {
      species: 'cat', head_shape: 'oval', ears: 'pointed_up', eyes: 'oval',
      mouth: 'tiny', pattern: 'solid',
      fur_color: '#1A1410', accent_color: '#404040',
      eye_color: '#10B981', nose_color: '#FBA9CC',
      collar: 'gold', accessory: 'none', background_color: '#F3E8FF',
      chest: 'solid', tail: 'long', size_mod: 0.92,
    },
  },
  // 7. Sphynx
  {
    slug: 'sphynx',
    name: 'Sphynx',
    emoji: '🐈',
    config: {
      species: 'cat', head_shape: 'long', ears: 'bat', eyes: 'wide',
      mouth: 'tiny', pattern: 'wrinkles',
      fur_color: '#FCD9B6', accent_color: '#FBA9CC',
      eye_color: '#10B981', nose_color: '#FBA9CC',
      collar: 'gold', accessory: 'none', background_color: '#FCE7F3',
      // Gato sem pelo → sem peito visível, rabo fino
      chest: 'none', tail: 'pointed', size_mod: 0.88,
    },
  },
  // 8. Ragdoll
  {
    slug: 'ragdoll',
    name: 'Ragdoll',
    emoji: '🐈',
    config: {
      species: 'cat', head_shape: 'round', ears: 'pointed_up', eyes: 'sleepy',
      mouth: 'tiny', pattern: 'mask',
      fur_color: '#FFFFFF', accent_color: '#C18454',
      eye_color: '#3B82F6', nose_color: '#FBA9CC',
      collar: 'pink', accessory: 'bow', background_color: '#FCE7F3',
      chest: 'fluffy', tail: 'bushy', size_mod: 1.0,
    },
  },
  // 9. Bengal
  {
    slug: 'bengal',
    name: 'Bengal',
    emoji: '🐈',
    config: {
      species: 'cat', head_shape: 'oval', ears: 'pointed_up', eyes: 'sparkle',
      mouth: 'tiny', pattern: 'spots',
      fur_color: '#FCD9B6', accent_color: '#5C3317',
      eye_color: '#10B981', nose_color: '#FBA9CC',
      collar: 'none', accessory: 'none', background_color: '#FED7AA',
      chest: 'spotted', tail: 'long', size_mod: 1.0,
    },
  },
  // 10. Angorá
  {
    slug: 'angora',
    name: 'Angorá',
    emoji: '🐈',
    config: {
      species: 'cat', head_shape: 'oval', ears: 'pointed_up', eyes: 'sparkle',
      mouth: 'tiny', pattern: 'long_hair',
      fur_color: '#FFFFFF', accent_color: '#F5F5F4',
      eye_color: '#A855F7', nose_color: '#FBA9CC',
      collar: 'pink', accessory: 'crown', background_color: '#F3E8FF',
      chest: 'fluffy', tail: 'bushy', size_mod: 0.92,
    },
  },

  // ============================================================
  // COELHOS · PÁSSAROS · PEIXES
  // ============================================================
  {
    slug: 'coelho-branco',
    name: 'Coelho Branco',
    emoji: '🐰',
    config: {
      species: 'rabbit', head_shape: 'round', ears: 'tall_round', eyes: 'round',
      mouth: 'tiny', pattern: 'belly',
      fur_color: '#FFFFFF', accent_color: '#F5F5F4',
      eye_color: '#5C3317', nose_color: '#FBA9CC',
      collar: 'pink', accessory: 'flower', background_color: '#DCFCE7',
      chest: 'white', tail: 'bushy', size_mod: 0.92,
    },
  },
  {
    slug: 'coelho-marrom',
    name: 'Coelho Caramelo',
    emoji: '🐇',
    config: {
      species: 'rabbit', head_shape: 'round', ears: 'tall_round', eyes: 'sparkle',
      mouth: 'tiny', pattern: 'belly',
      fur_color: '#C18454', accent_color: '#FCD9B6',
      eye_color: '#1A1410', nose_color: '#FBA9CC',
      collar: 'none', accessory: 'bow', background_color: '#FFEDD5',
      chest: 'cream', tail: 'bushy', size_mod: 0.92,
    },
  },
  {
    slug: 'canario',
    name: 'Canário',
    emoji: '🐤',
    config: {
      species: 'bird', head_shape: 'round', ears: 'none', eyes: 'round',
      mouth: 'tiny', pattern: 'solid',
      fur_color: '#FBBF24', accent_color: '#F97316',
      eye_color: '#1A1410', nose_color: '#F97316',
      collar: 'none', accessory: 'none', background_color: '#DBEAFE',
      chest: 'solid', tail: 'none', size_mod: 0.85,
    },
  },
  {
    slug: 'arara',
    name: 'Arara',
    emoji: '🦜',
    config: {
      species: 'bird', head_shape: 'oval', ears: 'none', eyes: 'sparkle',
      mouth: 'tiny', pattern: 'patches',
      fur_color: '#3B82F6', accent_color: '#FBBF24',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'none', accessory: 'none', background_color: '#DCFCE7',
      chest: 'solid', tail: 'none', size_mod: 1.0,
    },
  },
  {
    slug: 'beta',
    name: 'Betta',
    emoji: '🐠',
    config: {
      species: 'fish', head_shape: 'oval', ears: 'none', eyes: 'sparkle',
      mouth: 'tiny', pattern: 'stripes',
      fur_color: '#A855F7', accent_color: '#3B82F6',
      eye_color: '#1A1410', nose_color: '#1A1410',
      collar: 'none', accessory: 'none', background_color: '#DBEAFE',
      chest: 'none', tail: 'none', size_mod: 0.92,
    },
  },
];

/**
 * Garante que sempre temos um config válido — quando pet não tem custom avatar,
 * usa o default da espécie do próprio pet.
 */
export function resolveAvatarConfig(
  config: PetAvatarConfig | null | undefined,
  fallbackSpecies: AvatarSpecies = 'dog',
): PetAvatarConfig {
  if (config && config.species) return config;
  return defaultConfigForSpecies(fallbackSpecies);
}
