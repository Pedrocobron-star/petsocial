import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { RatingPromptModal } from '@/components/rating-prompt-modal';
import { useSession } from '@/providers/session-provider';

/**
 * Mostra o pedido de avaliação do Mozart depois que o usuário já usou o app por
 * um tempo (~5 min acumulados) e voltou pelo menos uma vez (2ª sessão).
 * Aparece 1x; se adiar, volta em 7 dias; se avaliar, nunca mais.
 */

const STORE = {
  done: 'mp.rating.done',
  until: 'mp.rating.until',
  sessions: 'mp.rating.sessions',
  seconds: 'mp.rating.seconds',
};
const SESSION_FLAG = 'mp.rating.session-counted'; // sessionStorage (web)
const NEED_SESSIONS = 2;
const NEED_SECONDS = 300; // 5 min acumulados
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const TICK_MS = 20000;

function isHiddenWeb(): boolean {
  return Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden;
}

export function RatingPromptProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id;
  const [show, setShow] = useState(false);
  const secondsRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function init() {
      const done = await AsyncStorage.getItem(STORE.done);
      if (done === '1') {
        doneRef.current = true;
        return;
      }

      // Conta a sessão uma vez por sessão de navegador (web) / por cold start (native)
      let alreadyCounted = false;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
        alreadyCounted = window.sessionStorage.getItem(SESSION_FLAG) === '1';
        if (!alreadyCounted) window.sessionStorage.setItem(SESSION_FLAG, '1');
      }
      let sessions = Number((await AsyncStorage.getItem(STORE.sessions)) || '0');
      if (!alreadyCounted) {
        sessions += 1;
        await AsyncStorage.setItem(STORE.sessions, String(sessions));
      }

      secondsRef.current = Number((await AsyncStorage.getItem(STORE.seconds)) || '0');

      const check = async () => {
        if (cancelled || doneRef.current) return;
        const untilRaw = await AsyncStorage.getItem(STORE.until);
        const until = Number(untilRaw || '0');
        if (until > Date.now()) return; // adiado
        if (sessions >= NEED_SESSIONS && secondsRef.current >= NEED_SECONDS) {
          setShow(true);
          if (interval) clearInterval(interval);
        }
      };

      interval = setInterval(async () => {
        if (cancelled || doneRef.current) return;
        if (!isHiddenWeb()) {
          secondsRef.current += TICK_MS / 1000;
          await AsyncStorage.setItem(STORE.seconds, String(Math.round(secondsRef.current)));
        }
        await check();
      }, TICK_MS);

      // checa logo de cara (caso já tenha tempo acumulado de sessões anteriores)
      await check();
    }

    init();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [userId]);

  async function handleSnooze() {
    setShow(false);
    await AsyncStorage.setItem(STORE.until, String(Date.now() + SNOOZE_MS));
  }

  async function handleSubmitted() {
    setShow(false);
    doneRef.current = true;
    await AsyncStorage.setItem(STORE.done, '1');
  }

  return (
    <>
      {children}
      <RatingPromptModal
        visible={show}
        onSnooze={handleSnooze}
        onSubmitted={handleSubmitted}
        trigger="time_online_5min"
      />
    </>
  );
}
