import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Pet, Vaccination } from './types';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

export function buildVaccinationHtml(pet: Pet, vaccines: Vaccination[], isPro = false): string {
  const today = new Date().toLocaleDateString('pt-BR');
  const sorted = [...vaccines].sort(
    (a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime(),
  );

  const rows = sorted
    .map(
      (v) => `
      <tr>
        <td><strong>${escapeHtml(v.name)}</strong></td>
        <td>${fmtDate(v.applied_at)}</td>
        <td>${fmtDate(v.next_dose_at)}</td>
        <td>${escapeHtml(v.vet_name ?? '—')}</td>
        <td>${escapeHtml(v.notes ?? '')}</td>
      </tr>
    `,
    )
    .join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Carteira de Vacinação — ${escapeHtml(pet.name)}</title>
  <style>
    @page { margin: 24px; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1A1410; margin: 0; padding: 24px; }
    .header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; padding-bottom: 18px; border-bottom: 3px solid #F97316; }
    .logo { font-size: 32px; }
    .brand { font-size: 18px; font-weight: 700; color: #F97316; letter-spacing: 0.5px; }
    .subtitle { font-size: 11px; color: #737373; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .meta { color: #525252; font-size: 13px; }
    .pet-card { background: #FFF7ED; padding: 16px; border-radius: 14px; margin-bottom: 18px; display: flex; gap: 16px; align-items: center; }
    .pet-emoji { font-size: 48px; }
    .pet-info h2 { margin: 0 0 4px; font-size: 22px; }
    .pet-info p { margin: 2px 0; font-size: 13px; color: #525252; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    thead th { background: #F97316; color: #fff; text-align: left; padding: 10px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; }
    tbody td { padding: 10px 8px; border-bottom: 1px solid #E5E5E5; vertical-align: top; }
    tbody tr:nth-child(even) { background: #FAFAFA; }
    .empty { padding: 24px; text-align: center; color: #737373; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #E5E5E5; font-size: 10px; color: #A3A3A3; text-align: center; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-orange { background: #FED7AA; color: #9A3412; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 120px; color: rgba(249, 115, 22, 0.08); font-weight: 700; pointer-events: none; z-index: -1; letter-spacing: 4px; }
  </style>
</head>
<body>
  ${!isPro ? '<div class="watermark">MAESTRO PET</div>' : ''}
  <div class="header">
    <div class="logo">🐾</div>
    <div>
      <div class="brand">Maestro Pet${isPro ? ' Pro ⭐' : ''}</div>
      <div class="subtitle">Carteira de Vacinação Digital</div>
    </div>
  </div>

  <div class="pet-card">
    <div class="pet-emoji">${emojiFor(pet.species)}</div>
    <div class="pet-info">
      <h2>${escapeHtml(pet.name)}</h2>
      <p>${speciesLabel(pet.species)}${pet.breed ? ` &bull; ${escapeHtml(pet.breed)}` : ''}</p>
      ${pet.birthdate ? `<p>Nascimento: ${fmtDate(pet.birthdate)}</p>` : ''}
      <p class="badge badge-orange">${vaccines.length} ${vaccines.length === 1 ? 'vacina registrada' : 'vacinas registradas'}</p>
    </div>
  </div>

  ${
    sorted.length === 0
      ? '<div class="empty">Nenhuma vacina registrada ainda.</div>'
      : `<table>
    <thead>
      <tr>
        <th>Vacina</th>
        <th>Aplicação</th>
        <th>Próxima dose</th>
        <th>Veterinário(a)</th>
        <th>Observações</th>
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
        ? `Documento gerado pelo Maestro Pet Pro em ${today} &bull; maestropet.com`
        : `Documento gerado pelo Maestro Pet em ${today} &bull; maestropet.com &bull; <strong>Upgrade pra Pet Pro pra remover a marca d'água</strong>`
    }
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
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

export async function exportVaccinationPdf(pet: Pet, vaccines: Vaccination[], isPro = false): Promise<void> {
  const html = buildVaccinationHtml(pet, vaccines, isPro);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (Platform.OS === 'web') {
    // No web, abrir em nova aba (uri é blob:)
    window.open(uri, '_blank');
    return;
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Carteira de vacinação — ${pet.name}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
