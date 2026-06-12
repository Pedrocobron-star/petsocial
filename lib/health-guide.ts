/**
 * Guia de Saúde (tira-dúvidas LOCAL) — base de conhecimento curada.
 *
 * Substitui o "assistente IA" por respostas de REFERÊNCIA, escritas à mão,
 * gerais e NÃO-prescritivas. Roda 100% no app (sem LLM, sem rede, custo ZERO).
 *
 * Regra de ouro: NUNCA diagnostica nem prescreve dose/medicamento. Sempre
 * orienta cuidado geral + "quando procurar o veterinário". O matcher por
 * palavra-chave devolve o tópico mais relevante; sem match, o app guia o tutor
 * a registrar sintomas e procurar um vet (não inventa resposta).
 */

export type GuideCategory =
  | 'alimentacao'
  | 'vacinas'
  | 'comportamento'
  | 'higiene'
  | 'filhote'
  | 'idoso'
  | 'sinais'
  | 'rotina';

export interface GuideTopic {
  id: string;
  category: GuideCategory;
  emoji: string;
  /** Pergunta-título exibida nos chips de sugestão. */
  question: string;
  /** Termos pra casar com o que o tutor digitar (sem acento, minúsculo). */
  keywords: string[];
  /** Resposta de referência. Geral, não-prescritiva, termina orientando o vet. */
  answer: string;
}

export const GUIDE_CATEGORIES: { id: GuideCategory; label: string; emoji: string }[] = [
  { id: 'sinais', label: 'Sinais de alerta', emoji: '🚩' },
  { id: 'alimentacao', label: 'Alimentação', emoji: '🍖' },
  { id: 'vacinas', label: 'Vacinas & vermífugo', emoji: '💉' },
  { id: 'comportamento', label: 'Comportamento', emoji: '🐾' },
  { id: 'higiene', label: 'Higiene & cuidados', emoji: '🛁' },
  { id: 'filhote', label: 'Filhote', emoji: '🍼' },
  { id: 'idoso', label: 'Pet idoso', emoji: '🐕‍🦺' },
  { id: 'rotina', label: 'Dia a dia', emoji: '📅' },
];

const VET_TAG = '\n\nIsto é informação de referência e não substitui a consulta com um veterinário.';

export const GUIDE_TOPICS: GuideTopic[] = [
  // ---------- ALIMENTAÇÃO ----------
  {
    id: 'alimentos-toxicos',
    category: 'alimentacao',
    emoji: '⛔',
    question: 'Que alimentos são tóxicos pro meu pet?',
    keywords: [
      'toxico', 'toxica', 'veneno', 'pode comer', 'nao pode comer', 'chocolate', 'uva',
      'uvas', 'passas', 'cebola', 'alho', 'xilitol', 'abacate', 'cafe', 'cafeina',
      'macadamia', 'proibido', 'faz mal', 'perigoso comer',
    ],
    answer:
      'Alguns alimentos comuns pra gente são perigosos pros pets. Evite SEMPRE: chocolate, uva e passas, cebola e alho, abacate, café, álcool, e xilitol (adoçante de balas/gomas e alguns doces).\n\nMassa de pão crua, ossos cozidos (lascam) e excesso de sal ou gordura também fazem mal. Na dúvida sobre um alimento específico, não ofereça.\n\nSe o pet comeu algo da lista, trate como possível emergência: anote o que e quanto, e procure um veterinário imediatamente.' +
      VET_TAG,
  },
  {
    id: 'quanto-ração',
    category: 'alimentacao',
    emoji: '🥣',
    question: 'Quanto de ração devo dar por dia?',
    keywords: [
      'quanto de racao', 'quantidade de racao', 'quanto comer', 'porcao', 'porção',
      'quantas vezes comer', 'medida de racao', 'alimentar quanto',
    ],
    answer:
      'A quantidade depende do peso, idade, nível de atividade e da ração específica. O ponto de partida é a tabela na embalagem da ração (por faixa de peso), dividida nas refeições do dia.\n\nFilhotes comem mais vezes ao dia (3 a 4); adultos costumam comer 2 vezes. Ajuste observando o corpo: você deve sentir as costelas sem enxergá-las, e ver uma cinturinha vista de cima.\n\nPra um cálculo sob medida (e em caso de sobrepeso ou magreza), o veterinário ajusta com precisão.' +
      VET_TAG,
  },
  {
    id: 'troca-racao',
    category: 'alimentacao',
    emoji: '🔄',
    question: 'Como trocar de ração sem dar diarreia?',
    keywords: ['trocar racao', 'mudar racao', 'transicao racao', 'nova racao', 'troca de alimento'],
    answer:
      'Troca de ração de uma vez costuma causar diarreia. Faça a transição em 5 a 7 dias, misturando as duas:\n\n• Dias 1-2: 75% da antiga + 25% da nova\n• Dias 3-4: 50% e 50%\n• Dias 5-6: 25% antiga + 75% nova\n• Dia 7: 100% nova\n\nSe aparecer diarreia ou vômito persistente durante a troca, volte um passo e, se não melhorar, fale com o veterinário.' +
      VET_TAG,
  },
  // ---------- SINAIS DE ALERTA ----------
  {
    id: 'vomito',
    category: 'sinais',
    emoji: '🤢',
    question: 'Meu pet está vomitando, devo me preocupar?',
    keywords: ['vomito', 'vomitando', 'vomitou', 'regurgit', 'enjoo', 'passando mal'],
    answer:
      'Um episódio isolado de vômito, com o pet ativo e bebendo água, costuma não ser grave. Vale jejum leve de algumas horas (mantendo água) e voltar com comida leve em pouca quantidade.\n\nProcure o veterinário com urgência se houver: vômito repetido (várias vezes em poucas horas), sangue, barriga inchada e dura, apatia, recusa de água, ou se for filhote, idoso ou pet com doença crônica.\n\nRegistre no app quando começou, quantas vezes e o aspecto. Isso ajuda muito o vet.' +
      VET_TAG,
  },
  {
    id: 'diarreia',
    category: 'sinais',
    emoji: '💩',
    question: 'O que fazer quando o pet está com diarreia?',
    keywords: ['diarreia', 'fezes moles', 'caganeira', 'cocô mole', 'coco mole', 'intestino solto'],
    answer:
      'Diarreia leve, com o pet animado, pode melhorar com comida leve e bastante água disponível. Evite trocar a ração ou dar petiscos novos nesse período.\n\nProcure o veterinário se: durar mais de 24-48h, tiver sangue ou muito muco, vier com vômito, ou se o pet estiver abatido, sem comer ou for filhote/idoso (eles desidratam rápido).\n\nAnote a frequência e o aspecto no diário de sintomas pra mostrar ao vet.' +
      VET_TAG,
  },
  {
    id: 'nao-come',
    category: 'sinais',
    emoji: '🍽️',
    question: 'Meu pet parou de comer, o que pode ser?',
    keywords: ['nao come', 'nao quer comer', 'sem apetite', 'parou de comer', 'recusa comida', 'inapetencia'],
    answer:
      'Perda de apetite tem muitas causas, de algo simples (calor, estresse, enjoo do sabor) a problemas de saúde. Um dia comendo menos pode ser normal; recusa total chama mais atenção.\n\nProcure o veterinário se o pet ficar mais de 24h sem comer (12h pra filhotes), ou se vier acompanhado de apatia, vômito, diarreia, ou dor. Repare também se ele está bebendo água.\n\nRegistre desde quando está assim pra ajudar no diagnóstico do vet.' +
      VET_TAG,
  },
  {
    id: 'coceira',
    category: 'sinais',
    emoji: '🐶',
    question: 'Meu pet se coça muito, o que pode ser?',
    keywords: ['coceira', 'cocando', 'se coca', 'prurido', 'alergia pele', 'lambendo pata', 'pele vermelha'],
    answer:
      'Coceira frequente costuma estar ligada a parasitas (pulgas), alergias (alimentar ou ambiental), pele seca ou infecções. Cheque o pelo com um pente fino procurando pulgas ou "sujeirinha preta".\n\nMantenha vermífugo/antipulga em dia e evite banhos em excesso com produtos não indicados pra pets. Não use medicamento humano na pele dele.\n\nSe a coceira é intensa, tem feridas, queda de pelo ou mau cheiro, o veterinário identifica a causa e o tratamento certo.' +
      VET_TAG,
  },
  {
    id: 'agua-muita',
    category: 'sinais',
    emoji: '💧',
    question: 'Meu pet está bebendo muita água, é normal?',
    keywords: ['bebendo muita agua', 'muita sede', 'sede demais', 'bebe muito', 'urina muito', 'xixi demais'],
    answer:
      'Beber mais água é esperado em dias quentes, após exercício ou com ração seca. Mas aumento persistente de sede e de xixi pode sinalizar questões que merecem avaliação.\n\nVale observar por alguns dias e, se possível, ter uma ideia do volume. Procure o veterinário se a mudança for marcante e contínua, principalmente em pets mais velhos.\n\nRegistrar o peso e os sintomas no app ajuda o vet a acompanhar a evolução.' +
      VET_TAG,
  },
  // ---------- VACINAS & VERMÍFUGO ----------
  {
    id: 'calendario-vacina',
    category: 'vacinas',
    emoji: '💉',
    question: 'Quais vacinas meu pet precisa e quando?',
    keywords: ['vacina', 'vacinas', 'calendario vacinal', 'quando vacinar', 'v8', 'v10', 'antirrabica', 'raiva'],
    answer:
      'Em filhotes, o protocolo costuma começar por volta das 6-8 semanas, com doses múltipla (V8/V10 em cães, tríplice/quádrupla em gatos) a cada 3-4 semanas até as ~16 semanas, mais a antirrábica. Depois, reforços anuais conforme orientação.\n\nO calendário ideal varia por espécie, idade, estilo de vida e região. Aqui no app, a aba Vacinas já te mostra um calendário sugerido pro seu pet e te lembra das próximas doses.\n\nO veterinário define e ajusta o protocolo final.' +
      VET_TAG,
  },
  {
    id: 'vermifugo-pulga',
    category: 'vacinas',
    emoji: '🐛',
    question: 'De quanto em quanto tempo dar vermífugo e antipulga?',
    keywords: ['vermifugo', 'vermifugar', 'verme', 'antipulga', 'pulga', 'carrapato', 'antiparasitario'],
    answer:
      'Como referência geral: vermífugo costuma ser repetido a cada 3-4 meses em adultos (mais frequente em filhotes), e antipulga/carrapato conforme a duração do produto (muitos são mensais).\n\nA frequência muda com o ambiente, contato com outros animais e a região (carrapato é mais pesado em algumas áreas). Mantenha tudo registrado na aba Vermífugo/Antipulga pra receber lembretes.\n\nO veterinário indica o produto e o intervalo certos pro seu pet.' +
      VET_TAG,
  },
  // ---------- COMPORTAMENTO ----------
  {
    id: 'late-muito',
    category: 'comportamento',
    emoji: '🔊',
    question: 'Meu cachorro late demais, como ajudar?',
    keywords: ['late muito', 'latindo', 'latido', 'barulho', 'au au', 'cachorro late'],
    answer:
      'Latido costuma ter um motivo: tédio, falta de exercício, ansiedade, alerta a barulhos, ou pedido de atenção. O primeiro passo é descobrir o gatilho.\n\nO que ajuda: gastar energia com passeios e brincadeiras diárias, enriquecimento (brinquedos que liberam petisco), rotina previsível e não reforçar o latido dando atenção na hora. Reforce o silêncio com recompensa.\n\nSe vier de ansiedade de separação ou for muito intenso, um adestrador positivo ou veterinário comportamental ajuda bastante.' +
      VET_TAG,
  },
  {
    id: 'ansiedade-separacao',
    category: 'comportamento',
    emoji: '😟',
    question: 'Meu pet fica ansioso quando fico fora',
    keywords: ['ansiedade', 'ansioso', 'separacao', 'sozinho', 'destroi', 'chora quando saio', 'ansiedade de separacao'],
    answer:
      'Sinais de ansiedade de separação incluem destruir objetos, chorar/latir muito, fazer xixi/cocô fora do lugar e agitação quando você se prepara pra sair.\n\nO que ajuda: saídas e chegadas tranquilas (sem festa), deixar o pet cansado antes de sair, brinquedos interativos com petisco, e dessensibilizar os "gatilhos" de saída (pegar a chave sem sair, por exemplo).\n\nCasos mais intensos merecem acompanhamento de um veterinário comportamental ou adestrador positivo.' +
      VET_TAG,
  },
  {
    id: 'xixi-fora',
    category: 'comportamento',
    emoji: '🚽',
    question: 'Como ensinar o pet a fazer xixi no lugar certo?',
    keywords: ['xixi no lugar', 'fazer no lugar', 'adestrar xixi', 'tapete higienico', 'banheiro', 'sujou a casa', 'urina fora'],
    answer:
      'A base é rotina e recompensa: leve o pet ao local certo nos momentos-chave (ao acordar, após comer e brincar) e recompense MUITO na hora em que ele acerta, com petisco e festa.\n\nLimpe os acidentes com produto enzimático (sem amônia/cloro, que atraem o pet de volta) e nunca brigue depois do fato. Constância é tudo.\n\nSe um pet que já era treinado volta a sujar de repente, pode ser saúde (infecção urinária, por exemplo). Vale uma avaliação do veterinário.' +
      VET_TAG,
  },
  // ---------- HIGIENE & CUIDADOS ----------
  {
    id: 'banho-frequencia',
    category: 'higiene',
    emoji: '🛁',
    question: 'Com que frequência posso dar banho?',
    keywords: ['banho', 'dar banho', 'frequencia banho', 'lavar o cachorro', 'lavar o gato', 'quantas vezes banho'],
    answer:
      'Em cães, banho a cada 2 a 4 semanas costuma ser suficiente (varia com pelagem, atividade e pele). Banho em excesso resseca a pele e tira a proteção natural.\n\nUse sempre shampoo específico pra pets (o nosso pH é diferente do deles); seque bem, principalmente nas orelhas e dobrinhas. Gatos em geral se limpam sozinhos e raramente precisam de banho.\n\nSe a pele está oleosa, com cheiro forte ou feridas, o veterinário pode indicar um shampoo terapêutico.' +
      VET_TAG,
  },
  {
    id: 'dentes',
    category: 'higiene',
    emoji: '🦷',
    question: 'Preciso escovar os dentes do meu pet?',
    keywords: ['dente', 'dentes', 'escovar dente', 'tartaro', 'mau halito', 'bafo', 'higiene bucal', 'gengiva'],
    answer:
      'Sim. Tártaro e doença na gengiva são muito comuns e afetam a saúde geral. O ideal é escovar os dentes com creme dental PRÓPRIO pra pets (o nosso é tóxico pra eles), de preferência diariamente.\n\nIntroduza aos poucos, deixando ele provar a pasta primeiro. Brinquedos e petiscos dentais ajudam como complemento, mas não substituem a escovação.\n\nMau hálito forte, gengiva muito vermelha ou dificuldade pra comer pedem avaliação do veterinário (pode precisar de limpeza profissional).' +
      VET_TAG,
  },
  {
    id: 'unhas',
    category: 'higiene',
    emoji: '✂️',
    question: 'Como cortar as unhas sem machucar?',
    keywords: ['unha', 'unhas', 'cortar unha', 'cortador de unha', 'aparar unha'],
    answer:
      'Use um cortador próprio pra pets e corte só a pontinha, evitando a parte rosada (a "polpa", que tem vaso e dói se cortada). Em unhas escuras, corte pouquinho de cada vez.\n\nFaça com calma, recompensando com petisco, e segure a patinha com firmeza suave. Se escutar as unhas batendo no chão ao andar, é sinal de que estão longas.\n\nSe tiver insegurança ou o pet resistir muito, um banho e tosa ou o veterinário fazem com tranquilidade.' +
      VET_TAG,
  },
  // ---------- FILHOTE ----------
  {
    id: 'filhote-chegou',
    category: 'filhote',
    emoji: '🍼',
    question: 'Trouxe um filhote pra casa, por onde começo?',
    keywords: ['filhote', 'novo filhote', 'cuidados filhote', 'recem chegado', 'primeiros cuidados', 'cachorrinho', 'gatinho'],
    answer:
      'Primeiros passos com um filhote: leve ao veterinário pra primeira avaliação e iniciar o protocolo de vacinas e vermífugo; ofereça ração específica pra filhotes (na quantidade da embalagem, 3-4 refeições/dia); e garanta um cantinho seguro pra dormir.\n\nComece já a socialização (sons, pessoas, outros pets vacinados) e o ensino de xixi no lugar, sempre com recompensa. Evite passeios na rua antes de completar o ciclo de vacinas.\n\nAqui no app você já cadastra as vacinas e recebe os lembretes das próximas doses. O veterinário guia o protocolo.' +
      VET_TAG,
  },
  {
    id: 'castracao',
    category: 'filhote',
    emoji: '✂️',
    question: 'Devo castrar? Com que idade?',
    keywords: ['castrar', 'castracao', 'castrado', 'esterilizar', 'idade castrar'],
    answer:
      'A castração traz benefícios de saúde e comportamento e evita ninhadas indesejadas. A idade ideal varia com espécie, porte e raça, então é uma decisão individual.\n\nÉ um procedimento comum e seguro, feito com avaliação pré-operatória. O pós costuma pedir repouso e uso do colar protetor por alguns dias.\n\nO veterinário é quem indica o melhor momento e orienta os cuidados pro seu pet.' +
      VET_TAG,
  },
  // ---------- IDOSO ----------
  {
    id: 'pet-idoso',
    category: 'idoso',
    emoji: '🐕‍🦺',
    question: 'Meu pet está idoso, o que muda nos cuidados?',
    keywords: ['idoso', 'velho', 'velhinho', 'senior', 'idade avancada', 'envelhec'],
    answer:
      'Pets idosos pedem mais atenção preventiva: consultas mais frequentes (a cada 6 meses costuma ser recomendado), de olho no peso, nos dentes e na mobilidade. Muitos se beneficiam de ração sênior.\n\nFacilite a vida dele: caminha e água acessíveis, tapetes antiderrapantes, caminhas macias e passeios mais curtos e frequentes. Observe mudanças de apetite, sede, sono e disposição.\n\nQualquer alteração mais marcante merece avaliação do veterinário, que pode detectar cedo questões da idade.' +
      VET_TAG,
  },
  // ---------- ROTINA ----------
  {
    id: 'calor',
    category: 'rotina',
    emoji: '☀️',
    question: 'Como proteger meu pet do calor?',
    keywords: ['calor', 'verao', 'quente', 'insolacao', 'hipertermia', 'sol forte', 'temperatura alta'],
    answer:
      'No calor: água fresca sempre disponível, sombra e ventilação, e passeios nos horários mais frescos (cedo ou à noite). O asfalto quente queima as patas, teste com a mão antes.\n\nNUNCA deixe o pet dentro do carro fechado, nem por minutos. Cuidado redobrado com raças de focinho achatado, idosos e filhotes.\n\nSinais de insolação (ofegância intensa, fraqueza, língua muito vermelha, vômito) são EMERGÊNCIA: leve a um local fresco e procure o veterinário na hora.' +
      VET_TAG,
  },
  {
    id: 'exercicio',
    category: 'rotina',
    emoji: '🎾',
    question: 'Quanto de exercício e passeio meu pet precisa?',
    keywords: ['exercicio', 'passeio', 'passear', 'energia', 'gastar energia', 'brincar', 'atividade fisica'],
    answer:
      'A necessidade varia muito com espécie, idade e raça. Como referência, a maioria dos cães se dá bem com 1 a 2 passeios por dia mais brincadeiras; raças mais ativas precisam de bem mais.\n\nGato também precisa gastar energia: brinquedos de caça, arranhadores e prateleiras pra escalar fazem diferença. Pet entediado costuma desenvolver comportamentos indesejados.\n\nPra filhotes e idosos, o exercício deve ser mais leve e fracionado. O veterinário ajuda a calibrar conforme a saúde.' +
      VET_TAG,
  },
  {
    id: 'viagem',
    category: 'rotina',
    emoji: '🧳',
    question: 'Vou viajar com meu pet, o que levar?',
    keywords: ['viajar', 'viagem', 'levar pet', 'transporte', 'carro com pet', 'aviao com pet'],
    answer:
      'Pra viajar com pet: leve a carteira de vacinação em dia, água e a ração de costume, caixa de transporte segura, coleira com identificação, e os documentos exigidos pelo destino/companhia.\n\nNo carro, ele deve ir contido (caixa ou cinto próprio), nunca solto nem com a cabeça pra fora. Faça paradas pra água e xixi. Pra avião, confirme as regras com antecedência.\n\nPra viagens longas ou internacionais, o veterinário emite os atestados e orienta o necessário.' +
      VET_TAG,
  },
];

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/**
 * Acha o tópico mais relevante pro texto do tutor. Pontua por palavra-chave
 * contida (palavra maior pesa mais, evita match bobo). Retorna null se nada
 * casar com confiança — aí o app guia pro vet em vez de inventar.
 */
export function matchGuideTopic(text: string): GuideTopic | null {
  const q = norm(text);
  if (q.length < 2) return null;
  let best: GuideTopic | null = null;
  let bestScore = 0;
  for (const topic of GUIDE_TOPICS) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (q.includes(norm(kw))) score += kw.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }
  // Exige um mínimo pra não casar por uma letrinha solta.
  return bestScore >= 4 ? best : null;
}

/** Sugestões iniciais: 1 tópico de cada categoria-chave, na ordem do guia. */
export function starterTopics(): GuideTopic[] {
  const seen = new Set<GuideCategory>();
  const out: GuideTopic[] = [];
  for (const t of GUIDE_TOPICS) {
    if (!seen.has(t.category)) {
      seen.add(t.category);
      out.push(t);
    }
  }
  return out;
}
