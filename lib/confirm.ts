/**
 * Ponte pro modal de confirmação estilizado (web).
 *
 * O `ConfirmHost` (montado no _layout) registra um handler aqui. O shim de
 * `Alert.alert` (lib/web-alert.ts) chama `showConfirm` em vez do `window.confirm`
 * nativo — assim as confirmações ficam bonitas e dentro do app.
 *
 * Se nenhum host estiver montado (caso raro: Alert chamado antes do mount),
 * `showConfirm` retorna false e o chamador cai no fallback nativo.
 */
import type { AlertButton } from 'react-native';

export interface ConfirmRequest {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

let host: ((req: ConfirmRequest) => void) | null = null;

export function registerConfirmHost(fn: ((req: ConfirmRequest) => void) | null): void {
  host = fn;
}

/** Retorna true se roteou pro modal; false se não há host (usar fallback). */
export function showConfirm(req: ConfirmRequest): boolean {
  if (host) {
    host(req);
    return true;
  }
  return false;
}
