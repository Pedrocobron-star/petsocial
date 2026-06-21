export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number; // índice da correta
  explain: string;
}

/**
 * Banco de perguntas de conhecimentos gerais sobre pets (PT-BR).
 * Fatos amplamente conhecidos. NÃO é diagnóstico/aconselhamento veterinário.
 *
 * MÍNIMO RECOMENDADO: 20 perguntas. O Quiz no Difícil sorteia 12 por partida
 * (lib/games -> DIFF_PARAMS), então manter folga garante variedade entre
 * partidas. Se cair abaixo disso, as partidas começam a repetir muito.
 */
export const PET_QUIZ: QuizQuestion[] = [
  {
    q: 'Quantos dentes tem um cão adulto?',
    options: ['28', '32', '42', '52'],
    answer: 2,
    explain: 'Cães adultos têm 42 dentes (humanos têm 32).',
  },
  {
    q: 'Qual desses alimentos é TÓXICO para cães?',
    options: ['Cenoura', 'Chocolate', 'Maçã sem semente', 'Arroz cozido'],
    answer: 1,
    explain: 'Chocolate contém teobromina, tóxica para cães e gatos.',
  },
  {
    q: 'Uva e uva-passa são seguras para cães?',
    options: ['Sim, ótimas', 'Não, podem ser tóxicas', 'Só passas', 'Só cozidas'],
    answer: 1,
    explain: 'Uvas e passas podem causar problemas renais sérios em cães.',
  },
  {
    q: 'Quantas horas por dia um gato adulto costuma dormir?',
    options: ['4 a 6h', '8 a 10h', '12 a 16h', '22 a 24h'],
    answer: 2,
    explain: 'Gatos dormem em média de 12 a 16 horas por dia.',
  },
  {
    q: 'Cães enxergam só em preto e branco?',
    options: ['Sim, total', 'Não, veem cores (azul e amarelo)', 'Só à noite', 'Igual aos humanos'],
    answer: 1,
    explain: 'Cães enxergam cores, principalmente tons de azul e amarelo.',
  },
  {
    q: 'Qual a temperatura corporal normal de um cão saudável?',
    options: ['~33°C', '~36°C', '~38,5°C', '~41°C'],
    answer: 2,
    explain: 'O normal de cães e gatos fica em torno de 38 a 39°C.',
  },
  {
    q: 'Cebola e alho são seguros para cães e gatos?',
    options: ['Sim', 'Não, são tóxicos', 'Só alho', 'Só em sopa'],
    answer: 1,
    explain: 'Cebola e alho danificam as células do sangue de cães e gatos.',
  },
  {
    q: 'Quanto dura, em média, a gestação de uma cadela?',
    options: ['21 dias', '63 dias', '95 dias', '120 dias'],
    answer: 1,
    explain: 'A gestação canina dura cerca de 63 dias (~9 semanas).',
  },
  {
    q: 'O padrão do focinho do cão é único, parecido com…',
    options: ['A íris do olho', 'A impressão digital humana', 'O formato da orelha', 'Nada disso'],
    answer: 1,
    explain: 'Cada focinho tem um padrão único, como uma digital.',
  },
  {
    q: 'Gatos sentem o sabor doce?',
    options: ['Sim, adoram', 'Não percebem doce', 'Só filhotes', 'Só mel'],
    answer: 1,
    explain: 'Gatos não têm receptores funcionais para o sabor doce.',
  },
  {
    q: 'Cães podem comer osso COZIDO?',
    options: ['Sim, é o melhor', 'Não, lasca e é perigoso', 'Só de frango', 'Só os grandes'],
    answer: 1,
    explain: 'Osso cozido lasca facilmente e pode perfurar o intestino.',
  },
  {
    q: 'O adoçante xilitol é perigoso para cães?',
    options: ['Sim, muito tóxico', 'Não, é seguro', 'Só em excesso', 'Só para filhotes'],
    answer: 0,
    explain: 'Xilitol causa queda de açúcar e dano hepático graves em cães.',
  },
  {
    q: 'Para que serve o microchip de identificação?',
    options: ['GPS em tempo real', 'Identificação permanente do pet', 'Vacinar à distância', 'Medir a temperatura'],
    answer: 1,
    explain: 'O microchip identifica o pet e o liga ao tutor — não é GPS.',
  },
  {
    q: 'Por onde os cães eliminam calor (suam)?',
    options: ['Por todo o corpo', 'Pelas patas e pela ofegação', 'Só pela língua', 'Pelo nariz'],
    answer: 1,
    explain: 'Cães regulam o calor ofegando e suam um pouco pelos coxins.',
  },
  {
    q: 'A clavícula flexível do gato permite passar por vãos do tamanho de…',
    options: ['Sua cabeça', 'Sua pata', 'Sua cauda', 'Sua orelha'],
    answer: 0,
    explain: 'Se a cabeça do gato passa, o corpo geralmente passa também.',
  },
  {
    q: 'Leite de vaca é recomendado para gatos adultos?',
    options: ['Sim, clássico', 'Não, muitos são intolerantes à lactose', 'Só desnatado', 'Só morno'],
    answer: 1,
    explain: 'A maioria dos gatos adultos é intolerante à lactose.',
  },
  {
    q: 'O que é a castração?',
    options: ['Uma vacina', 'Esterilização que evita reprodução', 'Um tipo de tosa', 'Um exame de sangue'],
    answer: 1,
    explain: 'Castrar esteriliza e traz benefícios de saúde e comportamento.',
  },
  {
    q: '"1 ano de cão = 7 anos humanos" é…',
    options: ['Verdade exata', 'Só uma aproximação grosseira', 'Verdade só para gatos', 'Verdade após os 10 anos'],
    answer: 1,
    explain: 'A conversão real não é linear; "x7" é só uma regra de bolso.',
  },
  {
    q: 'Qual NÃO é um sinal de emergência que pede vet imediato?',
    options: ['Dificuldade pra respirar', 'Convulsão', 'Um espirro isolado', 'Barriga inchada e dura'],
    answer: 2,
    explain: 'Um espirro isolado costuma ser inofensivo; os outros são urgências.',
  },
  {
    q: 'O que são os "zoomies" (FRAP) em cães e gatos?',
    options: ['Uma doença', 'Crises de energia / corridas malucas', 'Um tipo de ração', 'Um parasita'],
    answer: 1,
    explain: 'São explosões normais de energia — o pet sai correndo feliz.',
  },
  {
    q: 'Filhotes de cão tomam as vacinas iniciais em…',
    options: ['Dose única na vida', 'Várias doses (protocolo) + reforços', 'Só se ficarem doentes', 'Nunca'],
    answer: 1,
    explain: 'O protocolo tem múltiplas doses no início + reforços periódicos.',
  },
  {
    q: 'Qual é um bom enriquecimento ambiental para gatos?',
    options: ['Deixar sempre sozinho', 'Arranhadores, prateleiras e brinquedos', 'Nenhum estímulo', 'Só comida à vontade'],
    answer: 1,
    explain: 'Arranhadores, alturas e brinquedos reduzem estresse e tédio.',
  },
  {
    q: 'Por que a caixa de areia deve ficar sempre limpa?',
    options: ['Gatos não ligam', 'Gatos são higiênicos e podem parar de usar', 'Para gastar mais areia', 'Não importa'],
    answer: 1,
    explain: 'Gato é higiênico; caixa suja faz ele fazer xixi fora do lugar.',
  },
  {
    q: 'Melhor forma de apresentar dois pets novos?',
    options: ['Juntar de uma vez', 'Aos poucos, com cheiro e supervisão', 'Nunca apresentar', 'Trancar juntos'],
    answer: 1,
    explain: 'Apresentação gradual e supervisionada evita brigas e estresse.',
  },
  {
    q: 'Qual destas é uma das maiores raças de cão em altura?',
    options: ['Chihuahua', 'Dogue Alemão (Great Dane)', 'Pug', 'Shih Tzu'],
    answer: 1,
    explain: 'O Dogue Alemão é uma das raças mais altas que existem.',
  },
  {
    q: 'Gato preto dá azar?',
    options: ['Sim', 'Não, é só superstição', 'Só na sexta 13', 'Depende da lua'],
    answer: 1,
    explain: 'É só superstição — gatos pretos são ótimos companheiros.',
  },
];

/** Embaralha (Fisher-Yates) e pega N perguntas. */
export function pickQuizQuestions(n: number): QuizQuestion[] {
  const pool = [...PET_QUIZ];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}
