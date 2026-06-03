-- ============================================================================
-- PET AVATAR CONFIG — avatar customizado SVG (estilo Bitmoji do pet)
-- ============================================================================
-- Alternativa à foto real. Tutor monta seu pet escolhendo forma de cabeça,
-- orelhas, olhos, boca, padrão, cores, acessórios. Renderizado em runtime
-- via react-native-svg — zero asset binary.
--
-- Coexiste com avatar_url (foto) — o app usa a foto como principal e o
-- avatar customizado em telas de gamificação (conquistas, agenda, etc).
-- ============================================================================

alter table public.pets
  add column if not exists avatar_config jsonb;

-- Index pra buscar pets que têm avatar customizado (pra estatísticas/feed)
create index if not exists pets_has_avatar_config_idx
  on public.pets((avatar_config is not null))
  where avatar_config is not null;

notify pgrst, 'reload schema';
