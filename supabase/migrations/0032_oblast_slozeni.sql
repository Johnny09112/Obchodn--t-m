-- Složení firem v oblasti — podklad pro proužek na obrazovce Oblasti.
--
-- Majitel 2. 8.: „zobraz vždy status bar se složením jednotlivých firem
-- v dané lokalitě". Bez něj se z čísla „12 762 firem" nedá poznat, jestli
-- je to použitelné území, nebo hromada živnostníků.
--
-- Počítá to databáze ze stejného důvodu jako zbytek pohledu (migrace 0029):
-- desetitisíce řádků se kvůli čtyřem číslům nestahují do prohlížeče.
--
-- `bez_velikosti` je schválně vlastní kategorie, ne nula. „Nevíme" a „nula
-- zaměstnanců" jsou dvě různé věci a pro rozhodování o oblasti je ten rozdíl
-- podstatný — právě on říká, kolik práce ještě zbývá.

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
  coalesce(f.mikro, 0) as mikro,
  coalesce(f.stredni, 0) as stredni,
  coalesce(f.korporat, 0) as korporat,
  coalesce(f.bez_velikosti, 0) as bez_velikosti,
  coalesce(f.se_spojenim, 0) as se_spojenim,
  coalesce(p.pruzkumu, 0) as pruzkumu,
  p.posledni_stav,
  p.posledni_at,
  p.posledni_chyba,
  -- Beze změny z migrace 0031 — pohled se přepisuje celý, takže se sem musí
  -- přenést i to, co přidala minulá migrace.
  coalesce(p.posledni_tvar is distinct from public.tvar_oblasti(o.id), false)
    and p.posledni_tvar is not null as tvar_zmenen,
  coalesce(k.kampane, '[]'::jsonb) as kampane
from oblasti o
left join lateral (
  select
    count(*)::int as firem,
    count(*) filter (where c.velikost_kategorie = 'mikro')::int as mikro,
    count(*) filter (where c.velikost_kategorie = 'stredni')::int as stredni,
    count(*) filter (where c.velikost_kategorie = 'korporat')::int as korporat,
    count(*) filter (where c.velikost_kategorie is null)::int as bez_velikosti,
    count(*) filter (where exists (
      select 1 from contacts k where k.ico = c.ico and k.prijmeni is not null
    ))::int as se_spojenim
  from oblast_firmy x
  join companies c on c.ico = x.ico
  where x.oblast_id = o.id
) f on true
left join lateral (
  select
    count(*)::int as pruzkumu,
    (array_agg(x.stav order by x.pozadano_at desc))[1] as posledni_stav,
    (array_agg(coalesce(x.dokonceno_at, x.zahajeno_at, x.pozadano_at)
               order by x.pozadano_at desc))[1] as posledni_at,
    (array_agg(x.chyba order by x.pozadano_at desc))[1] as posledni_chyba,
    -- Beze změny z migrace 0031.
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
  'Oblasti i s tím, co je drží, a se složením firem podle velikosti. Jen ke čtení.';
