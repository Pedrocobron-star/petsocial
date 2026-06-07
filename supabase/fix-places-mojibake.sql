-- ============================================================================
-- FIX: mojibake (UTF-8 duplo-encodado) nos dados da tabela public.places.
-- Causa: um seed (roteiro-pet.sql / places-categories.sql) foi colado no SQL
-- Editor via clipboard que re-encodou os acentos (ex.: "Sao Paulo" virou
-- "S<C3><A3>o Paulo" exibido como "SÃ£o Paulo"). O ARQUIVO de seed está correto;
-- só os DADOS no banco ficaram corrompidos.
--
-- Reversão idempotente e segura: convert_to(...,'LATIN1') reconstrói os bytes
-- originais e convert_from(...,'UTF8') os redecodifica corretamente.
-- IMPORTANTE: este script NÃO contém nenhum caractere acentuado (usa chr(195)=
-- 'A-til maiusculo' e chr(194) como assinatura do mojibake), pra não se
-- auto-corromper se for colado pelo mesmo clipboard.
-- Só toca linhas que realmente têm a assinatura -> linhas corretas ficam intactas.
-- ============================================================================

update public.places
set
  name        = convert_from(convert_to(name, 'LATIN1'), 'UTF8'),
  description = convert_from(convert_to(description, 'LATIN1'), 'UTF8'),
  address     = convert_from(convert_to(address, 'LATIN1'), 'UTF8'),
  city        = convert_from(convert_to(city, 'LATIN1'), 'UTF8')
where strpos(coalesce(name, ''), chr(195))        > 0
   or strpos(coalesce(name, ''), chr(194))        > 0
   or strpos(coalesce(description, ''), chr(195))  > 0
   or strpos(coalesce(description, ''), chr(194))  > 0
   or strpos(coalesce(address, ''), chr(195))      > 0
   or strpos(coalesce(address, ''), chr(194))      > 0
   or strpos(coalesce(city, ''), chr(195))         > 0
   or strpos(coalesce(city, ''), chr(194))         > 0;

-- Verificacao (ASCII-only): lista os lugares pra conferir os acentos no grid.
select name, city, address from public.places order by name;
