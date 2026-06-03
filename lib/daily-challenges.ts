export interface DailyChallenge {
  id: string;
  emoji: string;
  title: string;
  hint: string;
}

export const CHALLENGES: DailyChallenge[] = [
  { id: 'smile', emoji: '😊', title: 'Pet sorrindo', hint: 'Aquele sorrisinho de quem tá feliz' },
  { id: 'action', emoji: '🏃', title: 'Pet em ação', hint: 'Correndo, pulando, ou só andando' },
  { id: 'bath', emoji: '🛁', title: 'Antes ou depois do banho', hint: 'O drama vale tudo' },
  { id: 'food', emoji: '🍽️', title: 'Hora da papinha', hint: 'O olhar pidão' },
  { id: 'sleep', emoji: '😴', title: 'Pet dormindo', hint: 'Sonha com biscoito' },
  { id: 'view', emoji: '🌅', title: 'Foto com vista bonita', hint: 'Paisagem + pet = combo perfeito' },
  { id: 'zoomies', emoji: '💨', title: 'Modo zoomies', hint: 'Aquela energia gratuita' },
  { id: 'cute_face', emoji: '🥰', title: 'Carinha de quem fez arte', hint: 'Sabe que aprontou' },
  { id: 'play', emoji: '🎾', title: 'Hora da brincadeira', hint: 'Bolinha, corda, mordedor' },
  { id: 'park', emoji: '🌳', title: 'Passeio no parque', hint: 'Foto no verde' },
  { id: 'window', emoji: '🪟', title: 'Pet na janela', hint: 'Olhando o mundo passar' },
  { id: 'belly', emoji: '🐶', title: 'Barriguinha pra cima', hint: 'Pedindo cafuné' },
  { id: 'derp', emoji: '🤪', title: 'Cara de derp', hint: 'A pose mais boba' },
  { id: 'sweater', emoji: '🧶', title: 'Pet de roupinha', hint: 'Modinha pet' },
  { id: 'water', emoji: '💧', title: 'Bebendo água', hint: 'Hidratado é vida' },
  { id: 'toy', emoji: '🧸', title: 'Brinquedo favorito', hint: 'O xodó dele' },
  { id: 'tongue', emoji: '👅', title: 'Língua de fora', hint: 'Cansado mas feliz' },
  { id: 'sun', emoji: '☀️', title: 'Pet pegando sol', hint: 'Vitamina D natural' },
  { id: 'friend', emoji: '🤝', title: 'Pet + amigo', hint: 'Outro pet, gato, criança...' },
  { id: 'tail', emoji: '🐾', title: 'Foto da pata ou cauda', hint: 'Detalhes contam histórias' },
  { id: 'box', emoji: '📦', title: 'Pet na caixa', hint: 'Se cabe ele entra' },
  { id: 'jumping', emoji: '🦘', title: 'Pet pulando', hint: 'Momento congelado no ar' },
  { id: 'shake', emoji: '💦', title: 'Sacudindo a água', hint: 'Aquele chuveiro 360°' },
  { id: 'training', emoji: '🎓', title: 'Treino do dia', hint: 'Sit, paw, roll over' },
  { id: 'side_eye', emoji: '😏', title: 'Olhar julgador', hint: 'Sabe que você errou' },
  { id: 'gif_worthy', emoji: '🎬', title: 'Cena pra virar gif', hint: 'Aquela hora que vale o vídeo' },
  { id: 'closeup', emoji: '🔎', title: 'Close-up dos olhos', hint: 'A alma do pet' },
  { id: 'snack', emoji: '🦴', title: 'Recebendo petisco', hint: 'O momento mais esperado do dia' },
  { id: 'mess', emoji: '🌪️', title: 'Bagunça que ele fez', hint: 'A "obra de arte"' },
  { id: 'silly', emoji: '🤡', title: 'Pose ridícula', hint: 'Sem julgamento, só amor' },
];

/**
 * Retorna o desafio do dia baseado no dia do ano.
 * Mesmo desafio pra todos no mesmo dia, rotaciona a cada dia.
 */
export function getTodayChallenge(): DailyChallenge {
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((today.getTime() - start.getTime()) / 86400000);
  return CHALLENGES[dayOfYear % CHALLENGES.length];
}
