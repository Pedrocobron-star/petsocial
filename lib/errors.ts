/**
 * Mensagem de erro segura pro usuário final.
 *
 * Erros do Supabase/Postgres vêm em inglês e cheios de jargão ("column ... does
 * not exist", "violates row-level security policy", "duplicate key"...). Mostrar
 * isso pra um tutor não-técnico quebra a confiança. Esta função: se a mensagem
 * parecer técnica (ou for muito longa), devolve um fallback caloroso; senão,
 * mostra a mensagem como veio (preserva os erros amigáveis em pt-BR que a gente
 * mesmo lança, tipo "O Pet Pro pago ainda não abriu").
 */
const TECH = /\b(violat|constraint|column|relation|syntax|duplicate key|row-level|permission denied|jwt|token|fetch|networkerror|timeout|null value|policy|schema|does not exist|undefined|typeerror|supabase|postgres|pgrst|sql|42\d{3}|p0\d{3}|503|500|payload)\b/i;

export function safeErrorMessage(
  e: unknown,
  fallback = 'Tenta de novo em uns minutos. Se continuar, escreve pra gente.',
): string {
  const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  if (!msg) return fallback;
  if (msg.length > 140) return fallback;
  if (TECH.test(msg)) return fallback;
  return msg;
}
