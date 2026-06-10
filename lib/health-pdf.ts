/**
 * Prontuário de Saúde completo em PDF (A4) — agrega TUDO num documento só pra
 * o tutor levar/mandar pro veterinário: identificação, alergias/condições,
 * vacinas, antiparasitários, medicações em uso, consultas, sintomas, peso e
 * exames/laudos. Leva um QR que abre a carteirinha pública (/id/[token]) —
 * identidade verificável sem expor o histórico por URL adivinhável.
 *
 * Mesmo mecanismo do pet-id-pdf.ts: expo-print → no web abre o PDF (Salvar
 * como PDF), no nativo abre a folha de compartilhamento. NÃO é diagnóstico —
 * é organização do histórico pro profissional avaliar.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { speciesLabel } from './constants';
import { documentKindMeta, fetchPetDocuments, type PetDocument } from './documents';
import { petAgeText } from './pet-age';
import {
  fetchMedications,
  fetchParasiteTreatments,
  fetchPetSymptoms,
  fetchVaccinations,
  fetchVetVisits,
  fetchWeightRecords,
} from './queries';
import { petIdCardUrl } from './share';
import type {
  MedicationWithLogs,
  ParasiteTreatment,
  Pet,
  PetSymptom,
  Vaccination,
  VetVisit,
  WeightRecord,
} from './types';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function speciesEmoji(species: string): string {
  const m: Record<string, string> = {
    dog: '🐶', cat: '🐱', bird: '🐦', rabbit: '🐰', reptile: '🦎', rodent: '🐹', fish: '🐟', other: '🐾',
  };
  return m[species] ?? '🐾';
}

const PARASITE_KIND: Record<string, string> = {
  internal: 'Vermífugo',
  external: 'Antipulgas/carrapatos',
  heartworm: 'Dirofilariose',
  combined: 'Combinado',
};

const FREQ_LABEL: Record<string, string> = {
  once_daily: '1x ao dia',
  twice_daily: '2x ao dia',
  three_daily: '3x ao dia',
  every_other_day: 'dia sim, dia não',
  weekly: 'semanal',
  monthly: 'mensal',
  as_needed: 'quando necessário',
};

function row(cells: string[]): string {
  return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
}

function section(title: string, headers: string[], rows: string[], emptyMsg: string): string {
  const head = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  const body = rows.length ? rows.join('') : `<tr><td colspan="${headers.length}" class="empty">${emptyMsg}</td></tr>`;
  return `<section>
    <h2>${title}</h2>
    <table><thead>${head}</thead><tbody>${body}</tbody></table>
  </section>`;
}

interface RecordData {
  pet: Pet;
  tutorName: string | null;
  vaccines: Vaccination[];
  parasites: ParasiteTreatment[];
  meds: MedicationWithLogs[];
  visits: VetVisit[];
  symptoms: PetSymptom[];
  weights: WeightRecord[];
  docs: PetDocument[];
}

export function buildHealthRecordHtml(data: RecordData): string {
  const { pet, tutorName } = data;
  const today = new Date().toLocaleDateString('pt-BR');
  const ageText = petAgeText(pet.birthdate);
  const qrUrl = pet.id_card_token ? petIdCardUrl(pet.id_card_token) : null;
  const qrSrc = qrUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUrl)}&size=240x240&margin=4&color=1A1410&bgcolor=ffffff`
    : null;

  const vaccinesRows = data.vaccines.map((v) =>
    row([esc(v.name), fmtDate(v.applied_at), fmtDate(v.next_dose_at), esc(v.vet_name) || '—']),
  );
  const parasitesRows = data.parasites.map((p) =>
    row([PARASITE_KIND[p.kind] ?? p.kind, esc(p.product_name), fmtDate(p.applied_at), fmtDate(p.next_due_at)]),
  );
  const medsActive = data.meds.filter((m) => m.active);
  const medsRows = medsActive.map((m) =>
    row([esc(m.name), esc(m.dosage) || '—', FREQ_LABEL[m.frequency] ?? esc(m.frequency)]),
  );
  const visitsRows = data.visits.slice(0, 12).map((v) =>
    row([
      fmtDate(v.visited_at),
      `${esc(v.clinic_name) || '—'}${v.vet_name ? `<br><span class="muted">${esc(v.vet_name)}</span>` : ''}`,
      esc(v.reason) || '—',
      esc(v.diagnosis) || '—',
      v.weight_kg != null ? `${v.weight_kg} kg` : '—',
    ]),
  );
  const symptomsRows = data.symptoms.slice(0, 15).map((s) =>
    row([
      fmtDate(s.recorded_at),
      esc(s.description),
      `${s.severity}/5`,
      esc(s.body_part) || '—',
      s.flagged_for_vet ? '⚠️ sim' : '—',
    ]),
  );
  const weightsRows = data.weights.slice(0, 12).map((w) =>
    row([fmtDate(w.weighed_at), `${w.weight_kg} kg`, esc(w.notes) || '—']),
  );
  const docsRows = data.docs.slice(0, 30).map((d) => {
    const meta = documentKindMeta(d.kind);
    return row([`${meta.emoji} ${meta.label}`, esc(d.title), fmtDate(d.doc_date)]);
  });

  const alertsHtml =
    pet.allergies || pet.known_conditions
      ? `<div class="alerts">
          ${pet.allergies ? `<div class="alert"><strong>⚠️ Alergias:</strong> ${esc(pet.allergies)}</div>` : ''}
          ${pet.known_conditions ? `<div class="alert"><strong>💊 Condições:</strong> ${esc(pet.known_conditions)}</div>` : ''}
        </div>`
      : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Prontuário — ${esc(pet.name)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; color: #1A1410; margin: 0; }
  .top { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #1A1410; padding-bottom: 12px; }
  .photo { width: 74px; height: 74px; border-radius: 12px; border: 2px solid #1A1410; background: #FFEDD5; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .photo img { width: 100%; height: 100%; object-fit: cover; }
  .photo .ph { font-size: 40px; }
  .top .id { flex: 1; }
  .brandline { font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase; font-weight: 700; color: #C2410C; }
  .petname { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin: 2px 0; }
  .meta { font-size: 12px; color: #525252; }
  .qr { text-align: center; flex-shrink: 0; }
  .qr img { width: 78px; height: 78px; border: 1px solid #1A1410; border-radius: 8px; padding: 3px; background: #fff; }
  .qr .cap { font-size: 8px; color: #737373; margin-top: 3px; max-width: 84px; line-height: 1.2; }
  .identity { display: flex; flex-wrap: wrap; gap: 6px 22px; margin: 12px 0; font-size: 12px; }
  .identity span b { color: #1A1410; }
  .identity span { color: #525252; }
  .alerts { margin: 8px 0 4px; }
  .alert { background: #FEE2E2; border: 1px solid #FCA5A5; color: #7F1D1D; border-radius: 8px; padding: 7px 11px; font-size: 12px; margin-bottom: 6px; }
  section { margin-top: 16px; page-break-inside: avoid; }
  h2 { font-size: 13px; letter-spacing: 0.4px; text-transform: uppercase; color: #C2410C; border-bottom: 1.5px solid #FDBA74; padding-bottom: 4px; margin: 0 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; font-size: 9px; letter-spacing: 0.5px; text-transform: uppercase; color: #737373; padding: 4px 8px; border-bottom: 1px solid #E5E5E5; }
  td { padding: 5px 8px; border-bottom: 1px solid #F1ECE5; vertical-align: top; }
  td.empty { color: #A3A3A3; font-style: italic; text-align: center; padding: 10px; }
  .muted { color: #737373; font-size: 10px; }
  footer { margin-top: 22px; border-top: 1px solid #E5E5E5; padding-top: 10px; font-size: 10px; color: #737373; line-height: 1.5; }
  footer b { color: #1A1410; }
</style>
</head>
<body>
  <div class="top">
    <div class="photo">
      ${pet.avatar_url ? `<img src="${esc(pet.avatar_url)}" alt="${esc(pet.name)}" />` : `<div class="ph">${speciesEmoji(pet.species)}</div>`}
    </div>
    <div class="id">
      <div class="brandline">Maestro Pet · Prontuário de saúde</div>
      <div class="petname">${esc(pet.name)}</div>
      <div class="meta">${esc(speciesLabel(pet.species))}${pet.breed ? ` · ${esc(pet.breed)}` : ''}${ageText ? ` · ${esc(ageText)}` : ''}</div>
    </div>
    ${qrSrc ? `<div class="qr"><img src="${qrSrc}" alt="QR carteirinha" /><div class="cap">Carteirinha verificável</div></div>` : ''}
  </div>

  <div class="identity">
    <span><b>Nascimento:</b> ${fmtDate(pet.birthdate)}</span>
    ${pet.microchip_number ? `<span><b>Microchip:</b> ${esc(pet.microchip_number)}</span>` : ''}
    ${pet.rga_number ? `<span><b>RGA:</b> ${esc(pet.rga_number)}</span>` : ''}
    ${pet.blood_type ? `<span><b>Tipo sanguíneo:</b> ${esc(pet.blood_type)}</span>` : ''}
    ${tutorName ? `<span><b>Tutor(a):</b> ${esc(tutorName)}</span>` : ''}
    ${pet.preferred_vet_name ? `<span><b>Vet de confiança:</b> ${esc(pet.preferred_vet_name)}</span>` : ''}
  </div>

  ${alertsHtml}

  ${section('💉 Vacinas', ['Vacina', 'Aplicada', 'Próxima', 'Veterinário'], vaccinesRows, 'Nenhuma vacina registrada')}
  ${section('🪲 Antiparasitários', ['Tipo', 'Produto', 'Aplicado', 'Próximo'], parasitesRows, 'Nenhum antiparasitário registrado')}
  ${section('💊 Medicações em uso', ['Medicação', 'Dose', 'Frequência'], medsRows, 'Nenhuma medicação ativa')}
  ${section('🩺 Consultas', ['Data', 'Clínica / Vet', 'Motivo', 'Diagnóstico', 'Peso'], visitsRows, 'Nenhuma consulta registrada')}
  ${section('📝 Sintomas registrados', ['Data', 'Descrição', 'Grau', 'Local', 'Pro vet'], symptomsRows, 'Nenhum sintoma registrado')}
  ${section('⚖️ Histórico de peso', ['Data', 'Peso', 'Obs.'], weightsRows, 'Nenhum peso registrado')}
  ${section('📎 Exames & laudos', ['Tipo', 'Título', 'Data'], docsRows, 'Nenhum documento anexado')}

  <footer>
    <b>Documento gerado pelo Maestro Pet em ${today}.</b><br>
    Este prontuário organiza o histórico informado pelo tutor e <b>não substitui a avaliação veterinária presencial</b> nem constitui orientação clínica. Aponte a câmera no QR pra abrir a carteirinha verificável do pet.
  </footer>
</body>
</html>`;
}

/** Busca todos os dados de saúde do pet e gera/compartilha o PDF do prontuário. */
export async function exportHealthRecordPdf(pet: Pet, tutorName?: string | null): Promise<void> {
  const [vaccines, parasites, meds, visits, symptoms, weights, docs] = await Promise.all([
    fetchVaccinations(pet.id).catch(() => [] as Vaccination[]),
    fetchParasiteTreatments(pet.id).catch(() => [] as ParasiteTreatment[]),
    fetchMedications(pet.id).catch(() => [] as MedicationWithLogs[]),
    fetchVetVisits(pet.id).catch(() => [] as VetVisit[]),
    fetchPetSymptoms(pet.id, 'all').catch(() => [] as PetSymptom[]),
    fetchWeightRecords(pet.id).catch(() => [] as WeightRecord[]),
    fetchPetDocuments(pet.id).catch(() => [] as PetDocument[]),
  ]);

  const html = buildHealthRecordHtml({
    pet,
    tutorName: tutorName ?? null,
    vaccines,
    parasites,
    meds,
    visits,
    symptoms,
    weights,
    docs,
  });

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (Platform.OS === 'web') {
    window.open(uri, '_blank');
    return;
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Prontuário — ${pet.name}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
