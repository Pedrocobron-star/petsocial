/**
 * Export de listas do admin pra CSV (download no navegador). Útil pra
 * contabilidade/marketing (pagamentos, fundadores, banidos, usuários).
 * Web-only: no app nativo não há download de arquivo.
 */
import { Platform } from 'react-native';

function escapeCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serializa as linhas em CSV (cabeçalho = chaves da 1ª linha) e baixa o arquivo. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]): boolean {
  if (!rows.length || Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const headers = Object.keys(rows[0]);
  const body = rows.map((r) => headers.map((h) => escapeCell(r[h])).join(',')).join('\n');
  const csv = `${headers.join(',')}\n${body}`;
  // BOM (﻿) pra o Excel abrir acento certo
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}
