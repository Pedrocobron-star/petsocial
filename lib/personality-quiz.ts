import type { PersonalityType } from './types';

export interface QuizQuestion {
  id: string;
  question: string;
  options: { label: string; emoji: string; scores: Partial<Record<PersonalityType, number>> }[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'sleep',
    question: 'Onde seu pet prefere dormir?',
    options: [
      { label: 'Na cama com você', emoji: '🛏️', scores: { cuddler: 3, royal: 1 } },
      { label: 'No próprio cantinho', emoji: '🏠', scores: { independent: 3, shy: 1 } },
      { label: 'Em qualquer lugar bagunçado', emoji: '🎾', scores: { playful: 2, adventurer: 1 } },
      { label: 'Num trono almofadado', emoji: '👑', scores: { royal: 3 } },
    ],
  },
  {
    id: 'newperson',
    question: 'Quando chega uma visita em casa?',
    options: [
      { label: 'Corre pra cheirar e abraçar', emoji: '🤗', scores: { cuddler: 2, playful: 2 } },
      { label: 'Esconde até saber se confia', emoji: '🌸', scores: { shy: 3 } },
      { label: 'Olha de longe e analisa', emoji: '🦅', scores: { independent: 2, royal: 1 } },
      { label: 'Late pra mostrar quem manda', emoji: '🗣️', scores: { royal: 2, adventurer: 1 } },
    ],
  },
  {
    id: 'walk',
    question: 'Como é o passeio favorito?',
    options: [
      { label: 'Trilha longa, várias cheiradas', emoji: '🌄', scores: { adventurer: 3 } },
      { label: 'Parque pra correr e brincar', emoji: '🎾', scores: { playful: 3 } },
      { label: 'Curtinho, só pra fazer xixi', emoji: '🚶', scores: { independent: 2, shy: 1 } },
      { label: 'Passeio com cara de modelo', emoji: '💅', scores: { royal: 3 } },
    ],
  },
  {
    id: 'food',
    question: 'Hora da comida:',
    options: [
      { label: 'Come tudo em 10 segundos', emoji: '🍖', scores: { playful: 2, adventurer: 1 } },
      { label: 'Espera ser servido com carinho', emoji: '🤗', scores: { cuddler: 2, royal: 1 } },
      { label: 'Come no horário, sempre o mesmo', emoji: '⏰', scores: { independent: 3 } },
      { label: 'Exige só a melhor ração', emoji: '👑', scores: { royal: 3 } },
    ],
  },
  {
    id: 'noise',
    question: 'Tem barulho alto na rua. O que faz?',
    options: [
      { label: 'Vai investigar imediatamente', emoji: '🌄', scores: { adventurer: 3 } },
      { label: 'Esconde debaixo da cama', emoji: '🌸', scores: { shy: 3 } },
      { label: 'Late pra mostrar coragem', emoji: '🗣️', scores: { royal: 2, adventurer: 1 } },
      { label: 'Ignora completamente', emoji: '😏', scores: { independent: 3 } },
    ],
  },
  {
    id: 'toys',
    question: 'Brinquedos favoritos?',
    options: [
      { label: 'Bolinha, cordinha, qualquer coisa que se move', emoji: '🎾', scores: { playful: 3 } },
      { label: 'Aquele pelúcia velho que ama', emoji: '🧸', scores: { cuddler: 3 } },
      { label: 'Brinquedo? Pra que se eu tenho a vida?', emoji: '🦅', scores: { independent: 2, royal: 1 } },
      { label: 'Caixa de papelão pra explorar', emoji: '📦', scores: { adventurer: 2, shy: 1 } },
    ],
  },
  {
    id: 'water',
    question: 'Hora do banho:',
    options: [
      { label: 'Adora! Pula na água sozinho', emoji: '💦', scores: { adventurer: 3, playful: 1 } },
      { label: 'Aceita com choro, mas tudo bem', emoji: '🚿', scores: { cuddler: 2 } },
      { label: 'Foge correndo, é uma luta', emoji: '🏃', scores: { shy: 2, independent: 2 } },
      { label: 'Spa em casa, com música ambiente', emoji: '👑', scores: { royal: 3 } },
    ],
  },
  {
    id: 'social',
    question: 'No parque com outros pets:',
    options: [
      { label: 'Faz amigos em segundos', emoji: '🤗', scores: { playful: 2, cuddler: 2 } },
      { label: 'Observa de longe primeiro', emoji: '🌸', scores: { shy: 3 } },
      { label: 'Lidera a galera toda', emoji: '👑', scores: { royal: 2, adventurer: 1 } },
      { label: 'Faz seu próprio passeio sozinho', emoji: '🦅', scores: { independent: 3 } },
    ],
  },
  {
    id: 'energy',
    question: 'Nível de energia diário:',
    options: [
      { label: '🔥🔥🔥 Pilha que nunca acaba', emoji: '⚡', scores: { playful: 3, adventurer: 1 } },
      { label: '🔥 Brincalhão em momentos certos', emoji: '😊', scores: { playful: 1, cuddler: 1 } },
      { label: '😴 Bebê dorminhoco', emoji: '💤', scores: { cuddler: 2, royal: 1 } },
      { label: '🧘 Zen master', emoji: '🧘', scores: { independent: 2, royal: 1 } },
    ],
  },
  {
    id: 'attention',
    question: 'Você tá no celular há 1h:',
    options: [
      { label: 'Late até você prestar atenção', emoji: '🗣️', scores: { royal: 3, playful: 1 } },
      { label: 'Senta no seu colo silenciosamente', emoji: '🤗', scores: { cuddler: 3 } },
      { label: 'Vai brincar sozinho com tudo da casa', emoji: '🎾', scores: { playful: 2, adventurer: 1 } },
      { label: 'Aproveita pra dormir mais', emoji: '💤', scores: { independent: 2, shy: 1 } },
    ],
  },
];

export function calculateResult(answers: Record<string, number>): PersonalityType {
  const scores: Record<PersonalityType, number> = {
    adventurer: 0,
    cuddler: 0,
    playful: 0,
    shy: 0,
    independent: 0,
    royal: 0,
  };
  for (const [qid, optionIdx] of Object.entries(answers)) {
    const q = QUIZ_QUESTIONS.find((x) => x.id === qid);
    if (!q) continue;
    const option = q.options[optionIdx];
    if (!option) continue;
    for (const [type, points] of Object.entries(option.scores)) {
      scores[type as PersonalityType] += points;
    }
  }
  // Winner: maior score (em caso de empate, pega o primeiro)
  let winner: PersonalityType = 'playful';
  let max = -1;
  for (const [type, score] of Object.entries(scores) as [PersonalityType, number][]) {
    if (score > max) {
      max = score;
      winner = type;
    }
  }
  return winner;
}
