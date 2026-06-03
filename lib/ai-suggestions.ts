import { petAgeStage, type PetAgeStage } from './pet-age';
import type { Pet } from './types';

export interface SuggestionCategory {
  id: string;
  label: string;
  emoji: string;
  items: { emoji: string; text: string }[];
}

/**
 * Retorna sugestões agrupadas e contextualizadas ao pet.
 *
 * Estratégia:
 *  - Categorias fixas comuns (Saúde, Comportamento, Cuidados)
 *  - Categoria extra "Pra filhotes" / "Pra idosos" baseado em birthdate
 *  - Sugestões específicas por espécie (gato vs cachorro pedem coisas diferentes)
 */
export function getAiSuggestions(pet: Pet | undefined): SuggestionCategory[] {
  const species = pet?.species ?? 'other';
  const ageStage: PetAgeStage = pet?.birthdate ? petAgeStage(pet.birthdate) : 'adult';
  const isDog = species === 'dog';
  const isCat = species === 'cat';

  const cats: SuggestionCategory[] = [];

  // Categoria por idade — vem primeiro porque é o mais contextual
  if (ageStage === 'puppy') {
    cats.push({
      id: 'puppy',
      label: 'Filhote',
      emoji: '🐣',
      items: [
        { emoji: '💉', text: 'Quando começar o calendário de vacinas?' },
        { emoji: '🦴', text: 'Como introduzir alimentação sólida?' },
        { emoji: '🚽', text: 'Como ensinar a fazer xixi no lugar certo?' },
        { emoji: '👶', text: 'Quanto tempo de socialização precisa?' },
      ],
    });
  } else if (ageStage === 'senior') {
    cats.push({
      id: 'senior',
      label: 'Pet idoso',
      emoji: '🧓',
      items: [
        { emoji: '🦴', text: 'Sinais de artrite ou dor articular?' },
        { emoji: '🍖', text: 'Qual ração ideal pra pet idoso?' },
        { emoji: '🧠', text: 'Como identificar disfunção cognitiva?' },
        { emoji: '🩺', text: 'Frequência de check-up depois dos 8 anos?' },
      ],
    });
  }

  // Saúde — sempre relevante
  cats.push({
    id: 'health',
    label: 'Saúde',
    emoji: '🩺',
    items: [
      { emoji: '💊', text: 'Quando devo vermifugar de novo?' },
      { emoji: '🦷', text: 'Como cuidar dos dentes e prevenir tártaro?' },
      { emoji: '🌡️', text: 'Como sei se meu pet está com febre?' },
      ...(isDog
        ? [{ emoji: '🪱', text: 'Sinais de leishmaniose ou doença do carrapato?' }]
        : []),
      ...(isCat
        ? [{ emoji: '💧', text: 'Por que meu gato bebe pouca água?' }]
        : []),
    ],
  });

  // Comportamento
  cats.push({
    id: 'behavior',
    label: 'Comportamento',
    emoji: '🧠',
    items: [
      { emoji: '😨', text: 'Como acalmar pet com medo de fogos?' },
      { emoji: '🦴', text: 'Por que meu pet rouba comida?' },
      { emoji: '🛋️', text: 'Como evitar que destrua móveis?' },
      ...(isDog
        ? [{ emoji: '🚶', text: 'Como ensinar a andar do meu lado na coleira?' }]
        : []),
      ...(isCat
        ? [{ emoji: '😼', text: 'Por que meu gato arranha tudo?' }]
        : []),
    ],
  });

  // Alimentação e exercício
  cats.push({
    id: 'care',
    label: 'Cuidados',
    emoji: '🍖',
    items: [
      ...(pet?.breed
        ? [{ emoji: '🥘', text: `Que ração é boa pra ${pet.breed}?` }]
        : [{ emoji: '🥘', text: 'Que ração é boa pra essa raça?' }]),
      { emoji: '🚶', text: 'Quanto tempo de exercício por dia?' },
      { emoji: '🛁', text: 'Quantas vezes por mês posso dar banho?' },
      { emoji: '🦴', text: 'Frutas e alimentos seguros pra dar?' },
    ],
  });

  return cats;
}
