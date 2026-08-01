-- Kampaň nad více oblastmi.
--
-- Majitel 31. 7.: „chci kampaň přes více oblastí". Skutečné geometrické
-- slučování tvarů se NESTAVÍ — potvrdil, že jde o tohle: vybrat víc ploch,
-- ne z nich udělat jednu. Slučování by navíc zahodilo evidenci o tom, které
-- území se kdy analyzovalo.
--
-- Sloupec `kampane.oblast_id` se **ruší**, nenechává se „pro jistotu" vedle
-- vazební tabulky. Dva zdroje pravdy na totéž se dřív nebo později rozejdou
-- a nikdo pak neví, který platí.
--
-- Pozor na ochranu z migrace 0028: mazání oblasti hlídal cizí klíč
-- `kampane.oblast_id` nastavený na `restrict`. Tu roli přebírá cizí klíč
-- vazební tabulky, jinak by se úklid oblastí tiše otevřel.

create table kampan_oblasti (
  kampan_id uuid not null references kampane(id) on delete cascade,
  oblast_id uuid not null references oblasti(id) on delete restrict,
  -- Pořadí je jen kvůli výpisu: „Plzeňsko a Rokycansko" má znít pokaždé stejně.
  poradi integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (kampan_id, oblast_id)
);

comment on table kampan_oblasti is
  'Území kampaně. Víc oblastí na kampaň; firmy se z nich sjednotí, průzkum se objednává pro každou zvlášť.';

comment on column kampan_oblasti.oblast_id is
  'Oblast. `restrict` — používanou oblast nesmí vzít smazání s sebou (migrace 0028).';

-- Vyhledávání „které kampaně používají tuhle oblast" jde proti primárnímu
-- klíči odzadu; ten na to nestačí.
create index kampan_oblasti_oblast_idx on kampan_oblasti (oblast_id);

-- ── převod stávajících kampaní

insert into kampan_oblasti (kampan_id, oblast_id)
select id, oblast_id from kampane where oblast_id is not null;

-- ── pohled musí přestat číst zrušený sloupec

drop view oblasti_prehled;

alter table kampane drop column oblast_id;

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
  from kampan_oblasti ko
  join kampane x on x.id = ko.kampan_id
  where ko.oblast_id = o.id
) k on true;

comment on view oblasti_prehled is
  'Oblasti i s tím, co je drží: firmy uvnitř, průzkumy a kampaně. Jen ke čtení — zapisuje se do oblasti.';

-- ── kdo smí měnit území kampaně

alter table kampan_oblasti enable row level security;

create policy kampan_oblasti_cteni on kampan_oblasti
  for select to authenticated using (true);

-- Stejné pravidlo jako u seznamu firem kampaně: správce, zástup, admin.
create policy kampan_oblasti_zapis on kampan_oblasti
  for all to authenticated
  using (public.smi_do_kampane(kampan_id))
  with check (public.smi_do_kampane(kampan_id));
