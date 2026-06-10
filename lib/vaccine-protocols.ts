/**
 * Calendário vacinal sugerido — referência brasileira (CRMV / Anvisa / Vacinet).
 *
 * IMPORTANTE: estas sugestões são REFERÊNCIA, não prescrição médica.
 * O Maestro Pet NUNCA substitui veterinário. O protocolo final depende
 * de avaliação clínica, região, lifestyle do pet e disponibilidade de vacinas.
 *
 * Fontes consultadas:
 *  - Guia de Vacinação WSAVA (adaptado pro Brasil)
 *  - Protocolos CRMV-SP de imunização canina/felina
 *  - Recomendações de fabricantes (Zoetis, MSD, Boehringer)
 *
 * Cobertura: cães (core + opcional), gatos (core + opcional), coelhos básico.
 * Outras espécies → exibimos mensagem genérica recomendando consulta vet.
 */

import type { Pet, Species, Vaccination } from './types';

/** Idade em semanas onde a dose é recomendada. */
export interface VaccineDose {
  /** Número da dose na série inicial (1 = primeira do filhote, 2 = 2ª, etc). */
  number: number;
  /** Idade mínima (semanas). */
  ageWeeksMin: number;
  /** Idade máxima recomendada (semanas) — após isso, consultar vet. */
  ageWeeksMax: number;
  /** Notas pra exibir junto. */
  note?: string;
}

export type ProtocolPriority = 'core' | 'optional' | 'regional';

export interface VaccineProtocol {
  id: string;
  species: Species;
  name: string;
  /** Variações de nome usadas pelo tutor (matching case-insensitive). */
  aliases: string[];
  /** Resumo curto pra exibir. */
  description: string;
  priority: ProtocolPriority;
  /** Doses da série inicial. */
  initialDoses: VaccineDose[];
  /** Intervalo entre doses iniciais (dias) — usado se a 1ª dose foi tarde. */
  initialIntervalDays: number;
  /** Intervalo do reforço após série completa (dias). 365 = anual. */
  boosterIntervalDays: number;
  /** Emoji pra UI. */
  emoji: string;
}

// ============================================================================
// CÃES
// ============================================================================

const DOG_PROTOCOLS: VaccineProtocol[] = [
  {
    id: 'dog-v8',
    species: 'dog',
    name: 'V8 (Óctupla)',
    aliases: ['v8', 'octupla', 'óctupla', 'polivalente', 'puppy dp', 'cinomose', 'parvovirose'],
    description:
      'Cobre cinomose, parvovirose, hepatite, parainfluenza, adenovirose e leptospirose (2 cepas).',
    priority: 'core',
    initialDoses: [
      { number: 1, ageWeeksMin: 6, ageWeeksMax: 8, note: 'Primeira dose do filhote' },
      { number: 2, ageWeeksMin: 10, ageWeeksMax: 12, note: 'Segunda dose — 21-30 dias após a 1ª' },
      { number: 3, ageWeeksMin: 14, ageWeeksMax: 16, note: 'Terceira dose — fecha a série inicial' },
    ],
    initialIntervalDays: 28,
    boosterIntervalDays: 365,
    emoji: '💉',
  },
  {
    id: 'dog-v10',
    species: 'dog',
    name: 'V10 (Décupla)',
    aliases: ['v10', 'decupla', 'décupla', 'polivalente plus'],
    description: 'Igual à V8 + cobertura ampliada de leptospirose (4 cepas). Mais completa.',
    priority: 'core',
    initialDoses: [
      { number: 1, ageWeeksMin: 6, ageWeeksMax: 8 },
      { number: 2, ageWeeksMin: 10, ageWeeksMax: 12 },
      { number: 3, ageWeeksMin: 14, ageWeeksMax: 16 },
    ],
    initialIntervalDays: 28,
    boosterIntervalDays: 365,
    emoji: '💉',
  },
  {
    id: 'dog-rabies',
    species: 'dog',
    name: 'Antirrábica',
    aliases: ['antirrabica', 'antirrábica', 'raiva', 'rabies'],
    description: 'Obrigatória por lei na maioria dos municípios brasileiros.',
    priority: 'core',
    initialDoses: [
      { number: 1, ageWeeksMin: 16, ageWeeksMax: 20, note: 'Aplicada após série de filhote' },
    ],
    initialIntervalDays: 0,
    boosterIntervalDays: 365,
    emoji: '🦠',
  },
  {
    id: 'dog-kennel-cough',
    species: 'dog',
    name: 'Tosse dos Canis (Gripe Canina)',
    aliases: ['gripe canina', 'tosse dos canis', 'kc', 'kennel cough', 'bordetella'],
    description:
      'Recomendada pra cães que frequentam creche, hotel, parque ou daycare. Bordetella + parainfluenza.',
    priority: 'optional',
    initialDoses: [{ number: 1, ageWeeksMin: 8, ageWeeksMax: 12 }],
    initialIntervalDays: 0,
    boosterIntervalDays: 365,
    emoji: '🤧',
  },
  {
    id: 'dog-giardia',
    species: 'dog',
    name: 'Giárdia',
    aliases: ['giardia', 'giárdia'],
    description:
      'Opcional. Indicada pra cães com acesso a áreas comunitárias de água parada.',
    priority: 'optional',
    initialDoses: [
      { number: 1, ageWeeksMin: 8, ageWeeksMax: 12 },
      { number: 2, ageWeeksMin: 12, ageWeeksMax: 16 },
    ],
    initialIntervalDays: 28,
    boosterIntervalDays: 365,
    emoji: '🦠',
  },
  {
    id: 'dog-leishmaniasis',
    species: 'dog',
    name: 'Leishmaniose',
    aliases: ['leishmaniose', 'leish', 'leishmaniasis'],
    description:
      'Recomendada em regiões endêmicas (Centro-Oeste, Norte, parte do Nordeste e SE). Exige teste prévio.',
    priority: 'regional',
    initialDoses: [
      { number: 1, ageWeeksMin: 16, ageWeeksMax: 20, note: 'Após teste sorológico negativo' },
      { number: 2, ageWeeksMin: 19, ageWeeksMax: 23, note: '21 dias após a 1ª' },
      { number: 3, ageWeeksMin: 22, ageWeeksMax: 26, note: '21 dias após a 2ª' },
    ],
    initialIntervalDays: 21,
    boosterIntervalDays: 365,
    emoji: '🦟',
  },
];

// ============================================================================
// GATOS
// ============================================================================

const CAT_PROTOCOLS: VaccineProtocol[] = [
  {
    id: 'cat-v3',
    species: 'cat',
    name: 'V3 (Tríplice Felina)',
    aliases: ['v3', 'triplice', 'tríplice', 'triplice felina', 'tríplice felina', 'fhv', 'fcv', 'fpv'],
    description:
      'Cobre panleucopenia, rinotraqueíte viral e calicivirose. Considerada essencial.',
    priority: 'core',
    initialDoses: [
      { number: 1, ageWeeksMin: 8, ageWeeksMax: 10, note: 'Primeira dose do filhote' },
      { number: 2, ageWeeksMin: 12, ageWeeksMax: 14, note: '21-30 dias após a 1ª' },
      { number: 3, ageWeeksMin: 16, ageWeeksMax: 18, note: 'Fecha a série inicial' },
    ],
    initialIntervalDays: 28,
    boosterIntervalDays: 365,
    emoji: '💉',
  },
  {
    id: 'cat-v4',
    species: 'cat',
    name: 'V4 (Quádrupla Felina)',
    aliases: ['v4', 'quadrupla', 'quádrupla', 'quadrupla felina'],
    description: 'Tríplice + clamidiose. Alternativa à V3.',
    priority: 'core',
    initialDoses: [
      { number: 1, ageWeeksMin: 8, ageWeeksMax: 10 },
      { number: 2, ageWeeksMin: 12, ageWeeksMax: 14 },
      { number: 3, ageWeeksMin: 16, ageWeeksMax: 18 },
    ],
    initialIntervalDays: 28,
    boosterIntervalDays: 365,
    emoji: '💉',
  },
  {
    id: 'cat-v5',
    species: 'cat',
    name: 'V5 (Quíntupla Felina)',
    aliases: ['v5', 'quintupla', 'quíntupla', 'quintupla felina'],
    description:
      'Quádrupla + leucemia felina (FeLV). Recomendada pra gatos com acesso à rua.',
    priority: 'optional',
    initialDoses: [
      { number: 1, ageWeeksMin: 8, ageWeeksMax: 10 },
      { number: 2, ageWeeksMin: 12, ageWeeksMax: 14 },
      { number: 3, ageWeeksMin: 16, ageWeeksMax: 18 },
    ],
    initialIntervalDays: 28,
    boosterIntervalDays: 365,
    emoji: '💉',
  },
  {
    id: 'cat-felv',
    species: 'cat',
    name: 'FeLV (Leucemia Felina)',
    aliases: ['felv', 'leucemia felina', 'leucemia'],
    description:
      'Indicada pra gatos com acesso à rua ou contato com outros felinos. Exige teste prévio.',
    priority: 'optional',
    initialDoses: [
      { number: 1, ageWeeksMin: 9, ageWeeksMax: 12, note: 'Após teste FeLV/FIV negativo' },
      { number: 2, ageWeeksMin: 12, ageWeeksMax: 16, note: '21-30 dias após a 1ª' },
    ],
    initialIntervalDays: 28,
    boosterIntervalDays: 365,
    emoji: '🩸',
  },
  {
    id: 'cat-rabies',
    species: 'cat',
    name: 'Antirrábica',
    aliases: ['antirrabica', 'antirrábica', 'raiva', 'rabies'],
    description: 'Obrigatória por lei. Aplicada após série de filhote.',
    priority: 'core',
    initialDoses: [{ number: 1, ageWeeksMin: 16, ageWeeksMax: 20 }],
    initialIntervalDays: 0,
    boosterIntervalDays: 365,
    emoji: '🦠',
  },
];

// ============================================================================
// COELHOS
// ============================================================================

const RABBIT_PROTOCOLS: VaccineProtocol[] = [
  {
    id: 'rabbit-vhd',
    species: 'rabbit',
    name: 'VHD (Doença Hemorrágica Viral)',
    aliases: ['vhd', 'rhdv', 'doença hemorrágica', 'doenca hemorragica', 'rabbit hemorrhagic'],
    description:
      'Doença grave em coelhos domésticos. Vacina importada via importação direta no Brasil.',
    priority: 'core',
    initialDoses: [
      { number: 1, ageWeeksMin: 8, ageWeeksMax: 12, note: 'A partir de 2 meses' },
    ],
    initialIntervalDays: 0,
    boosterIntervalDays: 365,
    emoji: '💉',
  },
  {
    id: 'rabbit-myxo',
    species: 'rabbit',
    name: 'Mixomatose',
    aliases: ['mixomatose', 'myxomatosis'],
    description:
      'Recomendada em regiões com pulgas/mosquitos. Indisponível em algumas regiões do BR.',
    priority: 'regional',
    initialDoses: [
      { number: 1, ageWeeksMin: 8, ageWeeksMax: 12 },
    ],
    initialIntervalDays: 0,
    boosterIntervalDays: 180,
    emoji: '🦟',
  },
];

// ============================================================================
// API pública
// ============================================================================

export const VACCINE_PROTOCOLS: Record<Species, VaccineProtocol[]> = {
  dog: DOG_PROTOCOLS,
  cat: CAT_PROTOCOLS,
  rabbit: RABBIT_PROTOCOLS,
  bird: [],
  reptile: [],
  rodent: [],
  fish: [],
  other: [],
};

/** Idade do pet em semanas (0 se sem birthdate). */
export function petAgeWeeks(pet: Pick<Pet, 'birthdate'>): number {
  if (!pet.birthdate) return 0;
  const birth = new Date(pet.birthdate);
  const now = new Date();
  const ms = now.getTime() - birth.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 7));
}

/** Verifica se uma vacinação registrada bate com o protocolo (case + alias). */
function vaccineMatchesProtocol(vac: Vaccination, protocol: VaccineProtocol): boolean {
  const name = vac.name.trim().toLowerCase();
  if (name === protocol.name.toLowerCase()) return true;
  return protocol.aliases.some((alias) => name.includes(alias));
}

export type SuggestionStatus = 'due_now' | 'due_soon' | 'overdue' | 'up_to_date';

export interface VaccineSuggestion {
  protocol: VaccineProtocol;
  /** Quantas doses iniciais foram aplicadas (matching). */
  appliedCount: number;
  /** Próxima dose esperada (null se já completou série + booster em dia). */
  nextDose: VaccineDose | null;
  /** Se é dose inicial ou reforço anual. */
  kind: 'initial' | 'booster';
  /** Quantos dias até a próxima dose (negativo = atrasado). */
  daysUntil: number | null;
  status: SuggestionStatus;
  /** Última aplicação encontrada (pra calcular reforço). */
  lastApplied: Vaccination | null;
  /** Mensagem amigável pra UI. */
  message: string;
}

/**
 * Mapeia dias-até-dose pra status amigável:
 *  - overdue   : já passou
 *  - due_now   : próximos 14 dias (faça agora)
 *  - due_soon  : 15-60 dias (planeje)
 *  - up_to_date: > 60 dias (não bloqueante, só pra registro)
 *
 * Definida ANTES de getSuggestedVaccines pra evitar TDZ — Metro com
 * reactCompiler=true não faz hoisting de function declarations.
 */
function bucketStatus(daysUntil: number): SuggestionStatus {
  if (daysUntil < 0) return 'overdue';
  if (daysUntil <= 14) return 'due_now';
  if (daysUntil <= 60) return 'due_soon';
  return 'up_to_date';
}

/**
 * Compara protocolos da espécie contra vacinações registradas e retorna
 * sugestões do que está faltando ou próximo de vencer.
 *
 * - Pet sem birthdate → assume 0 semanas (todas doses iniciais aparecem).
 * - Vacinas extras (nome não bate com nenhum protocolo) → ignoradas.
 * - Protocolos completos + reforço em dia → não retornados.
 */
export function getSuggestedVaccines(
  pet: Pick<Pet, 'species' | 'birthdate'>,
  existingVaccines: Vaccination[],
): VaccineSuggestion[] {
  const protocols = VACCINE_PROTOCOLS[pet.species] ?? [];
  if (protocols.length === 0) return [];

  const ageWeeks = petAgeWeeks(pet);
  const today = Date.now();
  const suggestions: VaccineSuggestion[] = [];

  for (const protocol of protocols) {
    // Vacinações registradas que batem com este protocolo
    const matches = existingVaccines
      .filter((v) => vaccineMatchesProtocol(v, protocol))
      .sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime());

    const appliedCount = matches.length;
    const lastApplied = matches[matches.length - 1] ?? null;

    // Caso 1: ainda não completou série inicial
    if (appliedCount < protocol.initialDoses.length) {
      const nextDose = protocol.initialDoses[appliedCount];

      // Pet ainda muito novo pra essa dose? (só pula se a idade for conhecida)
      if (pet.birthdate && ageWeeks < nextDose.ageWeeksMin - 2) {
        // Mais de 2 semanas antes da janela — pula
        continue;
      }

      // Calcula dias até dose
      let daysUntil = 0;
      let status: SuggestionStatus = 'due_now';

      if (lastApplied) {
        // Dose adicional — usa intervalo do protocolo
        const lastDate = new Date(lastApplied.applied_at).getTime();
        const nextDate = lastDate + protocol.initialIntervalDays * 86400000;
        daysUntil = Math.ceil((nextDate - today) / 86400000);
        status = bucketStatus(daysUntil);
      } else if (pet.birthdate) {
        // Primeira dose — calcula baseado na idade
        const targetWeek = nextDose.ageWeeksMin;
        const weeksUntil = targetWeek - ageWeeks;
        daysUntil = weeksUntil * 7;
        if (ageWeeks > nextDose.ageWeeksMax) status = 'overdue';
        else status = bucketStatus(daysUntil);
      } else {
        // Sem birthdate — não sabemos quando, mas mostramos como "due_soon"
        // pra evitar alarme falso
        daysUntil = 0;
        status = 'due_soon';
      }

      const message = buildMessage(protocol, nextDose, 'initial', daysUntil, ageWeeks);

      suggestions.push({
        protocol,
        appliedCount,
        nextDose,
        kind: 'initial',
        daysUntil,
        status,
        lastApplied,
        message,
      });
      continue;
    }

    // Caso 2: série inicial completa — verificar reforço
    if (lastApplied) {
      const lastDate = new Date(lastApplied.applied_at).getTime();
      const nextDate =
        lastApplied.next_dose_at
          ? new Date(lastApplied.next_dose_at).getTime()
          : lastDate + protocol.boosterIntervalDays * 86400000;
      const daysUntil = Math.ceil((nextDate - today) / 86400000);

      if (daysUntil > 60) continue; // Reforço longe ainda — não polui sugestões

      const status = bucketStatus(daysUntil);

      suggestions.push({
        protocol,
        appliedCount,
        nextDose: null,
        kind: 'booster',
        daysUntil,
        status,
        lastApplied,
        message: buildBoosterMessage(protocol, daysUntil),
      });
    }
  }

  // Ordena: overdue primeiro, depois due_now, due_soon, e core antes de optional/regional
  const priorityOrder: Record<ProtocolPriority, number> = { core: 0, optional: 1, regional: 2 };
  const statusOrder: Record<SuggestionStatus, number> = {
    overdue: 0,
    due_now: 1,
    due_soon: 2,
    up_to_date: 3,
  };

  suggestions.sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return priorityOrder[a.protocol.priority] - priorityOrder[b.protocol.priority];
  });

  return suggestions;
}

function buildMessage(
  protocol: VaccineProtocol,
  dose: VaccineDose,
  _kind: 'initial' | 'booster',
  daysUntil: number,
  ageWeeks: number,
): string {
  const doseLabel = `Dose ${dose.number} de ${protocol.initialDoses.length}`;

  if (daysUntil < -30) {
    const months = Math.floor(Math.abs(daysUntil) / 30);
    return `${doseLabel} — atrasada ~${months} ${months === 1 ? 'mês' : 'meses'}`;
  }
  if (daysUntil < 0) {
    return `${doseLabel} — atrasada ${Math.abs(daysUntil)} dia${Math.abs(daysUntil) === 1 ? '' : 's'}`;
  }
  if (daysUntil === 0) {
    return `${doseLabel} — janela ideal agora`;
  }
  if (daysUntil <= 14) {
    return `${doseLabel} — janela em ${daysUntil} dia${daysUntil === 1 ? '' : 's'}`;
  }
  if (ageWeeks < dose.ageWeeksMin) {
    const weeksUntil = dose.ageWeeksMin - ageWeeks;
    return `${doseLabel} — sugerida em ~${weeksUntil} semana${weeksUntil === 1 ? '' : 's'}`;
  }
  return `${doseLabel} — janela ${dose.ageWeeksMin}-${dose.ageWeeksMax} semanas`;
}

function buildBoosterMessage(protocol: VaccineProtocol, daysUntil: number): string {
  const intervalLabel = protocol.boosterIntervalDays === 365 ? 'anual' : `${protocol.boosterIntervalDays} dias`;
  if (daysUntil < 0) {
    return `Reforço ${intervalLabel} atrasado ${Math.abs(daysUntil)} dia${Math.abs(daysUntil) === 1 ? '' : 's'}`;
  }
  if (daysUntil === 0) return `Reforço ${intervalLabel} hoje`;
  return `Reforço ${intervalLabel} em ${daysUntil} dia${daysUntil === 1 ? '' : 's'}`;
}
