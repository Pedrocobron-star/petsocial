import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Trial gratuito de 7 dias da customização de avatar.
 *
 * Armazenado localmente (AsyncStorage) por simplicidade. Limitação conhecida:
 * trial reseta entre dispositivos. Sprint futuro: migrar pra coluna no perfil
 * (profiles.avatar_trial_started_at) pra cross-device.
 *
 * Chave inclui user.id pra suportar troca de conta no mesmo device.
 */

const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function storageKey(userId: string) {
  return `petsocial:avatar-trial:${userId}`;
}

export interface TrialState {
  startedAt: number | null;
  /** Em milissegundos restantes; 0 se expirado/nunca iniciou. */
  msRemaining: number;
  /** True se já usou o trial alguma vez (expirado ou ativo). */
  used: boolean;
  /** True se está dentro dos 7 dias e pode customizar. */
  active: boolean;
}

export async function getTrialState(userId: string): Promise<TrialState> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) {
      return { startedAt: null, msRemaining: 0, used: false, active: false };
    }
    const startedAt = parseInt(raw, 10);
    if (Number.isNaN(startedAt)) {
      return { startedAt: null, msRemaining: 0, used: false, active: false };
    }
    const elapsed = Date.now() - startedAt;
    const msRemaining = Math.max(0, TRIAL_DURATION_MS - elapsed);
    return {
      startedAt,
      msRemaining,
      used: true,
      active: msRemaining > 0,
    };
  } catch {
    return { startedAt: null, msRemaining: 0, used: false, active: false };
  }
}

export async function startTrial(userId: string): Promise<TrialState> {
  const now = Date.now();
  try {
    await AsyncStorage.setItem(storageKey(userId), String(now));
  } catch {
    // Falha silenciosa — usuário ainda pode tentar de novo
  }
  return {
    startedAt: now,
    msRemaining: TRIAL_DURATION_MS,
    used: true,
    active: true,
  };
}

/**
 * Formata tempo restante em texto humanizado: "5 dias", "12 horas", "30 min".
 */
export function formatTrialRemaining(msRemaining: number): string {
  if (msRemaining <= 0) return 'expirou';
  const minutes = Math.floor(msRemaining / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days} dia${days > 1 ? 's' : ''}`;
  if (hours >= 1) return `${hours}h`;
  return `${Math.max(1, minutes)} min`;
}
