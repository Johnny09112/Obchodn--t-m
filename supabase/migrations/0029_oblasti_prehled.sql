-- Přehled oblastí: co o oblasti víme, jedním dotazem.
--
-- Majitel 31. 7.: chce „seznam oblastí s detailem" místo klikání do mapy —
-- kdy naposled prozkoumaná, kolik firem, v jakých kampaních figuruje.
--
-- Proč pohled a ne dopočet v prohlížeči: počet firem v oblasti je desetitisíce
-- řádků (Plzeň sama 12 762). Stáhnout je jen kvůli číslu nejde a ptát se na
-- každou oblast zvlášť znamená deset dotazů místo jednoho. Databáze to spočítá
-- na místě.
--
-- `security_invoker = on` je podstatné: bez něj by pohled běžel právy vlastníka
-- a obešel pravidla přístupu na tabulkách pod ním. Takhle platí pořád stejná
-- pravidla — čtení má dnes povolené každý přihlášený, ale až se to změní,
-- změní se to i tady, samo.

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
  -- Tvar se v seznamu popisuje slovy, celý polygon by tam byl k ničemu.
  case when o.typ = 'polygon' then jsonb_array_length(o.body) end as bodu,
  coalesce(f.firem, 0) as firem,
  coalesce(p.pruzkumu, 0) as pruzkumu,
  p.posledni_stav,
  p.posledni_at,
  p.posledni_chyba,
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
    -- Nejnovější podle objednání: teprve zahájený průzkum ještě nemá
    -- dokončení, ale v seznamu má přebít ten loňský hotový.
    (array_agg(x.stav order by x.pozadano_at desc))[1] as posledni_stav,
    (array_agg(coalesce(x.dokonceno_at, x.zahajeno_at, x.pozadano_at)
               order by x.pozadano_at desc))[1] as posledni_at,
    (array_agg(x.chyba order by x.pozadano_at desc))[1] as posledni_chyba
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
  from kampane x
  where x.oblast_id = o.id
) k on true;

comment on view oblasti_prehled is
  'Oblasti i s tím, co je drží: firmy uvnitř, průzkumy a kampaně. Jen ke čtení — zapisuje se do oblasti.';
