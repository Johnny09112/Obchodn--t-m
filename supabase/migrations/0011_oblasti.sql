-- Oblast hledání jako samostatná věc.
--
-- Dosud bylo území vlastností jídelny: kruh o poloměru `zona_metru`.
-- To brání dvěma věcem, které majitel potřebuje (rozhodnutí 2026-07-28):
--
--   1. Obrácený postup — nejdřív označit území, dostat seznam firem jako
--      podklad na jednání, a jídelnu doplnit až po dohodě. Proto je
--      `jidelna_id` NEPOVINNÉ.
--   2. Nakreslený tvar — kruh usekne sousední město v půlce a zvětšení
--      poloměru nabere na druhé straně, co nemá.
--
-- Tvar se ukládá jako obyčejná data, ne jako geometrický typ: testy běží
-- nad PGlite, která PostGIS nemá, a dotaz opřený o PostGIS by rozbil
-- `npm test` bez sítě. Bod v oblasti se počítá v TypeScriptu (src/oblast.ts).

create table oblasti (
  id uuid primary key default gen_random_uuid(),
  nazev text not null,
  typ text not null check (typ in ('kruh', 'polygon')),

  -- kruh
  stred_lat numeric,
  stred_lng numeric,
  polomer_m int check (polomer_m > 0),

  -- polygon: pole vrcholů [{lat, lng}, …] v pořadí, jak se kreslily
  body jsonb,

  -- Nepovinné schválně: oblast smí existovat dřív než jídelna.
  jidelna_id uuid references jidelny(id) on delete set null,
  poznamka text,
  created_at timestamptz not null default now(),

  -- Kruh bez středu ani polygon bez vrcholů nedávají smysl a tiše by
  -- nevybraly nic. Radši ať zápis spadne hned.
  constraint oblast_ma_tvar check (
    (typ = 'kruh'
      and stred_lat is not null and stred_lng is not null and polomer_m is not null)
    or
    (typ = 'polygon' and body is not null)
  )
);

comment on column oblasti.jidelna_id is
  'Nepovinné — oblast smí vzniknout dřív než jídelna a přiřadit se až po jednání';

-- Které firmy do oblasti spadají. Přepočítává se, stejně jako `dosah`.
create table oblast_firmy (
  oblast_id uuid not null references oblasti(id) on delete cascade,
  ico text not null references companies(ico) on delete cascade,
  vzdalenost_m int,                -- jen u kruhu; u polygonu nedává smysl
  primary key (oblast_id, ico)
);

create index oblast_firmy_oblast_idx on oblast_firmy (oblast_id);
