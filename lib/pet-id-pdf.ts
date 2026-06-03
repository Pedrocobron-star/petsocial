/**
 * Geração de PDF/imagem do Pet ID Card.
 * Estratégia: gera HTML com o layout completo do card (frente + verso) e usa
 * expo-print pra converter em PDF. Mesmo HTML serve pra preview no web.
 *
 * Pra "imagem" pra stories, geramos um HTML 9:16 e o usuário tira print ou
 * baixa o PDF e o Instagram aceita.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { speciesLabel } from './constants';
import { petAgeText } from './pet-age';
import type { Pet, Profile } from './types';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

function speciesEmoji(species: string): string {
  const m: Record<string, string> = {
    dog: '🐶',
    cat: '🐱',
    bird: '🐦',
    rabbit: '🐰',
    reptile: '🦎',
    rodent: '🐹',
    fish: '🐟',
    other: '🐾',
  };
  return m[species] ?? '🐾';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function buildSerial(pet: Pet): string {
  return (pet.id_card_token ?? pet.id).replace(/-/g, '').toUpperCase().slice(0, 12);
}

function buildQrSrc(qrUrl?: string | null): string | null {
  if (!qrUrl) return null;
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUrl)}&size=300x300&margin=4&color=1A1410&bgcolor=ffffff`;
}

/**
 * HTML formato A6 (passport size) — pra impressão / download PDF.
 * Layout horizontal de carteirinha, foto à esquerda + dados à direita.
 */
export function buildPetIdHtml(pet: Pet, tutor: Profile | null, qrUrl?: string | null): string {
  const today = new Date().toLocaleDateString('pt-BR');
  const serial = buildSerial(pet);
  const ageText = petAgeText(pet.birthdate);
  const qrSrc = buildQrSrc(qrUrl);

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Pet ID — ${escapeHtml(pet.name)}</title>
  <style>
    @page { size: A6 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      color: #1A1410;
      margin: 0;
      padding: 0;
      background: #FFFBF5;
    }
    .card {
      width: 100%;
      max-width: 420px;
      margin: 0 auto;
      background: #FFFBF5;
      border: 2px solid #1A1410;
      border-radius: 14px;
      overflow: hidden;
      position: relative;
      box-shadow: 0 8px 24px rgba(124,45,18,0.18);
    }
    .stripes { height: 4px; display: flex; }
    .stripes > div { flex: 1; }
    .stripes > div:nth-child(1) { background: #F97316; }
    .stripes > div:nth-child(2) { background: #FBBF24; }
    .stripes > div:nth-child(3) { background: #F97316; }
    .header {
      background: #1A1410;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .brand { display: flex; align-items: center; gap: 8px; }
    .brand .logo { font-size: 18px; }
    .brand .title { font-family: 'Fredoka', sans-serif; font-size: 13px; color: #FBBF24; letter-spacing: 1.4px; text-transform: uppercase; font-weight: 700; }
    .brand .subtitle { font-size: 8px; color: #D4D4D4; letter-spacing: 0.6px; font-weight: 700; margin-top: -2px; }
    .official { border: 1px solid #FBBF24; border-radius: 4px; padding: 2px 6px; }
    .official span { color: #FBBF24; font-size: 8px; letter-spacing: 0.8px; font-weight: 700; }

    .body {
      padding: 14px;
      display: flex;
      gap: 12px;
      position: relative;
    }
    .paw-decor {
      position: absolute;
      opacity: 0.05;
      pointer-events: none;
    }
    .paw-1 { top: 10px; right: 10px; font-size: 56px; transform: rotate(15deg); }
    .paw-2 { bottom: 4px; left: 90px; font-size: 36px; transform: rotate(-20deg); }

    .left { display: flex; flex-direction: column; gap: 6px; align-items: center; }
    .photo {
      width: 86px;
      height: 100px;
      border: 1.5px solid #1A1410;
      border-radius: 6px;
      background: #FFEDD5;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    .photo-placeholder { font-size: 44px; }

    .qr {
      padding: 4px;
      background: #fff;
      border-radius: 4px;
      border: 1px solid #1A1410;
    }
    .qr img { width: 72px; height: 72px; display: block; }

    .right { flex: 1; display: flex; flex-direction: column; gap: 6px; }
    .field-label {
      font-size: 7px;
      color: #737373;
      letter-spacing: 0.7px;
      text-transform: uppercase;
      font-weight: 700;
    }
    .field-value {
      font-size: 13px;
      color: #1A1410;
      font-weight: 700;
      margin-top: 0;
    }
    .field-name {
      font-family: 'Fredoka', sans-serif;
      font-size: 22px;
      letter-spacing: -0.6px;
    }
    .field-mono { letter-spacing: 1.2px; }

    .alerts {
      background: #FEE2E2;
      border-top: 1px solid #FCA5A5;
      border-bottom: 1px solid #FCA5A5;
      padding: 8px 14px;
    }
    .alerts .row { display: flex; gap: 6px; margin-bottom: 4px; }
    .alerts .row:last-child { margin-bottom: 0; }
    .alerts .row .icon { font-size: 14px; }
    .alerts .row .label {
      font-size: 8px;
      color: #991B1B;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      font-weight: 700;
    }
    .alerts .row .value { font-size: 11px; color: #7F1D1D; }

    .contacts {
      background: #FFF7ED;
      padding: 10px 14px;
    }
    .contacts .row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .contacts .row:last-child { margin-bottom: 0; }
    .contacts .icon-wrap {
      width: 22px;
      height: 22px;
      border-radius: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }
    .contacts .label {
      font-size: 7px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      font-weight: 700;
    }
    .contacts .value { font-size: 11px; font-weight: 700; color: #1A1410; }

    .footer {
      background: #1A1410;
      padding: 6px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer .serial { font-size: 8px; color: #A3A3A3; letter-spacing: 0.6px; font-weight: 700; }
    .footer .url { font-size: 7px; color: #737373; letter-spacing: 0.5px; }

    .verso {
      margin-top: 20px;
      page-break-before: avoid;
      border-top: 1px dashed #A3A3A3;
      padding-top: 12px;
    }
    .verso-title {
      font-size: 9px;
      color: #737373;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      font-weight: 700;
      margin-bottom: 8px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="stripes"><div></div><div></div><div></div></div>

    <div class="header">
      <div class="brand">
        <span class="logo">🐾</span>
        <div>
          <div class="title">Pet Social</div>
          <div class="subtitle">CARTEIRINHA DIGITAL DO PET</div>
        </div>
      </div>
      <div class="official"><span>REPÚBLICA PET · BR</span></div>
    </div>

    <div class="body">
      <span class="paw-decor paw-1">🐾</span>
      <span class="paw-decor paw-2">🐾</span>

      <div class="left">
        <div class="photo">
          ${pet.avatar_url
            ? `<img src="${escapeHtml(pet.avatar_url)}" alt="${escapeHtml(pet.name)}" />`
            : `<div class="photo-placeholder">${speciesEmoji(pet.species)}</div>`}
        </div>
        ${qrSrc ? `<div class="qr"><img src="${qrSrc}" alt="QR" /></div>` : ''}
      </div>

      <div class="right">
        <div>
          <div class="field-label">Nome</div>
          <div class="field-value field-name">${escapeHtml(pet.name)}</div>
        </div>
        <div>
          <div class="field-label">Espécie · Raça</div>
          <div class="field-value">${escapeHtml(speciesLabel(pet.species))}${pet.breed ? ` · ${escapeHtml(pet.breed)}` : ''}</div>
        </div>
        <div>
          <div class="field-label">Nascimento</div>
          <div class="field-value">${fmtDate(pet.birthdate)}${ageText ? ` (${ageText})` : ''}</div>
        </div>
        ${pet.microchip_number ? `<div>
          <div class="field-label">Microchip</div>
          <div class="field-value field-mono">${escapeHtml(pet.microchip_number)}</div>
        </div>` : ''}
        ${pet.rga_number ? `<div>
          <div class="field-label">RGA</div>
          <div class="field-value field-mono">${escapeHtml(pet.rga_number)}</div>
        </div>` : ''}
        ${pet.blood_type ? `<div>
          <div class="field-label">Tipo sanguíneo</div>
          <div class="field-value">${escapeHtml(pet.blood_type)}</div>
        </div>` : ''}
      </div>
    </div>

    ${pet.allergies || pet.known_conditions ? `<div class="alerts">
      ${pet.allergies ? `<div class="row">
        <span class="icon">⚠️</span>
        <div>
          <div class="label">Alergias</div>
          <div class="value">${escapeHtml(pet.allergies)}</div>
        </div>
      </div>` : ''}
      ${pet.known_conditions ? `<div class="row">
        <span class="icon">💊</span>
        <div>
          <div class="label">Condições registradas</div>
          <div class="value">${escapeHtml(pet.known_conditions)}</div>
        </div>
      </div>` : ''}
    </div>` : ''}

    <div class="contacts">
      <div class="row">
        <div class="icon-wrap" style="background:#FED7AA;">👤</div>
        <div>
          <div class="label" style="color:#9A3412;">Tutor(a)</div>
          <div class="value">${escapeHtml(tutor?.display_name ?? '—')}</div>
        </div>
      </div>
      ${pet.emergency_contact_phone ? `<div class="row">
        <div class="icon-wrap" style="background:#FECACA;">🚨</div>
        <div>
          <div class="label" style="color:#991B1B;">Emergência${pet.emergency_contact_name ? ` · ${escapeHtml(pet.emergency_contact_name)}` : ''}</div>
          <div class="value">${escapeHtml(pet.emergency_contact_phone)}</div>
        </div>
      </div>` : ''}
      ${pet.preferred_vet_name ? `<div class="row">
        <div class="icon-wrap" style="background:#DCFCE7;">🩺</div>
        <div>
          <div class="label" style="color:#166534;">Vet de confiança</div>
          <div class="value">${escapeHtml(pet.preferred_vet_name)}${pet.preferred_vet_phone ? ` · ${escapeHtml(pet.preferred_vet_phone)}` : ''}</div>
        </div>
      </div>` : ''}
    </div>

    <div class="footer">
      <div class="serial">Nº ${serial}</div>
      <div class="url">petsocial.app · não substitui RGA oficial</div>
    </div>
  </div>

  <div class="verso">
    <div class="verso-title">Documento gerado em ${today} · petsocial.app</div>
  </div>
</body>
</html>`;
}

/**
 * HTML formato 9:16 — pensado pra compartilhar em Stories.
 */
export function buildPetIdStoryHtml(pet: Pet, tutor: Profile | null, qrUrl?: string | null): string {
  const serial = buildSerial(pet);
  const ageText = petAgeText(pet.birthdate);
  const qrSrc = buildQrSrc(qrUrl);

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Story — ${escapeHtml(pet.name)}</title>
  <style>
    @page { size: 1080px 1920px; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; }
    .story {
      width: 1080px;
      height: 1920px;
      background: #FFEDD5;
      position: relative;
      overflow: hidden;
      color: #1A1410;
    }
    .paw { position: absolute; opacity: 0.07; pointer-events: none; }
    .p1 { top: 200px; left: -40px; font-size: 480px; transform: rotate(-10deg); }
    .p2 { top: 800px; right: -80px; font-size: 460px; transform: rotate(25deg); }
    .p3 { bottom: 800px; left: 100px; font-size: 360px; transform: rotate(15deg); opacity: 0.06; }
    .p4 { bottom: 240px; right: 80px; font-size: 400px; transform: rotate(-20deg); }

    .header { background:#1A1410; padding: 80px 60px 50px; text-align:center; }
    .header .stripes { position:absolute; top:0; left:0; right:0; height: 18px; display:flex; }
    .header .stripes > div { flex:1; }
    .header .stripes > div:nth-child(1) { background:#F97316; }
    .header .stripes > div:nth-child(2) { background:#FBBF24; }
    .header .stripes > div:nth-child(3) { background:#F97316; }
    .header .paw-em { font-size: 80px; }
    .header h1 { font-family:'Fredoka', sans-serif; font-size: 52px; color:#FBBF24; letter-spacing: 5px; text-transform: uppercase; margin: 6px 0; }
    .header .sub { font-size: 28px; color:#D4D4D4; letter-spacing: 3px; font-weight: 700; }

    .hero { text-align:center; padding: 60px 60px 30px; position:relative; z-index: 2; }
    .photo {
      width: 480px; height: 480px;
      border-radius: 50%;
      border: 14px solid #1A1410;
      background:#FED7AA;
      margin: 0 auto;
      overflow: hidden;
      display:flex; align-items:center; justify-content:center;
      box-shadow: 0 30px 60px rgba(124,45,18,0.3);
    }
    .photo img { width:100%; height:100%; object-fit: cover; }
    .photo .placeholder { font-size: 240px; }

    .name { font-family:'Fredoka', sans-serif; font-size: 110px; color:#1A1410; letter-spacing: -2px; margin: 40px 0 16px; }
    .chips { display:flex; flex-wrap: wrap; justify-content:center; gap: 14px; padding: 0 60px; }
    .chip { padding: 14px 28px; border-radius: 999px; font-weight: 700; font-size: 32px; }
    .chip-dark { background:#1A1410; color:#FBBF24; }
    .chip-gold { background:#FBBF24; color:#1A1410; }
    .chip-light { background:#fff; color:#1A1410; border: 3px solid #1A1410; }

    .info { padding: 40px 60px; display: flex; flex-direction: column; gap: 16px; position:relative; z-index:2; }
    .info-row {
      background:#fff; padding: 20px 24px; border-radius: 24px; display:flex; align-items:center; gap: 18px;
      border: 2px solid rgba(26,20,16,0.1);
    }
    .info-row .em { font-size: 44px; }
    .info-row .lbl { font-size: 22px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; opacity: 0.65; }
    .info-row .val { font-size: 36px; font-weight: 700; margin-top: 4px; }
    .info-row.alert { background:#FEE2E2; border-color:#FCA5A5; }
    .info-row.alert .lbl { color:#991B1B; opacity:1; }

    .footer {
      position: absolute; bottom: 0; left: 0; right: 0;
      background:#1A1410; padding: 60px 60px 80px;
      display: flex; align-items:center; gap: 30px;
    }
    .footer .qr { padding: 16px; background:#fff; border-radius: 22px; }
    .footer .qr img { width: 200px; height: 200px; display:block; }
    .footer .qr-empty {
      width: 232px; height: 232px;
      border-radius: 22px; background:#3D352D;
      display:flex; align-items:center; justify-content:center;
      font-size: 100px;
    }
    .footer .text { flex: 1; }
    .footer .text .top { font-size: 26px; color:#FBBF24; letter-spacing: 2.5px; text-transform: uppercase; font-weight: 700; }
    .footer .text .mid { font-family:'Fredoka', sans-serif; font-size: 44px; color:#fff; letter-spacing: -1px; margin: 8px 0; }
    .footer .text .low { font-size: 22px; color:#A3A3A3; }
    .footer .stripes { position:absolute; bottom:0; left:0; right:0; height: 18px; display:flex; }
    .footer .stripes > div { flex:1; }
    .footer .stripes > div:nth-child(1) { background:#F97316; }
    .footer .stripes > div:nth-child(2) { background:#FBBF24; }
    .footer .stripes > div:nth-child(3) { background:#F97316; }
    .serial-line {
      position: absolute; bottom: 24px; left: 60px; right: 60px;
      display:flex; justify-content: space-between;
      font-size: 18px; color: #525252; letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="story">
    <span class="paw p1">🐾</span>
    <span class="paw p2">🐾</span>
    <span class="paw p3">🐾</span>
    <span class="paw p4">🐾</span>

    <div class="header">
      <div class="stripes"><div></div><div></div><div></div></div>
      <div class="paw-em">🐾</div>
      <h1>Pet Social</h1>
      <div class="sub">CARTEIRINHA DIGITAL OFICIAL</div>
    </div>

    <div class="hero">
      <div class="photo">
        ${pet.avatar_url
          ? `<img src="${escapeHtml(pet.avatar_url)}" alt="${escapeHtml(pet.name)}" />`
          : `<div class="placeholder">${speciesEmoji(pet.species)}</div>`}
      </div>
      <div class="name">${escapeHtml(pet.name)}</div>
      <div class="chips">
        <div class="chip chip-dark">${speciesEmoji(pet.species)} ${escapeHtml(speciesLabel(pet.species))}</div>
        ${pet.breed ? `<div class="chip chip-gold">${escapeHtml(pet.breed)}</div>` : ''}
        ${ageText ? `<div class="chip chip-light">${escapeHtml(ageText)}</div>` : ''}
      </div>
    </div>

    <div class="info">
      ${pet.microchip_number ? `<div class="info-row">
        <div class="em">🔖</div>
        <div>
          <div class="lbl">Microchip</div>
          <div class="val">${escapeHtml(pet.microchip_number)}</div>
        </div>
      </div>` : ''}
      ${pet.rga_number ? `<div class="info-row">
        <div class="em">📋</div>
        <div>
          <div class="lbl">RGA</div>
          <div class="val">${escapeHtml(pet.rga_number)}</div>
        </div>
      </div>` : ''}
      ${pet.emergency_contact_phone ? `<div class="info-row alert">
        <div class="em">🚨</div>
        <div>
          <div class="lbl">Emergência</div>
          <div class="val">${escapeHtml(pet.emergency_contact_phone)}</div>
        </div>
      </div>` : ''}
      ${pet.preferred_vet_name ? `<div class="info-row">
        <div class="em">🩺</div>
        <div>
          <div class="lbl">Vet de confiança</div>
          <div class="val">${escapeHtml(pet.preferred_vet_name)}</div>
        </div>
      </div>` : ''}
    </div>

    <div class="footer">
      ${qrSrc
        ? `<div class="qr"><img src="${qrSrc}" alt="QR" /></div>`
        : `<div class="qr-empty">📱</div>`}
      <div class="text">
        <div class="top">Achou ${escapeHtml(pet.name)}?</div>
        <div class="mid">Aponte a câmera no QR</div>
        <div class="low">Conecta com ${escapeHtml(tutor?.display_name ?? 'o tutor')} 🐾</div>
      </div>
      <div class="stripes"><div></div><div></div><div></div></div>
    </div>
    <div class="serial-line">
      <span>Nº ${serial}</span>
      <span>petsocial.app</span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Gera PDF do Pet ID Card e abre share sheet pra salvar/compartilhar.
 */
export async function exportPetIdPdf(
  pet: Pet,
  tutor: Profile | null,
  qrUrl?: string | null,
): Promise<void> {
  const html = buildPetIdHtml(pet, tutor, qrUrl);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (Platform.OS === 'web') {
    window.open(uri, '_blank');
    return;
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Carteirinha — ${pet.name}`,
      UTI: 'com.adobe.pdf',
    });
  }
}

/**
 * Gera PDF do formato Story (1080x1920) — pra postar em Instagram/Status.
 * No iOS/Android o usuário pode tirar print do PDF ou salvar primeira página
 * como imagem via app de leitura.
 */
export async function exportPetIdStoryPdf(
  pet: Pet,
  tutor: Profile | null,
  qrUrl?: string | null,
): Promise<void> {
  const html = buildPetIdStoryHtml(pet, tutor, qrUrl);
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
    // Tamanho 1080x1920 em pontos (1pt = 1/72 inch)
    width: 1080,
    height: 1920,
  });
  if (Platform.OS === 'web') {
    window.open(uri, '_blank');
    return;
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Story — ${pet.name}`,
    });
  }
}
