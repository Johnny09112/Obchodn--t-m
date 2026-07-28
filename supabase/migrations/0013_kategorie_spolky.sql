-- Spolky a neziskovky jako samostatná kategorie + dobroušení „ostatních".
--
-- Rozhodnutí majitele 2026-07-28 po pohledu na to, co spadlo do „ostatních".
--
-- KLÍČOVÉ: spolek se nepozná podle oboru, ale podle PRÁVNÍ FORMY.
-- TJ Baník Zbůch má obor „sportovní činnosti" úplně stejně jako komerční
-- fitness centrum — podle CZ-NACE by se rozlišit nedaly. Právní forma
-- (706 = spolek) je tvrdý údaj z rejstříku.
--
-- Proto má převod podle formy PŘEDNOST před převodem podle oboru.

insert into kategorie (kod, nazev, poradi) values
  ('spolky', 'Spolky a neziskovky', 85);

create table kategorie_forma (
  -- Jedna právní forma patří právě do jedné kategorie.
  pravni_forma text primary key,
  kategorie_kod text not null references kategorie(kod) on delete cascade
);

comment on table kategorie_forma is
  'Zařazení podle právní formy. Má přednost před oborem — spolek se pozná odsud.';

insert into kategorie_forma (pravni_forma, kategorie_kod) values
  ('117', 'spolky'),  -- nadace
  ('118', 'spolky'),  -- nadační fond
  ('141', 'spolky'),  -- obecně prospěšná společnost
  ('161', 'spolky'),  -- ústav
  ('701', 'spolky'),  -- sdružení (svaz, spolek, klub)
  ('706', 'spolky'),  -- spolek
  ('736', 'spolky'),  -- pobočný spolek
  ('751', 'spolky');  -- zájmové sdružení právnických osob

-- Zbytek „ostatních" podle návrhu: zemědělství a rybolov k výrobě,
-- opravny a kultura ke službám.
insert into kategorie_nace (nace_oddil, kategorie_kod) values
  ('01', 'vyroba'),   -- rostlinná a živočišná výroba
  ('02', 'vyroba'),   -- lesnictví
  ('03', 'vyroba'),   -- rybolov
  ('90', 'sluzby'),   -- tvůrčí, umělecké a zábavní činnosti
  ('91', 'sluzby'),   -- knihovny, muzea
  ('93', 'sluzby'),   -- sportovní a rekreační činnosti (komerční)
  ('94', 'spolky'),   -- organizace sdružující osoby
  ('95', 'sluzby'),   -- opravy počítačů a výrobků pro osobní potřebu
  ('96', 'sluzby');   -- ostatní osobní služby
