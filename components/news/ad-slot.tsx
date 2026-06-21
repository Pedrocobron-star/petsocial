import { useEffect, useRef } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';

/**
 * Espaço de anúncio do Google AdSense — o Google preenche e paga.
 *
 * DORMENTE por padrão: só renderiza algo quando EXPO_PUBLIC_ADSENSE_CLIENT
 * (o seu ID de editor, ca-pub-XXXXXXXX) estiver configurado E o app rodando na
 * WEB. Sem isso, retorna null (nada aparece) — então já dá pra deixar os espaços
 * posicionados nas telas sem mostrar nada até a conta AdSense ser aprovada.
 *
 * Quando aprovar: setar EXPO_PUBLIC_ADSENSE_CLIENT no ambiente do Vercel e passar
 * o `slot` (id do bloco de anúncio criado no painel do AdSense) em cada <AdSlot/>.
 * A CSP (vercel.json) já libera os domínios do Google pros anúncios carregarem.
 */
const ADSENSE_CLIENT = process.env.EXPO_PUBLIC_ADSENSE_CLIENT || '';

export function AdSlot({ slot, style }: { slot?: string; style?: ViewStyle }) {
  const ref = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !ADSENSE_CLIENT) return;
    // 1) carrega o script do AdSense uma única vez
    const SCRIPT_ID = 'adsbygoogle-js';
    if (typeof document !== 'undefined' && !document.getElementById(SCRIPT_ID)) {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
      document.head.appendChild(s);
    }
    // 2) injeta o <ins> dentro do container (uma vez) e pede o anúncio
    const node = ref.current as unknown as HTMLElement | null;
    if (node && typeof node.querySelector === 'function' && !node.querySelector('ins.adsbygoogle')) {
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.style.width = '100%';
      ins.setAttribute('data-ad-client', ADSENSE_CLIENT);
      if (slot) ins.setAttribute('data-ad-slot', slot);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      node.appendChild(ins);
      try {
        // @ts-expect-error adsbygoogle é injetado pelo script do Google
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        /* ignora — o script pode ainda não ter carregado; recarrega no próximo */
      }
    }
  }, [slot]);

  if (Platform.OS !== 'web' || !ADSENSE_CLIENT) return null;
  return (
    <View
      ref={ref}
      style={[{ width: '100%', minHeight: 100, alignItems: 'center', justifyContent: 'center' }, style]}
    />
  );
}
