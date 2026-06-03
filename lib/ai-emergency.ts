/**
 * Detecção de palavras-chave de emergência veterinária.
 *
 * Quando o draft do usuário contém essas keywords, mostramos um banner
 * vermelho urgente sugerindo ir direto pra um vet. A IA não substitui
 * atendimento de emergência — esse banner é safety-net.
 *
 * Categorias e exemplos:
 *  - Sintomas críticos: convulsão, desmaiou, paralisia
 *  - Trauma: atropelado, sangrando, fratura, mordida
 *  - Toxicológico: chocolate, intoxicação, veneno, comeu
 *  - Respiratório: engasgado, sufocando, dificuldade pra respirar
 *  - Gastro severo: vomitando muito, sangue, diarreia há dias
 */

const EMERGENCY_KEYWORDS = [
  // Sintomas críticos
  'convuls',
  'desmai',
  'parali',
  'inconsciente',
  'apag',
  // Trauma
  'atropel',
  'sangra',
  'sangue',
  'fratur',
  'osso quebr',
  'mordid',
  'mordeu',
  'queimad',
  'machucad',
  // Tóxico
  'chocolate',
  'intoxic',
  'veneno',
  'envenen',
  'comeu pasta',
  'comeu remed',
  'rato',
  'mata-rato',
  'uvas',
  'cebola',
  'alho',
  // Respiratório
  'engasg',
  'sufoc',
  'asfix',
  'não respira',
  'nao respira',
  'falta de ar',
  // Gastro severo
  'vomitando muito',
  'vomitando sangue',
  'diarreia com sangue',
  'há dias sem comer',
  'ha dias sem comer',
  'sem comer há',
  'sem comer ha',
  'inchad',
  'distend',
  // Urgência genérica
  'urgent',
  'emergenc',
  'socorro',
  'ajuda urgente',
];

/**
 * Retorna true se o texto sugere uma possível emergência.
 * Case-insensitive, acento-insensible.
 */
export function detectEmergency(text: string): boolean {
  if (!text) return false;
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return EMERGENCY_KEYWORDS.some((kw) => normalized.includes(kw));
}
