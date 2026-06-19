// ============================================================================
// Maestro Pet — Injeta OG/Twitter/manifest no dist/index.html pós-export.
//
// POR QUE: com `web.output: "single"` o Expo gera o index.html a partir do
// app.json (title + description + theme-color) e IGNORA o app/+html.tsx. Logo
// o HTML servido na home NÃO tem og:image, twitter card, manifest link nem
// apple-touch-icon — compartilhar maestropet.com no WhatsApp/Insta/Face não
// mostra preview, e a instalação da PWA fica sem o link do manifesto.
//
// Este script roda DEPOIS do `expo export` (ver vercel.json buildCommand) e
// injeta esse bloco no <head>. Idempotente: se já tiver og:image, não mexe.
// Crawlers exigem URL ABSOLUTA na og:image, por isso o domínio fixo.
// ============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://maestropet.com';
const OG_IMAGE = `${SITE}/icon-512.png`;
const TITLE = 'Maestro Pet · Saúde do pet + comunidade · App grátis';
const DESC =
  'Calendário de vacinas, registro de sintomas, carteirinha digital e a comunidade pet do Brasil. Grátis pra cuidar do seu pet.';

const distIndex = join(process.cwd(), 'dist', 'index.html');

if (!existsSync(distIndex)) {
  console.error('[inject-og] dist/index.html não encontrado — rodou o expo export antes?');
  process.exit(1);
}

let html = readFileSync(distIndex, 'utf8');

if (html.includes('property="og:image"')) {
  console.log('[inject-og] og:image já presente — nada a fazer.');
  process.exit(0);
}

const block = `
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Maestro Pet" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="application-name" content="Maestro Pet" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1A1410" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Maestro Pet" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:url" content="${SITE}/" />
    <meta property="og:title" content="${TITLE}" />
    <meta property="og:description" content="${DESC}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${TITLE}" />
    <meta name="twitter:description" content="${DESC}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
    <link rel="canonical" href="${SITE}/" />
    <style>
      #boot-splash{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#FFFBF5;transition:opacity .35s ease}
      #boot-splash img{width:84px;height:84px;border-radius:50%}
      #boot-splash .boot-spin{margin-top:18px;width:30px;height:30px;border-radius:50%;border:3px solid #FDE6CF;border-top-color:#F97316;animation:bootspin .8s linear infinite}
      #boot-splash.hide{opacity:0;pointer-events:none}
      @keyframes bootspin{to{transform:rotate(360deg)}}
    </style>
  </head>`;

// Splash inline (mata a tela branca de 2-5s do bundle SPA). O React monta no
// #root; quando ele ganha conteúdo, escondemos. Fallback de 12s nunca prende.
const splash = `<div id="boot-splash"><img src="/mozart/rosto.png" alt="Maestro Pet" /><div class="boot-spin"></div></div>
<script>(function(){var mo;function hide(){if(mo){try{mo.disconnect();}catch(e){}}var s=document.getElementById('boot-splash');if(!s)return;s.classList.add('hide');setTimeout(function(){if(s&&s.parentNode)s.parentNode.removeChild(s);},400);}var done=false;function check(){if(done)return;var r=document.getElementById('root');if(r&&r.childElementCount>0){done=true;hide();}}try{mo=new MutationObserver(check);mo.observe(document.documentElement,{childList:true,subtree:true});}catch(e){}setTimeout(check,300);setTimeout(function(){done=true;hide();},12000);})();</script>
</body>`;

html = html.replace('</head>', block);
if (!html.includes('id="boot-splash"')) {
  html = html.replace('</body>', splash);
}

writeFileSync(distIndex, html, 'utf8');
console.log('[inject-og] OG/Twitter/manifest + boot-splash injetados em dist/index.html.');
