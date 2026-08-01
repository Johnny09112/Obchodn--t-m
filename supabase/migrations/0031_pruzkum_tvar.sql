-- Tvar oblasti se zaznamená k průzkumu.
--
-- Majitel 31. 7.: „protože oblasti slouží především pro zadání vyhledávání,
-- tak se i Plzeň může čas od času měnit (rozšiřovat/zmenšovat)".
--
-- Bez tohohle by starý průzkum tvrdil „analyzovali jsme Plzeň", ale ta Plzeň
-- by mezitím znamenala něco jiného. Průzkum je evidence a evidence musí
-- popisovat, co se opravdu stalo — ne to, jak věci vypadají dneska.
--
-- **Zapisuje se při zahájení, ne při objednání.** Zaznamenává se tvar, který
-- Čmuchal skutečně prošel; mezi objednávkou a během se dá oblast ještě
-- překreslit. Zápis je součástí téhož `update`, který objednávku rozbíhá,
-- takže se stane právě jednou — opakované volání `zahajPruzkum` (a to
-- `vyridPruzkum` dělá při každém navazujícím běhu) na běžící objednávku
-- nesáhne.

alter table pruzkumy add column tvar jsonb;
alter table pruzkumy add column oblast_nazev text;

comment on column pruzkumy.tvar is
  'Tvar oblasti v okamžiku zahájení — doklad o tom, co se skutečně prošlo. Oblast se od té doby mohla překreslit.';

comment on column pruzkumy.oblast_nazev is
  'Název oblasti při zahájení. Oblast se dá přejmenovat; doklad se přejmenovat nemá.';

-- Tvar v podobě, které rozumí `src/oblast-tvar.ts` (typ `Oblast`).
--
-- Jako funkce schválně: skládá se na dvou místech — při zahájení průzkumu
-- a v přehledu oblastí, kde se porovnává se zaznamenaným. Dvě kopie by se
-- rozešly a přehled by pak hlásil změnu tam, kde žádná není.
create function public.tvar_oblasti(oblast uuid) returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'typ', o.typ,
    'stred', case when o.stred_lat is not null and o.stred_lng is not null
                  then jsonb_build_object('lat', o.stred_lat::float8, 'lng', o.stred_lng::float8)
             end,
    'polomerM', o.polomer_m,
    'body', o.body
  ))
  from public.oblasti o
  where o.id = oblast
$$;

comment on function public.tvar_oblasti(uuid) is
  'Tvar oblasti jako JSON pro `src/oblast-tvar.ts`. Jedno místo, kde se skládá — používá ho zahájení průzkumu i přehled oblastí.';

-- ── přehled oblastí umí říct, že se tvar od průzkumu změnil

drop view oblasti_prehled;

create view oblasti_prehled with (security_invoker = on) as
select
  o.id,
  o.nazev,
  o.typ,
  o.stred_lat,
  o.stred_lng,
  o.polomer_m,
  o.jidelna_id,
  o.poznamka,
  o.created_at,
  case when o.typ = 'polygon' then jsonb_array_length(o.body) end as bodu,
  coalesce(f.firem, 0) as firem,
  coalesce(p.pruzkumu, 0) as pruzkumu,
  p.posledni_stav,
  p.posledni_at,
  p.posledni_chyba,
  -- Oblast se od posledního prozkoumaného tvaru překreslila. `false`, dokud
  -- není s čím porovnávat — neprozkoumaná oblast se nezměnila, jen se o ní
  -- zatím nic neví.
  coalesce(p.posledni_tvar is distinct from public.tvar_oblasti(o.id), false)
    and p.posledni_tvar is not null as tvar_zmenen,
  coalesce(k.kampane, '[]'::jsonb) as kampane
from oblasti o
left join lateral (
  select count(*)::int as firem
  from oblast_firmy x
  where x.oblast_id = o.id
) f on true
left join lateral (
  select
    count(*)::int as pruzkumu,
    (array_agg(x.stav order by x.pozadano_at desc))[1] as posledni_stav,
    (array_agg(coalesce(x.dokonceno_at, x.zahajeno_at, x.pozadano_at)
               order by x.pozadano_at desc))[1] as posledni_at,
    (array_agg(x.chyba order by x.pozadano_at desc))[1] as posledni_chyba,
    -- Nejnovější tvar, který vůbec vznikl. Čekající objednávka tvar ještě
    -- nemá a nesmí přebít doklad staršího dokončeného průzkumu — právě
    -- tehdy je hlášení „oblast se změnila" nejužitečnější.
    (array_agg(x.tvar order by x.pozadano_at desc)
       filter (where x.tvar is not null))[1] as posledni_tvar
  from pruzkumy x
  where x.oblast_id = o.id
) p on true
left join lateral (
  select jsonb_agg(
           jsonb_build_object(
             'id', x.id,
             'nazev', x.nazev,
             'stav', x.stav,
             'archivovana', x.archivovana_at is not null
           )
           order by x.created_at desc
         ) as kampane
  from kampan_oblasti ko
  join kampane x on x.id = ko.kampan_id
  where ko.oblast_id = o.id
) k on true;

comment on view oblasti_prehled is
  'Oblasti i s tím, co je drží: firmy uvnitř, průzkumy a kampaně. Jen ke čtení — zapisuje se do oblasti.';
