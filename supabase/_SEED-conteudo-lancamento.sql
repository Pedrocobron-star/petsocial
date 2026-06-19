-- ============================================================================
-- MAESTRO PET — SEED DE CONTEÚDO PRO LANÇAMENTO (cole no SQL Editor → Run)
--
-- Enche o feed pra não nascer deserto. Faz 2 coisas:
--   1. Publica os 20 posts do Mozart que estão em RASCUNHO (vira os textos que
--      já existem; o cron petsocial-dispatch publica os vencidos a cada 5 min).
--   2. Semeia posts das 3 personas (Nina/Thor/Pipoca) — rotina de pet, SEM
--      elogio do app e SEM impersonar pessoa real (regra do dono).
--
-- Escalonado no tempo (drip): alguns saem JÁ (scheduled_at no passado, publicam
-- no próximo ciclo do cron) e o resto pinga ao longo de ~10 dias — feed sempre
-- com novidade. As MATÉRIAS do Jornal NÃO entram aqui (já há 9 publicadas).
--
-- Fotos: posts seed saem só com texto (viram card de legenda). Pra deixar mais
-- bonito, dá pra subir foto depois pelos painéis /admin/mozart-posts e
-- /admin/personas. Idempotente (personas só semeiam se a tabela estiver vazia).
-- ============================================================================


-- 1) PUBLICAR OS RASCUNHOS DO MOZART -----------------------------------------
-- Vira status='scheduled' com horário escalonado: os 2 primeiros já vencidos
-- (saem no próximo cron), o resto a cada 12h.
with d as (
  select id, row_number() over (order by created_at) as rn
  from public.mozart_posts
  where status = 'draft'
)
update public.mozart_posts m
set status = 'scheduled',
    scheduled_at = now() + ((d.rn - 3) * interval '12 hours'),
    updated_at = now()
from d
where m.id = d.id;


-- 2) SEMEAR POSTS DAS PERSONAS (só se ainda não houver nenhum) ----------------
insert into public.persona_posts (pet_id, caption, status, scheduled_at)
select v.pet_id, v.caption, 'scheduled', now() + v.offs
from (values
  -- imediatos (saem no próximo ciclo do cron)
  ('c0000001-0000-4000-8000-000000000001'::uuid, 'A Nina decidiu que o lugar dela é exatamente onde bate o sol da manhã. Ninguém move essa gata daí 🐱☀️', interval '-20 hours'),
  ('c0000002-0000-4000-8000-000000000002'::uuid, 'Bom dia começa com o Thor trazendo a bolinha às 6h. Despertador de Golden não tem botão soneca 🎾', interval '-14 hours'),
  ('c0000003-0000-4000-8000-000000000003'::uuid, 'A Pipoca aprendeu a pedir petisco fazendo charme. Confesso que funciona toda vez 🐩🍪', interval '-6 hours'),
  -- drip ao longo dos próximos dias
  ('c0000002-0000-4000-8000-000000000002'::uuid, 'Corrida matinal no parque feita. Ele voltou exausto e feliz, eu só exausto 😅🐕', interval '10 hours'),
  ('c0000001-0000-4000-8000-000000000001'::uuid, 'Acordei com a Nina dormindo em cima do teclado. Home office com supervisão felina 😹', interval '22 hours'),
  ('c0000003-0000-4000-8000-000000000003'::uuid, 'Dia de tosa! A Pipoca saiu de lá toda fofa e desfilando pela casa ✨', interval '34 hours'),
  ('c0000002-0000-4000-8000-000000000002'::uuid, 'Banho de domingo. O Thor amou, a casa toda ficou molhada junto 💦', interval '46 hours'),
  ('c0000001-0000-4000-8000-000000000001'::uuid, 'Caixa de papelão venceu de novo qualquer brinquedo caro. A Nina confirma a teoria 📦', interval '58 hours'),
  ('c0000003-0000-4000-8000-000000000003'::uuid, 'Pequena no tamanho, gigante na personalidade. A Pipoca manda em casa 👑', interval '70 hours'),
  ('c0000002-0000-4000-8000-000000000002'::uuid, 'Achou uma poça de lama e decidiu que era piscina. Golden é assim mesmo 🐾', interval '82 hours'),
  ('c0000001-0000-4000-8000-000000000001'::uuid, 'Soneca número 7 do dia. A Nina leva a profissão de gato muito a sério 😴', interval '94 hours'),
  ('c0000003-0000-4000-8000-000000000003'::uuid, 'Soninho no colo depois do passeio. Momento favorito do dia 🥰', interval '106 hours'),
  ('c0000002-0000-4000-8000-000000000002'::uuid, 'Soneca pós-passeio com as quatro patas pro alto. Sinal de cachorro feliz 😍', interval '118 hours'),
  ('c0000001-0000-4000-8000-000000000001'::uuid, 'Sessão de escovação feita. Ela reclama, mas o ronronar no fim entrega que ama 🐾', interval '130 hours'),
  ('c0000003-0000-4000-8000-000000000003'::uuid, 'A Pipoca late pro próprio reflexo no espelho todo dia. Todo dia mesmo 😂🐩', interval '142 hours')
) as v(pet_id, caption, offs)
where not exists (select 1 from public.persona_posts);


-- ----------------------------------------------------------------------------
-- Verificação (deve mostrar Mozart agendados > 0 e persona_posts = 15)
-- ----------------------------------------------------------------------------
select
  (select count(*) from public.mozart_posts where status = 'scheduled') as mozart_agendados,
  (select count(*) from public.mozart_posts where status = 'published') as mozart_publicados,
  (select count(*) from public.persona_posts) as persona_posts_total,
  (select count(*) from public.news_articles where status = 'published') as materias_publicadas;
-- Os posts aparecem no feed conforme o cron petsocial-dispatch roda (a cada 5 min).
-- ============================================================================
