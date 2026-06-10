import { differenceInDays, differenceInHours, differenceInMinutes, format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface CountdownState {
  label: string;
  /** Sub-texto contextual (data exata, hora). */
  sub?: string;
  /** Severidade visual: 'past' / 'live' / 'imminent' / 'soon' / 'future'. */
  tone: 'past' | 'live' | 'imminent' | 'soon' | 'future';
}

/**
 * Calcula countdown humanizado pra um meetup.
 *
 * - past:     já aconteceu há mais de 1h
 * - live:     entre -1h e +1h do horário (acontecendo agora)
 * - imminent: < 24h pro evento
 * - soon:     1-7 dias
 * - future:   8+ dias
 */
export function meetupCountdown(startsAt: string): CountdownState {
  const date = new Date(startsAt);
  const now = new Date();
  const diffMin = differenceInMinutes(date, now);
  const diffHrs = differenceInHours(date, now);
  const diffDays = differenceInDays(date, now);

  // Acontecendo agora (±1h)
  if (diffMin >= -60 && diffMin <= 60) {
    return {
      label: 'Acontecendo agora',
      sub: format(date, "HH:mm", { locale: ptBR }),
      tone: 'live',
    };
  }

  // Passado (mais de 1h atrás)
  if (diffMin < -60) {
    const absHrs = Math.abs(diffHrs);
    const absDays = Math.abs(diffDays);
    if (absDays === 0) {
      return {
        label: `Aconteceu há ${absHrs} ${absHrs === 1 ? 'hora' : 'horas'}`,
        sub: format(date, "HH:mm", { locale: ptBR }),
        tone: 'past',
      };
    }
    if (absDays === 1) {
      return { label: 'Aconteceu ontem', sub: format(date, "HH:mm", { locale: ptBR }), tone: 'past' };
    }
    return {
      label: `Aconteceu há ${absDays} dias`,
      sub: format(date, "d 'de' MMM", { locale: ptBR }),
      tone: 'past',
    };
  }

  // Hoje (mas mais de 1h pra frente)
  if (isToday(date)) {
    if (diffHrs <= 2) {
      return {
        label: `Em ${diffMin} min`,
        sub: `Hoje às ${format(date, 'HH:mm', { locale: ptBR })}`,
        tone: 'imminent',
      };
    }
    return {
      label: `Hoje às ${format(date, 'HH:mm', { locale: ptBR })}`,
      sub: `Em ${diffHrs} ${diffHrs === 1 ? 'hora' : 'horas'}`,
      tone: 'imminent',
    };
  }

  // < 24h (mas não hoje — caso de meia-noite)
  if (diffHrs < 24) {
    return {
      label: `Em ${diffHrs}h`,
      sub: format(date, "EEE 'às' HH:mm", { locale: ptBR }),
      tone: 'imminent',
    };
  }

  // 1-7 dias
  if (diffDays <= 7) {
    return {
      label: `Em ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`,
      sub: format(date, "EEE, d 'de' MMM 'às' HH:mm", { locale: ptBR }),
      tone: 'soon',
    };
  }

  // Futuro distante
  return {
    label: format(date, "d 'de' MMM", { locale: ptBR }),
    sub: format(date, "EEE 'às' HH:mm", { locale: ptBR }),
    tone: 'future',
  };
}

/**
 * Cor + bg + accent para o badge de countdown.
 */
export function countdownPalette(tone: CountdownState['tone']) {
  switch (tone) {
    case 'live':
      return { bg: '#FEE2E2', fg: '#991B1B', accent: '#DC2626' };
    case 'imminent':
      return { bg: '#FEF3C7', fg: '#78350F', accent: '#F59E0B' };
    case 'soon':
      return { bg: '#FED7AA', fg: '#9A3412', accent: '#F97316' };
    case 'past':
      return { bg: '#F5F5F4', fg: '#737373', accent: '#A8A29E' };
    case 'future':
    default:
      return { bg: '#DBEAFE', fg: '#1E40AF', accent: '#3B82F6' };
  }
}

// ============================================================================
// ICS (calendário) — gera string ICS pra .ics download
// ============================================================================

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function toIcsDate(d: Date): string {
  // Format: YYYYMMDDTHHMMSSZ (UTC)
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export interface IcsEventInput {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  starts_at: string;
  /** Duração em minutos. Default 60. */
  duration_min?: number;
}

/**
 * Gera conteúdo .ics (RFC 5545) pra um evento. Pode ser baixado e adicionado
 * em Google Calendar / Apple Calendar / Outlook.
 */
export function buildIcs(event: IcsEventInput): string {
  const start = new Date(event.starts_at);
  const end = new Date(start.getTime() + (event.duration_min ?? 60) * 60 * 1000);
  const now = new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Maestro Pet//Meetup//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}@petsocial`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    event.description ? `DESCRIPTION:${icsEscape(event.description)}` : '',
    event.location ? `LOCATION:${icsEscape(event.location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}
