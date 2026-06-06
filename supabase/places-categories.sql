-- ============================================================================
-- Novas categorias de lugares pet-friendly: Restaurante, Café, Evento, Praia
-- Rode no Supabase SQL Editor. Idempotente.
-- (As categorias antigas — vet, pet_shop, hotel, daycare, park, grooming,
--  training, other — já funcionam sem rodar isto. Este SQL libera as 4 novas.)
-- ============================================================================

-- 1) Amplia o CHECK da coluna kind pra aceitar as 4 categorias novas
alter table public.places drop constraint if exists places_kind_check;
alter table public.places add constraint places_kind_check
  check (kind in (
    'vet','pet_shop','hotel','daycare','park','grooming','training',
    'restaurant','cafe','event','beach','other'
  ));

-- 2) Exemplos das categorias novas (idempotente: não duplica se rodar de novo).
--    São lugares de exemplo pra ilustrar — substitua/adicione os reais quando quiser.
insert into public.places (name, kind, description, address, city, verified)
select v.name, v.kind, v.description, v.address, v.city, true
from (values
  ('Quintal do Cão Bistrô', 'restaurant', 'Restaurante com varanda pet friendly, petiscos e água fresca pros bichos.', 'R. Harmonia, 123 - Vila Madalena', 'São Paulo'),
  ('Empório Pet & Comida', 'restaurant', 'Mesas externas que aceitam cães de todos os portes. Menu pet opcional.', 'R. dos Pinheiros, 456 - Pinheiros', 'São Paulo'),
  ('Café com Patas', 'cafe', 'Cafeteria aconchegante que recebe pets no salão. Tem tapete e comedouro.', 'R. Vergueiro, 789 - Vila Mariana', 'São Paulo'),
  ('Au Au Coffee', 'cafe', 'Café especial com área pet e biscoitos caninos da casa.', 'R. Joaquim Floriano, 100 - Itaim Bibi', 'São Paulo'),
  ('Feira Adote um Focinho', 'event', 'Feira mensal de adoção responsável + bazar pet. Todo 2º domingo do mês.', 'Parque Ibirapuera - Portão 3', 'São Paulo'),
  ('Cãominhada Solidária', 'event', 'Caminhada em grupo com os pets pra arrecadar ração pra ONGs.', 'Parque do Povo - Itaim', 'São Paulo'),
  ('Praia da Baleia (área pet)', 'beach', 'Trecho que permite cães na coleira fora do horário de pico. Leve sacolinha!', 'Praia da Baleia - São Sebastião', 'São Sebastião'),
  ('Praia do Tombo (faixa pet)', 'beach', 'Cães permitidos em horários específicos; confira a sinalização local.', 'Praia do Tombo - Guarujá', 'Guarujá')
) as v(name, kind, description, address, city)
where not exists (select 1 from public.places p where p.name = v.name);
