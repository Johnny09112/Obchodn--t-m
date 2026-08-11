-- Úroveň 2 (porovnání běhů) a hlídač zdrojů.
--
-- Obojí je JEDEN obecný mechanismus, ne kód na signál. Právě proto je
-- údržba levná: nový signál tohoto druhu je řádek v `druhy_signalu`
-- a jedno volání, ne nová čtečka.

-- ── Snímky: co jsme u téhle věci viděli minule ────────────────────────
--
-- Drží se JEDEN řádek na sledovanou věc, ne historie. Historii nese
-- `signaly` — tohle je jen otisk pro porovnání, aby tabulka nerostla
-- s každým během.
create table snimky (
  -- Co se sleduje, např. 'mpsv:zamestnavatel' nebo 'oblast:firmy'.
  zdroj text not null,
  -- Identita sledované věci uvnitř zdroje — typicky IČO nebo kód obce.
  klic text not null,
  -- Otisk stavu. Porovnává se řetězec, ne struktura: co se má považovat
  -- za změnu, rozhoduje ten, kdo otisk skládá, ne tahle tabulka.
  otisk text not null,
  porizeno_at timestamptz not null default now(),
  primary key (zdroj, klic)
);

-- ── Hlídač zdrojů: rozbitá čtečka nehlásí chybu, vrátí nulu ───────────
--
-- A nula vypadá úplně stejně jako „tento týden se nic nedělo". Tuhle past
-- jsme v projektu už jednou zaplatili: agent dostal zadání, které mu
-- bránilo cokoli zapsat, dávka doběhla s nulou a vypadalo to hotově.
--
-- Proto se u každého zdroje pamatuje, kolik obvykle vydá. Když vydá
-- výrazně míň, je to podezření na rozbitý zdroj — ne ticho na trhu.
create table zdroje_objem (
  zdroj text primary key,
  -- Klouzavý průměr. Neukládá se historie: na rozhodnutí „je to podezřele
  -- málo?" stačí průměr a počet běhů, a tabulka tím nebobtná.
  obvykly_objem numeric not null,
  posledni_objem int not null,
  behu int not null default 1,
  posledni_beh_at timestamptz not null default now(),
  -- Kdy naposledy hlídač zaječel. Ať jde poznat opakované selhání od
  -- jednorázového výkyvu.
  posledni_podezreni_at timestamptz
);

alter table snimky enable row level security;
alter table zdroje_objem enable row level security;

create policy snimky_cteni on snimky
  for select to authenticated using (true);
create policy snimky_zapis on snimky
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin'))
  with check (public.role_uzivatele() in ('super-admin', 'admin'));

create policy zdroje_objem_cteni on zdroje_objem
  for select to authenticated using (true);
create policy zdroje_objem_zapis on zdroje_objem
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin'))
  with check (public.role_uzivatele() in ('super-admin', 'admin'));

comment on table snimky is
  'Otisk toho, co jsme u sledované věci viděli minule. Jeden řádek na věc — historii nese tabulka signaly.';
comment on table zdroje_objem is
  'Kolik zdroj obvykle vydá. Slouží k rozpoznání rozbité čtečky: nula vypadá stejně jako klid na trhu.';
