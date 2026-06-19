/**
 * Exporta diário de sintomas como PDF estruturado pra levar pro veterinário.
 *
 * Mesmo template visual da carteira de vacinação, com:
 *   - Cabeçalho com pet + período coberto
 *   - Disclaimer claro (registros do tutor, não diagnóstico)
 *   - Tabela cronológica com severity tintada
 *   - Resumo numérico (ativos, resolvidos, marcados pro vet)
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Pet, PetSymptom } from './types';

const SEVERITY_TINTS: Record<number, { bg: string; color: string; label: string }> = {
  1: { bg: '#DCFCE7', color: '#166534', label: 'Leve' },
  2: { bg: '#FEF9C3', color: '#854D0E', label: 'Pouco' },
  3: { bg: '#FED7AA', color: '#9A3412', label: 'Moderado' },
  4: { bg: '#FECDD3', color: '#9F1239', label: 'Forte' },
  5: { bg: '#FEE2E2', color: '#7F1D1D', label: 'Grave' },
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function speciesLabel(s: string): string {
  const map: Record<string, string> = {
    dog: 'Cachorro',
    cat: 'Gato',
    bird: 'Pássaro',
    rabbit: 'Coelho',
    reptile: 'Réptil',
    rodent: 'Roedor',
    fish: 'Peixe',
    other: 'Outro',
  };
  return map[s] ?? s;
}

function emojiFor(species: string): string {
  const map: Record<string, string> = {
    dog: '🐶',
    cat: '🐱',
    bird: '🐦',
    rabbit: '🐰',
    reptile: '🦎',
    rodent: '🐹',
    fish: '🐟',
    other: '🐾',
  };
  return map[species] ?? '🐾';
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export function buildSymptomsHtml(
  pet: Pet,
  symptoms: PetSymptom[],
  isPro = false,
): string {
  const today = new Date().toLocaleDateString('pt-BR');
  const sorted = [...symptoms].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  );

  // Período coberto
  const oldest = sorted[sorted.length - 1]?.recorded_at;
  const newest = sorted[0]?.recorded_at;
  const periodLabel =
    oldest && newest && oldest !== newest
      ? `${fmtDate(oldest)} a ${fmtDate(newest)}`
      : newest
        ? fmtDate(newest)
        : '—';

  // Stats
  const total = symptoms.length;
  const active = symptoms.filter((s) => !s.resolved_at).length;
  const resolved = total - active;
  const flagged = symptoms.filter((s) => s.flagged_for_vet).length;
  const severe = symptoms.filter((s) => s.severity >= 4).length;

  const rows = sorted
    .map((s) => {
      const tint = SEVERITY_TINTS[s.severity] ?? SEVERITY_TINTS[3];
      const statusBadges: string[] = [];
      if (s.flagged_for_vet) {
        statusBadges.push(
          '<span class="badge badge-flag">🩺 PRA VET</span>',
        );
      }
      if (s.resolved_at) {
        statusBadges.push(
          `<span class="badge badge-resolved">RESOLVIDO ${fmtDate(s.resolved_at)}</span>`,
        );
      } else {
        statusBadges.push('<span class="badge badge-active">ATIVO</span>');
      }

      return `
        <tr>
          <td class="cell-date">
            <strong>${fmtDateTime(s.recorded_at)}</strong>
          </td>
          <td class="cell-severity">
            <span class="severity-pill" style="background:${tint.bg};color:${tint.color}">
              ${tint.label.toUpperCase()}
            </span>
          </td>
          <td class="cell-description">
            <div class="description">${escapeHtml(s.description)}</div>
            ${s.body_part ? `<div class="meta">📍 ${escapeHtml(s.body_part)}</div>` : ''}
            ${s.notes ? `<div class="notes">${escapeHtml(s.notes)}</div>` : ''}
            <div class="status-row">${statusBadges.join(' ')}</div>
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Diário de Sintomas — ${escapeHtml(pet.name)}</title>
  <style>
    @page { margin: 24px; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1A1410; margin: 0; padding: 24px; }
    .header { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 3px solid #F97316; }
    .logo { font-size: 32px; }
    .brand { font-size: 18px; font-weight: 700; color: #F97316; letter-spacing: 0.5px; }
    .subtitle { font-size: 11px; color: #737373; }
    .pet-card { background: #FFF7ED; padding: 16px; border-radius: 14px; margin-bottom: 16px; display: flex; gap: 16px; align-items: center; }
    .pet-emoji { font-size: 44px; }
    .pet-info h2 { margin: 0 0 4px; font-size: 22px; }
    .pet-info p { margin: 2px 0; font-size: 12px; color: #525252; }
    .disclaimer { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px 14px; border-radius: 8px; margin-bottom: 18px; font-size: 12px; color: #78350F; line-height: 1.5; }
    .disclaimer strong { color: #92400E; }
    .stats { display: flex; gap: 8px; margin-bottom: 18px; }
    .stat { flex: 1; background: #FAFAFA; padding: 12px 8px; border-radius: 10px; text-align: center; border: 1px solid #E5E5E5; }
    .stat-num { font-size: 22px; font-weight: 700; color: #1A1410; line-height: 1; }
    .stat-label { font-size: 10px; color: #525252; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat.urgent { background: #FEE2E2; border-color: #FCA5A5; }
    .stat.urgent .stat-num, .stat.urgent .stat-label { color: #7F1D1D; }
    .stat.flag { background: #FED7AA; border-color: #FDBA74; }
    .stat.flag .stat-num, .stat.flag .stat-label { color: #9A3412; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    thead th { background: #1A1410; color: #fff; text-align: left; padding: 10px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; }
    tbody td { padding: 12px 8px; border-bottom: 1px solid #E5E5E5; vertical-align: top; }
    tbody tr:nth-child(even) { background: #FAFAFA; }
    .cell-date { white-space: nowrap; width: 130px; font-size: 11px; color: #525252; }
    .cell-severity { width: 100px; }
    .severity-pill { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }
    .description { font-size: 13px; color: #1A1410; line-height: 1.5; margin-bottom: 6px; }
    .meta { font-size: 11px; color: #737373; margin-bottom: 4px; }
    .notes { font-size: 11px; color: #525252; font-style: italic; margin-bottom: 6px; padding-left: 8px; border-left: 2px solid #E5E5E5; }
    .status-row { margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-flag { background: #FECACA; color: #7F1D1D; }
    .badge-resolved { background: #E2E8F0; color: #475569; }
    .badge-active { background: #DBEAFE; color: #1E40AF; }
    .empty { padding: 24px; text-align: center; color: #737373; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #E5E5E5; font-size: 10px; color: #A3A3A3; text-align: center; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 120px; color: rgba(249, 115, 22, 0.06); font-weight: 700; pointer-events: none; z-index: -1; letter-spacing: 4px; }
    .badge-orange { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #FED7AA; color: #9A3412; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  </style>
</head>
<body>
  ${!isPro ? '<div class="watermark">MAESTRO PET</div>' : ''}
  <div class="header">
    <div class="logo">🐾</div>
    <div>
      <div class="brand">Maestro Pet${isPro ? ' Pro ⭐' : ''}</div>
      <div class="subtitle">Diário de Sintomas — para apresentação veterinária</div>
    </div>
  </div>

  <div class="pet-card">
    <div class="pet-emoji">${emojiFor(pet.species)}</div>
    <div class="pet-info">
      <h2>${escapeHtml(pet.name)}</h2>
      <p>${speciesLabel(pet.species)}${pet.breed ? ` &bull; ${escapeHtml(pet.breed)}` : ''}</p>
      ${pet.birthdate ? `<p>Nascimento: ${fmtDate(pet.birthdate)}</p>` : ''}
      <p><span class="badge-orange">${total} ${total === 1 ? 'registro' : 'registros'}</span> &bull; Período: ${periodLabel}</p>
    </div>
  </div>

  <div class="disclaimer">
    <strong>⚠️ Importante:</strong>
    Este documento é um <strong>registro do tutor</strong>, não um diagnóstico. As severidades
    listadas refletem a percepção de quem cuida do pet, não uma classificação clínica. Use estes
    dados como ponto de partida pra anamnese — a avaliação veterinária é insubstituível.
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-num">${total}</div>
      <div class="stat-label">Total</div>
    </div>
    <div class="stat">
      <div class="stat-num">${active}</div>
      <div class="stat-label">Ativos</div>
    </div>
    <div class="stat">
      <div class="stat-num">${resolved}</div>
      <div class="stat-label">Resolvidos</div>
    </div>
    <div class="stat flag">
      <div class="stat-num">${flagged}</div>
      <div class="stat-label">Pra Vet</div>
    </div>
    <div class="stat urgent">
      <div class="stat-num">${severe}</div>
      <div class="stat-label">Graves</div>
    </div>
  </div>

  ${
    sorted.length === 0
      ? '<div class="empty">Nenhum sintoma registrado ainda.</div>'
      : `<table>
    <thead>
      <tr>
        <th>Quando</th>
        <th>Severidade</th>
        <th>Registro</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`
  }

  <div class="footer">
    ${
      isPro
        ? `Gerado pelo Maestro Pet Pro em ${today} &bull; maestropet.com`
        : `Gerado pelo Maestro Pet em ${today} &bull; maestropet.com &bull; <strong>Upgrade pra Pet Pro pra remover a marca d'água</strong>`
    }
  </div>
</body>
</html>`;
}

export async function exportSymptomsPdf(
  pet: Pet,
  symptoms: PetSymptom[],
  isPro = false,
): Promise<void> {
  const html = buildSymptomsHtml(pet, symptoms, isPro);

  if (Platform.OS === 'web') {
    // No web, renderiza o HTML diretamente em nova aba — usuário usa
    // Ctrl/Cmd+P pra salvar como PDF. Mais confiável que Print.printToFileAsync
    // que pode travar a página com diálogo bloqueante.
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) {
      throw new Error('Permita popups deste site pra gerar o PDF');
    }
    // Libera o blob URL depois que a aba abriu
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }

  // Nativo: gera PDF de verdade e abre o share sheet
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Sintomas — ${pet.name}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
