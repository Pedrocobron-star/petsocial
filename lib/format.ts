/**
 * Formata número grande em estilo compacto: 1234 → "1,2k", 1500000 → "1,5M"
 * Versão portuguesa (vírgula decimal).
 */
export function formatCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10_000) {
    const k = n / 1000;
    // 1.2k, 9.9k
    return `${k.toFixed(1).replace('.', ',').replace(',0', '')}k`;
  }
  if (n < 1_000_000) {
    return `${Math.floor(n / 1000)}k`;
  }
  const m = n / 1_000_000;
  return `${m.toFixed(1).replace('.', ',').replace(',0', '')}M`;
}

/**
 * Tempo relativo curto: "2h", "3d", "agora".
 * Pra usar quando quer compactness (action bars, timestamps).
 */
export function formatRelativeShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 30) return 'agora';
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}sem`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mês`;
  return `${Math.floor(days / 365)}a`;
}
