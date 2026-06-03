/**
 * Parser de texto para extrair hashtags e menções.
 * Hashtags: #palavra (sem espaço, letras + dígitos + underscore, com suporte a acentos)
 * Menções:  @display_name (até espaço ou pontuação)
 */

// Regex permitindo letras Unicode (incluindo acentos PT-BR), dígitos e _
// Mínimo 2 chars depois do #
const HASHTAG_RE = /#([\p{L}\p{N}_]{2,30})/gu;
const MENTION_RE = /@([\p{L}\p{N}_.-]{2,30})/gu;

export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const set = new Set<string>();
  for (const m of text.matchAll(HASHTAG_RE)) {
    set.add(m[1].toLowerCase());
  }
  return Array.from(set);
}

export function extractMentions(text: string): string[] {
  if (!text) return [];
  const set = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) {
    set.add(m[1]);
  }
  return Array.from(set);
}

export type TextToken =
  | { type: 'text'; value: string }
  | { type: 'hashtag'; value: string }
  | { type: 'mention'; value: string };

/**
 * Quebra um texto em tokens — útil pra renderizar com cores diferentes.
 */
export function tokenize(text: string): TextToken[] {
  if (!text) return [];
  const combined = /(#[\p{L}\p{N}_]{2,30}|@[\p{L}\p{N}_.-]{2,30})/gu;
  const parts = text.split(combined);
  const tokens: TextToken[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('#')) {
      tokens.push({ type: 'hashtag', value: part.slice(1) });
    } else if (part.startsWith('@')) {
      tokens.push({ type: 'mention', value: part.slice(1) });
    } else {
      tokens.push({ type: 'text', value: part });
    }
  }
  return tokens;
}
