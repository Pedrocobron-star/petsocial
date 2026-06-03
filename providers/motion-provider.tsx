import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Preferência de animações:
 * - 'auto': respeita a configuração de "reduzir movimento" do SO
 * - 'on':   sempre animado (override do usuário)
 * - 'off':  sempre estático (override do usuário)
 */
export type MotionMode = 'auto' | 'on' | 'off';

const STORAGE_KEY = 'petsocial:motion-mode';

interface MotionContextValue {
  /** Preferência salva. */
  mode: MotionMode;
  /** Trocar preferência (persiste). */
  setMode: (m: MotionMode) => void;
  /** Resolvido: true se anima, false se pausado. */
  animationsEnabled: boolean;
  /** Preferência do SO (reduce motion). */
  systemReducedMotion: boolean;
}

const MotionContext = createContext<MotionContextValue | undefined>(undefined);

export function MotionProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<MotionMode>('auto');
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);

  // Carrega preferência persistida
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'auto' || v === 'on' || v === 'off') setModeState(v);
    });
  }, []);

  // Lê preferência do SO + escuta mudanças.
  // Web: usa matchMedia('(prefers-reduced-motion: reduce)') porque o
  // react-native-web AccessibilityInfo.isReduceMotionEnabled retorna false
  // sempre (não implementado). Native: usa a API real do RN.
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      setSystemReducedMotion(mql.matches);
      const handler = (e: MediaQueryListEvent) => setSystemReducedMotion(e.matches);
      // addEventListener é a API moderna; addListener é fallback pra Safari < 14.
      if (mql.addEventListener) {
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
      } else if (mql.addListener) {
        mql.addListener(handler);
        return () => mql.removeListener(handler);
      }
      return;
    }

    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => setSystemReducedMotion(on))
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (on) => setSystemReducedMotion(on),
    );
    return () => {
      sub?.remove?.();
    };
  }, []);

  const setMode = (next: MotionMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<MotionContextValue>(() => {
    const animationsEnabled =
      mode === 'on' ? true : mode === 'off' ? false : !systemReducedMotion;
    return { mode, setMode, animationsEnabled, systemReducedMotion };
  }, [mode, systemReducedMotion]);

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotion() {
  const ctx = useContext(MotionContext);
  if (!ctx) throw new Error('useMotion deve estar dentro de MotionProvider');
  return ctx;
}
