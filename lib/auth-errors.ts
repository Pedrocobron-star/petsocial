// Mapeia erros comuns do Supabase Auth (que vêm em inglês) pra mensagens
// claras em português. Usado nos catches de sign-in / sign-up.
export function authErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  const m = raw.toLowerCase();

  if (m.includes('invalid login credentials')) return 'Email ou senha incorretos.';
  if (m.includes('email not confirmed'))
    return 'Confirme seu email antes de entrar. Dá uma olhada na caixa de entrada.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Esse email já tem conta. Tenta entrar.';
  if (m.includes('password should be at least'))
    return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('rate limit') || m.includes('too many requests'))
    return 'Muitas tentativas. Espera um minutinho e tenta de novo.';
  if (m.includes('unable to validate email') || m.includes('invalid format'))
    return 'Email inválido.';
  if (m.includes('network') || m.includes('failed to fetch') || m.includes('load failed'))
    return 'Sem conexão. Verifica sua internet e tenta de novo.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled'))
    return 'Cadastros estão temporariamente desativados.';

  // Fallback: mostra a mensagem original se houver, senão genérico.
  return raw || 'Algo deu errado. Tenta de novo.';
}
