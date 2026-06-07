// Flag de SESSÃO: o usuário tocou "Pular" no onboarding sem cadastrar pet.
// Evita o loop confuso: celular sem pet → onboarding → "Pular" → feed →
// (volta pro celular) → onboarding de novo...
//
// É session-scoped de propósito — ao recarregar o app, o onboarding reaparece
// uma vez (e dá pra pular de novo). Mantém o caminho de render síncrono, sem
// AsyncStorage no meio do gate do celular.
let skipped = false;

export function markOnboardingSkipped() {
  skipped = true;
}

export function wasOnboardingSkipped() {
  return skipped;
}
