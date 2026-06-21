-- ============================================================================
-- Maestro Pet -- Admin: visibilidade de PAGAMENTOS (Cakto) + receita
-- cakto_events so e legivel por service_role; estas RPCs (is_admin) abrem a
-- leitura pro painel. Vendas Cakto sao AVULSAS (Pix/cartao), nao assinatura.
-- O estorno do dinheiro continua no painel do Cakto; aqui o admin VE tudo e
-- pode revogar o Pro do usuario (via admin_revoke_pro, ja existente).
-- Idempotente. ASCII-only.
-- ============================================================================

-- ---- LISTA de eventos Cakto (com email/order/valor/resultado) --------------
create or replace function public.admin_cakto_events(
  p_limit int default 100, p_offset int default 0, p_search text default null
)
returns table (
  id uuid, created_at timestamptz, event text, email text,
  order_id text, amount numeric, result text, matched_user uuid
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select e.id, e.created_at, e.event, e.email, e.order_id, e.amount, e.result, e.matched_user
    from public.cakto_events e
    where (p_search is null
           or e.email ilike '%' || p_search || '%'
           or e.order_id ilike '%' || p_search || '%'
           or e.event ilike '%' || p_search || '%')
    order by e.created_at desc
    limit greatest(1, least(p_limit, 500)) offset greatest(0, p_offset);
end;
$$;
revoke all on function public.admin_cakto_events(int, int, text) from public, anon;
grant execute on function public.admin_cakto_events(int, int, text) to authenticated;

-- ---- RESUMO de receita (dedup por order, so vendas que casaram usuario) -----
create or replace function public.admin_cakto_revenue()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with sales as (
    -- uma venda por order (dedup); so eventos que casaram um usuario e nao sao estorno
    select coalesce(order_id, id::text) as oid,
           max(amount) as amount,
           max(created_at) as at
    from public.cakto_events
    where matched_user is not null
      and amount is not null and amount > 0
      and coalesce(event, '') !~* '(refund|charge|estorno|cancel)'
    group by coalesce(order_id, id::text)
  )
  select jsonb_build_object(
    'total_revenue', coalesce(sum(amount), 0),
    'sales_count', count(*),
    'rev_30d', coalesce(sum(amount) filter (where at >= now() - interval '30 days'), 0),
    'sales_30d', count(*) filter (where at >= now() - interval '30 days'),
    'rev_7d', coalesce(sum(amount) filter (where at >= now() - interval '7 days'), 0),
    'rev_today', coalesce(sum(amount) filter (where at >= date_trunc('day', now())), 0),
    'avg_ticket', case when count(*) > 0 then round(avg(amount)::numeric, 2) else 0 end,
    'refunds', (select count(*) from public.cakto_events where coalesce(event,'') ~* '(refund|charge|estorno)'),
    'active_pro_paid', (select count(*) from public.subscriptions
                          where cakto_order_id is not null and status = 'active' and current_period_end > now())
  ) into v
  from sales;
  return v;
end;
$$;
revoke all on function public.admin_cakto_revenue() from public, anon;
grant execute on function public.admin_cakto_revenue() to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- READ-BACK: select count(*) from pg_proc where proname in
--   ('admin_cakto_events','admin_cakto_revenue'); -- 2
-- ============================================================================
