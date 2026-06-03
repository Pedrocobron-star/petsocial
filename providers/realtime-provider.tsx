import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

import { qk } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

import { useSession } from './session-provider';

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const qc = useQueryClient();

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;

    const notifChannel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: qk.unreadCount(userId) });
          qc.invalidateQueries({ queryKey: qk.notifications(userId) });
        },
      )
      .subscribe();

    // Mensagens chegando em qualquer conversa do user — invalida a lista
    // (Filtrar por conversation_id exigiria fetch das convs primeiro; o feed é leve.)
    const msgChannel = supabase
      .channel(`messages:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: { new: { conversation_id: string; sender_id: string } }) => {
          // Atualiza lista de conversas e contador
          qc.invalidateQueries({ queryKey: qk.conversations(userId) });
          qc.invalidateQueries({ queryKey: qk.unreadMessages(userId) });
          // E a janela do chat aberto, se for o caso
          if (payload?.new?.conversation_id) {
            qc.invalidateQueries({ queryKey: qk.messages(payload.new.conversation_id) });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [session?.user.id, qc]);

  return <>{children}</>;
}
