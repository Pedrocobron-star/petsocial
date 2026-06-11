-- =============================================================================
-- LOCKDOWN DE PRIVACIDADE — dados médicos/privados do pet
-- =============================================================================
-- Pedro pediu: o perfil público de um pet deve ser estilo Instagram (só os
-- posts). Nada médico nem o diário de OUTRO pet deve aparecer — nem na tela,
-- nem por link direto.
--
-- Brecha encontrada: estas tabelas tinham SELECT com `USING (true)` ("read
-- all") — QUALQUER usuário logado conseguia ler os dados de QUALQUER pet
-- abrindo o link direto (ex: /pet/ID/vacinas).
--
-- Fix: troca o "read all" por `public.can_view_pet(pet_id)` — que é
-- `owner_id = auth.uid() OR is_caretaker_of(pet_id)` (dono OU co-tutor aceito
-- que o dono convidou). As funções já existem (supabase/pet-caretakers.sql).
--
-- ARMADILHA evitada: nessas tabelas, a policy `*_caretaker_read` cobre só o
-- co-tutor (is_caretaker_of), NÃO o dono. O acesso do dono à leitura vinha
-- justamente do "read all". Por isso a nova policy usa can_view_pet (que
-- INCLUI o dono) — senão o dono perderia acesso ao próprio pet.
--
-- Escrita (INSERT/UPDATE/DELETE) NÃO é tocada aqui: continua governada pelas
-- policies de owner / is_caregiver_of já existentes.
--
-- Idempotente: pode rodar de novo sem efeito colateral.
-- =============================================================================

-- vacinas (médico)
drop policy if exists "vaccinations read all" on public.vaccinations;
drop policy if exists vaccinations_view on public.vaccinations;
create policy vaccinations_view on public.vaccinations
  for select to authenticated using (public.can_view_pet(pet_id));

-- antiparasitário / vermífugo (médico)
drop policy if exists "parasite_treatments read all" on public.parasite_treatments;
drop policy if exists parasite_treatments_view on public.parasite_treatments;
create policy parasite_treatments_view on public.parasite_treatments
  for select to authenticated using (public.can_view_pet(pet_id));

-- agenda do pet (banho, vet, passeio, escolinha…) — privado
drop policy if exists "pet_events read all" on public.pet_events;
drop policy if exists pet_events_view on public.pet_events;
create policy pet_events_view on public.pet_events
  for select to authenticated using (public.can_view_pet(pet_id));

-- logs da agenda ("deu banho hoje", "tomou remédio") — privado
drop policy if exists "pet_event_logs read all" on public.pet_event_logs;
drop policy if exists pet_event_logs_view on public.pet_event_logs;
create policy pet_event_logs_view on public.pet_event_logs
  for select to authenticated using (public.can_view_pet(pet_id));

-- diário do pet (pet_milestones = "marcos"/linha do tempo) — privado
drop policy if exists "pet_milestones read all" on public.pet_milestones;
drop policy if exists pet_milestones_view on public.pet_milestones;
create policy pet_milestones_view on public.pet_milestones
  for select to authenticated using (public.can_view_pet(pet_id));

-- =============================================================================
-- Nota: medications, vet_visits, weight_records, pet_symptoms, pet_diet_logs,
-- pet_health_snapshots, pet_documents, pet_expenses JÁ estavam restritas a
-- dono (e, onde aplicável, co-tutor via *_caretaker_read). Não precisam de fix.
-- =============================================================================

-- RPC pro client saber se pode ver a saúde do pet (dono OU co-tutor). Usada
-- pelo guard das telas médicas (hooks/use-pet-health-access) pra mostrar
-- "Informações privadas" ao visitante em vez de uma lista vazia confusa.
create or replace function public.can_view_pet_rpc(pet_uuid uuid)
returns boolean language sql security definer stable
set search_path = public as $$ select public.can_view_pet(pet_uuid) $$;
grant execute on function public.can_view_pet_rpc(uuid) to authenticated;
