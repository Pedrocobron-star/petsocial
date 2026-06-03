/**
 * Calcula idade do pet a partir da data de nascimento (ISO).
 * Retorna texto humanizado: "8 meses", "1 ano e 3 meses", "5 anos".
 * Retorna null se não tem birthdate.
 */
export function petAgeText(birthdate: string | null | undefined): string | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0) {
    if (months <= 0) {
      // calcula dias
      const days = Math.max(0, Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)));
      if (days === 0) return 'recém-chegado';
      return `${days} dia${days > 1 ? 's' : ''}`;
    }
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  }

  if (months === 0) return `${years} ano${years > 1 ? 's' : ''}`;
  return `${years} ano${years > 1 ? 's' : ''} e ${months} ${months === 1 ? 'mês' : 'meses'}`;
}

/**
 * É aniversário do pet hoje? (mesmo dia e mês)
 */
export function isBirthdayToday(birthdate: string | null | undefined): boolean {
  if (!birthdate) return false;
  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return false;
  const today = new Date();
  return birth.getDate() === today.getDate() && birth.getMonth() === today.getMonth();
}

/**
 * Faixa etária pra ajustes visuais do avatar:
 *  - 'puppy': < 1 ano (olhos maiores, mais expressivo)
 *  - 'adult': 1–8 anos (default)
 *  - 'senior': 8+ anos (alguns fios brancos)
 *
 * Nota: limite de "senior" varia por espécie real (gato é mais longevo etc),
 * mas pra visual usamos 8 como média prática.
 */
export type PetAgeStage = 'puppy' | 'adult' | 'senior';

export function petAgeStage(birthdate: string | null | undefined): PetAgeStage {
  if (!birthdate) return 'adult';
  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return 'adult';
  const now = new Date();
  const years = (now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (years < 1) return 'puppy';
  if (years >= 8) return 'senior';
  return 'adult';
}

/**
 * Dias até o próximo aniversário (ignora ano — só compara dia/mês).
 * Retorna 0 se é hoje, número positivo se está pra vir, ou null se sem birthdate.
 *
 * Útil pra countdown "Faltam X dias" na tela de aniversário.
 */
export function daysUntilBirthday(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Próximo aniversário neste ano (ou no próximo se já passou)
  const thisYear = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  thisYear.setHours(0, 0, 0, 0);
  const target = thisYear.getTime() < today.getTime()
    ? new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate())
    : thisYear;
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Quantos anos completa hoje (se for aniversário).
 */
export function birthdayYears(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  if (birth.getDate() !== today.getDate() || birth.getMonth() !== today.getMonth()) return null;
  return today.getFullYear() - birth.getFullYear();
}
