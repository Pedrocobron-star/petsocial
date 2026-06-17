-- ============================================================================
-- Maestro Pet — Push de INTERAÇÃO com app FECHADO
--
-- Problema (relatado pelo Pedro): "as notificações só chegam quando o app está
-- aberto". Diagnóstico: like/comment/follow/mention/pet_tagged são gravados na
-- tabela `notifications` por triggers/RPCs, mas NADA dispara a edge `send-web-push`.
-- Logo, com o app fechado, o device offline nunca recebe o push — o usuário só vê
-- a notificação quando reabre o app. (Vacinas, broadcast e matéria nova JÁ disparam
-- push porque têm suas próprias funções que chamam net.http_post.)
--
-- Solução: trigger AFTER INSERT em `notifications` que, para os kinds de INTERAÇÃO,
-- chama a edge `send-web-push` (mesmo padrão de notify_due_care / dispatch_scheduled
-- / news_notify_on_publish). NÃO cobre 'broadcast' (já se auto-dispara → evita push
-- duplicado).
--
-- Idempotente. Aplicar DEPOIS de push-harden.sql (precisa de app_secrets.push_secret).
-- ============================================================================

create or replace function public.notify_interaction_push()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_url text := 'https://aefrcwysifgniogumxwk.supabase.co/functions/v1/send-web-push';
  v_secret text;
  v_actor text;
  v_title text;
  v_body text;
  v_tag text;
begin
  -- Só os kinds de interação (broadcast já dispara seu próprio push).
  if new.kind not in ('like', 'comment', 'follow', 'mention', 'pet_tagged') then
    return new;
  end if;

  -- Sem subscription ativa → não há pra onde enviar (poupa chamada à edge).
  if not exists (select 1 from public.push_subscriptions ps where ps.user_id = new.user_id) then
    return new;
  end if;

  -- Segredo interno exigido pela edge (header x-petsocial-secret).
  select value into v_secret from public.app_secrets where key = 'push_secret';
  if v_secret is null then
    return new;
  end if;

  -- Nome do pet que gerou a interação (pra mensagem ficar pessoal).
  select name into v_actor from public.pets where id = new.actor_pet_id;
  v_actor := coalesce(nullif(trim(v_actor), ''), 'Alguém');

  v_title := case new.kind
    when 'like'       then '👍 Nova curtida'
    when 'comment'    then '💬 Novo comentário'
    when 'follow'     then '🐾 Novo seguidor'
    when 'mention'    then '🔔 Você foi mencionado'
    when 'pet_tagged' then '🏷️ Seu pet foi marcado'
    else 'Maestro Pet 🐾'
  end;

  v_body := case new.kind
    when 'like'       then v_actor || ' curtiu seu post'
    when 'comment'    then v_actor || ' comentou no seu post'
    when 'follow'     then v_actor || ' começou a seguir você'
    when 'mention'    then v_actor || ' mencionou você num post'
    when 'pet_tagged' then v_actor || ' marcou seu pet num post'
    else 'Você tem uma nova notificação'
  end;

  -- Agrupa por kind+post (ou kind+ator no follow) pra não inundar a bandeja.
  v_tag := new.kind || '-' || coalesce(new.post_id::text, new.actor_pet_id::text, new.id::text);

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-petsocial-secret', v_secret),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'title', v_title,
      'body', v_body,
      'url', '/notifications',
      'tag', v_tag
    )
  );

  return new;
end;
$$;

drop trigger if exists notifications_push_on_insert on public.notifications;
create trigger notifications_push_on_insert
  after insert on public.notifications
  for each row execute function public.notify_interaction_push();

-- ============================================================================
-- FIM. Após aplicar: curtir/comentar/seguir/mencionar/marcar dispara push pro
-- device do destinatário mesmo com o app fechado (se ele tiver subscription).
-- Pré-requisitos (já existentes p/ os outros pushes): edge send-web-push
-- deployada + secrets VAPID + app_secrets.push_secret.
-- ============================================================================
