-- ============================================================================
-- ADMIN DA ECONOMIA — visibilidade/controle dos Pontos de Tutor, do prêmio
-- mensal e do referral (que rodavam às cegas no cron, sem nenhuma tela admin).
--
-- Tudo is_admin-gated (SECURITY DEFINER). Ler ledger/clusters de terceiros é
-- privilégio de admin — as tabelas tutor_points / profiles têm RLS restrita.
-- Ver [[tutor-points-ledger]] + [[security_referral_hole]].
--
-- Idempotente. Aplicar depois de tutor-points-ledger.sql + referral-antifraud.sql.
-- ============================================================================

-- ---------- ranking de Pontos de Tutor (vitalício) ----------
create or replace function public.admin_tutor_points_leaderboard(p_limit int default 50)
returns table (user_id uuid, display_name text, email text, total_pt int, entries int, last_at timestamptz)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select tp.user_id, pr.display_name, u.email::text,
         sum(tp.points)::int, count(*)::int, max(tp.created_at)
  from public.tutor_points tp
  left join public.profiles pr on pr.id = tp.user_id
  left join auth.users u on u.id = tp.user_id
  group by tp.user_id, pr.display_name, u.email
  order by sum(tp.points) desc, max(tp.created_at) desc
  limit p_limit;
end;
$$;
revoke all on function public.admin_tutor_points_leaderboard(int) from public, anon;
grant execute on function public.admin_tutor_points_leaderboard(int) to authenticated;

-- ---------- histórico de campeões mensais (+ note) ----------
create or replace function public.admin_monthly_champions(p_limit int default 24)
returns table (month_start date, user_id uuid, display_name text, email text, points int, note text, awarded_at timestamptz)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select w.month_start, w.user_id, pr.display_name, u.email::text, w.points, w.note, w.awarded_at
  from public.mission_monthly_winners w
  left join public.profiles pr on pr.id = w.user_id
  left join auth.users u on u.id = w.user_id
  order by w.month_start desc
  limit p_limit;
end;
$$;
revoke all on function public.admin_monthly_champions(int) from public, anon;
grant execute on function public.admin_monthly_champions(int) to authenticated;

-- ---------- premiar campeão MANUALMENTE (meses sem campeão elegível) ----------
-- O gate anti-Sybil pode deixar um mês sem campeão (grava note). Aqui o admin
-- concede 1 mês de Pro a um tutor que ele julgou legítimo, registrando tudo.
create or replace function public.admin_award_monthly_winner_manual(p_month_start date, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_mozart uuid := 'd0c0ffee-0000-4000-8000-00000000cafe';
  v_conv uuid;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  -- concede 1 mês de Pro (mesmo upsert do cron)
  update public.subscriptions
  set status = 'active', plan = 'monthly', current_period_start = now(),
      current_period_end = now() + interval '30 days', cancel_at_period_end = false,
      granted_by_admin = true, granted_by_admin_email = 'admin:campeao-manual',
      granted_at = now(), updated_at = now()
  where user_id = p_user_id;
  if not found then
    insert into public.subscriptions
      (user_id, status, plan, current_period_start, current_period_end, granted_by_admin, granted_by_admin_email, granted_at)
    values
      (p_user_id, 'active', 'monthly', now(), now() + interval '30 days', true, 'admin:campeao-manual', now());
  end if;

  -- registra/atualiza o campeão do mês (sobrescreve um 'sem campeão' anterior)
  insert into public.mission_monthly_winners (month_start, user_id, points, note)
  values (p_month_start, p_user_id, 0, 'premiado manualmente pelo admin')
  on conflict (month_start) do update
    set user_id = excluded.user_id, note = excluded.note, awarded_at = now();

  -- notificação + DM do Mozart (voz fofa, sem travessão)
  insert into public.notifications (user_id, kind, title, body, url, created_at)
  values (p_user_id, 'broadcast', 'Você ganhou 1 mês de Pet Pro! 🏆',
    'um presentinho especial da equipe do Maestro Pet. aproveita 🎉', '/pro', now());

  select c.id into v_conv
  from public.conversations c
  join public.conversation_participants p1 on p1.conversation_id = c.id and p1.user_id = p_user_id
  join public.conversation_participants p2 on p2.conversation_id = c.id and p2.user_id = v_mozart
  limit 1;
  if v_conv is null then
    insert into public.conversations (last_message_at) values (now()) returning id into v_conv;
    insert into public.conversation_participants (conversation_id, user_id, last_read_at)
    values (v_conv, p_user_id, '1970-01-01T00:00:00Z'), (v_conv, v_mozart, now());
  end if;
  insert into public.messages (conversation_id, sender_id, content)
  values (v_conv, v_mozart,
    'au au! voce ganhou 1 mes de Pet Pro de presente da equipe! to muito feliz por voce. aproveita bastante! 🏆🐾');

  perform public.log_admin_action('award_manual', 'monthly_winner', p_user_id, jsonb_build_object('month_start', p_month_start));
end;
$$;
revoke all on function public.admin_award_monthly_winner_manual(date, uuid) from public, anon;
grant execute on function public.admin_award_monthly_winner_manual(date, uuid) to authenticated;

-- ---------- monitor de referral (clusters suspeitos) ----------
-- Lista indicadores com nº de indicados convertidos / pendentes, pra flagrar
-- quem está farmando contas-fantasma (muitos convertidos em pouco tempo).
create or replace function public.admin_referral_monitor(p_limit int default 50)
returns table (
  referrer_id uuid, display_name text, email text,
  converted int, pending int, last_reward timestamptz
)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select p.referred_by,
         pr.display_name, u.email::text,
         count(*) filter (where p.referral_reward_granted)::int as converted,
         count(*) filter (where not p.referral_reward_granted and p.referral_pending_since is not null)::int as pending,
         max(p.referral_rewarded_at) as last_reward
  from public.profiles p
  left join public.profiles pr on pr.id = p.referred_by
  left join auth.users u on u.id = p.referred_by
  where p.referred_by is not null
  group by p.referred_by, pr.display_name, u.email
  order by converted desc, pending desc
  limit p_limit;
end;
$$;
revoke all on function public.admin_referral_monitor(int) from public, anon;
grant execute on function public.admin_referral_monitor(int) to authenticated;
