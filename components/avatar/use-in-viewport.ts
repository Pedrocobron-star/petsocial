import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Hook que observa se um elemento está visível no viewport (web only via
 * IntersectionObserver). Em native, sempre retorna `true` — o parent precisa
 * controlar via outras estratégias (ex: FlatList `onViewableItemsChanged`).
 *
 * Uso:
 *   const [ref, inView] = useInViewport();
 *   return <View ref={ref}>{...}</View>;
 *
 * Quando o componente está fora do viewport, animações em loop devem pausar
 * pra economizar CPU/bateria — feed com 50 PostCards animados era um gargalo.
 *
 * `inView` inicia em true pra evitar flash de "sem animação" no primeiro paint.
 */
export function useInViewport(threshold = 0.1) {
  // ref tipado como any: no web vira HTMLDivElement, no native View
  const ref = useRef<unknown>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof IntersectionObserver === 'undefined') return;

    const node = ref.current as Element | null;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView] as const;
}
