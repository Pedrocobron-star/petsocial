-- ============================================================================
-- Maestro Pet — Coleta de arquivos de storage de um pet (limpeza ao excluir)
--
-- Problema: excluir um pet apaga as LINHAS (cascade de FK), mas os ARQUIVOS no
-- Supabase Storage (avatar, mídia de posts, fotos de saúde, e os DOCUMENTOS
-- PRIVADOS de exames) ficam órfãos. LGPD pede que os dados sumam de verdade.
--
-- Esta RPC junta, num round-trip, TODAS as referências de storage do pet:
--   - public_urls: URLs públicas (avatars/posts/pet-symptoms) — o bucket está
--     embutido na própria URL (/object/public/<bucket>/...).
--   - doc_paths: caminhos no bucket PRIVADO pet-documents (pet_documents.file_path).
-- O cliente então remove tudo (best-effort) ANTES de apagar a linha do pet.
--
-- Checa dono (auth.uid() = pets.owner_id) — não vaza caminho de pet alheio.
-- SECURITY DEFINER só pra ler as tabelas-filhas de forma uniforme.
-- ============================================================================

create or replace function public.pet_storage_refs(p_pet_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_urls text[] := '{}';
  v_docs text[] := '{}';
begin
  select owner_id into v_owner from public.pets where id = p_pet_id;
  if v_owner is null or v_owner <> auth.uid() then
    return jsonb_build_object('public_urls', '[]'::jsonb, 'doc_paths', '[]'::jsonb);
  end if;

  v_urls := v_urls || coalesce((select array_agg(avatar_url) from public.pets where id = p_pet_id and avatar_url is not null), '{}');
  v_urls := v_urls || coalesce((select array_agg(pm.url) from public.post_media pm join public.posts p on p.id = pm.post_id where p.pet_id = p_pet_id and pm.url is not null), '{}');
  v_urls := v_urls || coalesce((select array_agg(u) from public.vaccinations v, unnest(v.photo_urls) u where v.pet_id = p_pet_id), '{}');
  v_urls := v_urls || coalesce((select array_agg(u) from public.vet_visits vv, unnest(vv.photo_urls) u where vv.pet_id = p_pet_id), '{}');
  v_urls := v_urls || coalesce((select array_agg(u) from public.pet_symptoms s, unnest(s.photo_urls) u where s.pet_id = p_pet_id), '{}');
  v_urls := v_urls || coalesce((select array_agg(photo_url) from public.pet_milestones where pet_id = p_pet_id and photo_url is not null), '{}');
  v_urls := v_urls || coalesce((select array_agg(photo_url) from public.pet_event_logs where pet_id = p_pet_id and photo_url is not null), '{}');
  v_urls := v_urls || coalesce((select array_agg(u) from public.lost_reports lr, unnest(coalesce(lr.image_urls,'{}')) u where lr.pet_id = p_pet_id), '{}');
  v_urls := v_urls || coalesce((select array_agg(photo_url) from public.lost_reports where pet_id = p_pet_id and photo_url is not null), '{}');
  v_urls := v_urls || coalesce((select array_agg(video_url) from public.lost_reports where pet_id = p_pet_id and video_url is not null), '{}');

  select coalesce(array_agg(file_path), '{}') into v_docs from public.pet_documents where pet_id = p_pet_id and file_path is not null;

  return jsonb_build_object('public_urls', to_jsonb(v_urls), 'doc_paths', to_jsonb(v_docs));
end;
$$;
revoke all on function public.pet_storage_refs(uuid) from public, anon;
grant execute on function public.pet_storage_refs(uuid) to authenticated;

-- ============================================================================
-- FIM. O cliente (lib/pet-cleanup.ts) chama isso antes de deletePet e remove
-- os arquivos do storage (best-effort) pra não deixar órfãos.
-- ============================================================================
