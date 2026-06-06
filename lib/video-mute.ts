/**
 * Estado de mudo GLOBAL pros vídeos do feed (estilo Instagram).
 *
 * Quando o usuário toca no ícone de som de UM vídeo, todos passam a respeitar
 * a mesma escolha (a próxima vez que um vídeo aparece, já vem no estado que ele
 * escolheu). Começa MUDO (autoplay só é permitido mudo nos navegadores).
 */
import { useSyncExternalStore } from 'react';

let muted = true;
const listeners = new Set<() => void>();

export function getVideoMuted(): boolean {
  return muted;
}

export function setVideoMuted(value: boolean): void {
  if (muted === value) return;
  muted = value;
  listeners.forEach((l) => l());
}

export function toggleVideoMuted(): void {
  setVideoMuted(!muted);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Hook reativo — re-renderiza quando o mute global muda. */
export function useVideoMuted(): boolean {
  return useSyncExternalStore(subscribe, getVideoMuted, getVideoMuted);
}

/** Formata segundos em m:ss (ex.: 65 → "1:05"). */
export function formatVideoTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}
