// Gera todos os PNG brandeados a partir dos SVGs em scripts/brand-icons/.
// Rodar: node scripts/brand-icons/generate.mjs
//
// Saída em assets/images/:
//   - icon.png (1024x1024)            — main app icon
//   - android-icon-foreground.png     — adaptive foreground 1024x1024
//   - android-icon-background.png     — solid orange 1024x1024 (#F97316)
//   - android-icon-monochrome.png     — Android 13+ themed 1024x1024
//   - splash-icon.png (1024x1024)     — splash centralizado
//   - favicon.png (48x48)             — fallback PNG do favicon

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SVG_DIR = __dirname;
const OUT_DIR = join(__dirname, '..', '..', 'assets', 'images');

async function renderSvgToPng(svgPath, outPath, size, opts = {}) {
  const svg = readFileSync(svgPath);
  let pipe = sharp(svg, { density: 600 }).resize(size, size, { fit: 'contain', background: opts.bg ?? { r: 0, g: 0, b: 0, alpha: 0 } });
  if (opts.flatten) pipe = pipe.flatten({ background: opts.bg });
  await pipe.png({ compressionLevel: 9 }).toFile(outPath);
  console.log(`  ✓ ${outPath} (${size}x${size})`);
}

async function generateSolidPng(outPath, size, color) {
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: color,
    },
  }).png({ compressionLevel: 9 }).toFile(outPath);
  console.log(`  ✓ ${outPath} solid ${size}x${size}`);
}

const ORANGE = { r: 0xf9, g: 0x73, b: 0x16, alpha: 1 };

console.log('Generating brand icons...');

await renderSvgToPng(join(SVG_DIR, 'icon.svg'), join(OUT_DIR, 'icon.png'), 1024);

await renderSvgToPng(
  join(SVG_DIR, 'foreground.svg'),
  join(OUT_DIR, 'android-icon-foreground.png'),
  1024,
);

await generateSolidPng(
  join(OUT_DIR, 'android-icon-background.png'),
  1024,
  ORANGE,
);

await renderSvgToPng(
  join(SVG_DIR, 'monochrome.svg'),
  join(OUT_DIR, 'android-icon-monochrome.png'),
  1024,
);

await renderSvgToPng(join(SVG_DIR, 'splash.svg'), join(OUT_DIR, 'splash-icon.png'), 1024);

await renderSvgToPng(join(SVG_DIR, 'icon.svg'), join(OUT_DIR, 'favicon.png'), 48);

// PWA icons em tamanhos específicos (192 e 512 são os principais — Expo lê do main icon mas
// alguns OS preferem variantes dedicadas).
await renderSvgToPng(join(SVG_DIR, 'icon.svg'), join(OUT_DIR, 'icon-192.png'), 192);
await renderSvgToPng(join(SVG_DIR, 'icon.svg'), join(OUT_DIR, 'icon-512.png'), 512);
await renderSvgToPng(join(SVG_DIR, 'icon.svg'), join(OUT_DIR, 'apple-touch-icon.png'), 180);

console.log('Done!');
