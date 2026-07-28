-- Kategorie firem a vlastní blacklist.
--
-- KATEGORIE jsou schválně DATA, ne kód: aplikace má být použitelná i pro
-- jiná odvětví než jídelny (rozhodnutí majitele 2026-07-28), takže členění
-- musí jít upravit bez zásahu do programu.
--
-- Převod se dělá přes dvoumístný oddíl CZ-NACE. Firma má často víc oborů;
-- rozhoduje první, který se podaří zařadit — je to převažující činnost.
--
-- BLACKLIST je ruční obdoba toho, co dělá kód automaticky u bytových domů
-- a agentur práce. Vždy s důvodem, stejně jako deník vyřazení: bez důvodu
-- se za měsíc nedá poznat, proč tam ta firma je.

create table kategorie (
  kod text primary key,
  nazev text not null,
  poradi int not null default 100
);

create table kategorie_nace (
  -- Jeden oddíl patří právě do jedné kategorie, proto je klíčem.
  nace_oddil text primary key check (nace_oddil ~ '^[0-9]{2}$'),
  kategorie_kod text not null references kategorie(kod) on delete cascade
);

alter table companies add column kategorie text references kategorie(kod);
create index companies_kategorie_idx on companies (kategorie);

insert into kategorie (kod, nazev, poradi) values
  ('vyroba',        'Výroba',                        10),
  ('stavebnictvi',  'Stavebnictví',                  20),
  ('doprava',       'Doprava a sklady',              30),
  ('obchod',        'Obchod',                        40),
  ('pohostinstvi',  'Restaurace a pohostinství',     50),
  ('urady',         'Úřady a samospráva',            60),
  ('skolstvi',      'Školství',                      70),
  ('zdravotnictvi', 'Zdravotnictví a sociální služby', 80),
  ('sluzby',        'Služby',                        90),
  ('ostatni',       'Ostatní',                      999);

insert into kategorie_nace (nace_oddil, kategorie_kod)
select lpad(g::text, 2, '0'), 'vyroba'       from generate_series(10, 33) g
union all
select lpad(g::text, 2, '0'), 'stavebnictvi' from generate_series(41, 43) g
union all
select lpad(g::text, 2, '0'), 'obchod'       from generate_series(45, 47) g
union all
select lpad(g::text, 2, '0'), 'doprava'      from generate_series(49, 53) g
union all
-- 55 = ubytování, 56 = stravování. Majitel chtěl pohostinství zvlášť.
select '56', 'pohostinstvi'
union all
select lpad(g::text, 2, '0'), 'sluzby'       from generate_series(55, 55) g
union all
select lpad(g::text, 2, '0'), 'sluzby'       from generate_series(58, 82) g
union all
select '84', 'urady'
union all
select '85', 'skolstvi'
union all
select lpad(g::text, 2, '0'), 'zdravotnictvi' from generate_series(86, 88) g;

-- ------------------------------------------------------------- blacklist

create table blacklist (
  id uuid primary key default gen_random_uuid(),
  typ text not null check (typ in ('ico', 'nazev', 'nace', 'pravni_forma')),
  hodnota text not null,
  duvod text not null,
  vytvoril text,
  created_at timestamptz not null default now(),
  unique (typ, hodnota)
);

comment on table blacklist is
  'Ruční pravidla majitele. Automatická vyřazení (bytové domy, agentury) jsou v kódu.';

-- Nový důvod vyřazení do deníku.
alter table vyrazeni drop constraint vyrazeni_duvod_check;
alter table vyrazeni add constraint vyrazeni_duvod_check check (duvod in (
  'neplatne_ico', 'neni_v_ares', 'nesparovano', 'agentura', 'vylouceny_obor',
  'bez_zamestnancu', 'neuvedena_velikost', 'poloha_neznama', 'mimo_zonu',
  'partnerska_jidelna', 'bytovy_dum',
  'blacklist'            -- ruční pravidlo majitele
));
