-- Profil projektu — koho vlastně hledáme.
--
-- Dosud byla pravidla zadrátovaná v kódu: vyloučené obory (stravování,
-- agentury), právní formy zaměstnavatelů, práh velikosti. Pro Cantinero to
-- sedí, ale majitel má další projekty, které hledají někoho jiného —
-- Cantinero Business míří **právě na restaurace a jídelny**, tedy na pravý
-- opak toho, co dnes vyřazujeme (rozhodnutí majitele 2026-07-28).
--
-- Registr subjektů zůstává jeden a společný. Profil řídí jen to, na koho se
-- vynaloží drahá práce: ověření v rejstříku, zaměření adresy, rešerše.
--
-- Stejné pravidlo jako u kategorií: data, ne kód.

create table profily (
  kod text primary key,
  nazev text not null,
  popis text,
  -- NULL = velikost neposuzovat (u restaurací dává smysl i malý podnik)
  min_zamestnancu int check (min_zamestnancu >= 0),
  aktivni boolean not null default false,
  created_at timestamptz not null default now()
);

-- Právě jeden profil smí být aktivní, jinak by nebylo poznat, podle čeho
-- se zrovna sbírá.
create unique index profily_jeden_aktivni on profily ((true)) where aktivni;

-- Které právní formy vůbec sbírat z registru.
create table profil_formy (
  profil_kod text not null references profily(kod) on delete cascade,
  pravni_forma text not null,
  primary key (profil_kod, pravni_forma)
);

-- Obory: buď „jen tyhle" (ano), nebo „všechny kromě" (ne). Kombinace jde
-- taky — nejdřív se uplatní seznam „jen tyhle", pak se z něj odečte „kromě".
create table profil_obory (
  profil_kod text not null references profily(kod) on delete cascade,
  smer text not null check (smer in ('ano', 'ne')),
  nace_oddil text not null check (nace_oddil ~ '^[0-9]{2}$'),
  primary key (profil_kod, smer, nace_oddil)
);

-- ------------------------------------------------------- výchozí profily

insert into profily (kod, nazev, popis, min_zamestnancu, aktivni) values
  ('cantinero', 'Cantinero — firmy',
   'Firmy se zaměstnanci v dojezdu jídelny. Restaurace ven: vaří si samy.',
   10, true),
  ('cantinero-business', 'Cantinero Business — jídelny',
   'Restaurace, jídelny a školní jídelny. Ptáme se na kapacitu, ne na odběr — proto se velikost neposuzuje.',
   null, false);

-- Cantinero: právní formy zaměstnavatelů (shodné s FORMY_ZAMESTNAVATELU).
insert into profil_formy (profil_kod, pravni_forma)
select 'cantinero', f from unnest(array[
  '111','112','113','114','121',
  '141','161','701','706','736','751',
  '205','231','232','234',
  '301','325','331','332','421',
  '601','611','621','625','631','641',
  '651','661',
  '771','801','811'
]) f;

-- Cantinero: stravování (56) a agentury práce (78) ven.
insert into profil_obory (profil_kod, smer, nace_oddil) values
  ('cantinero', 'ne', '56'),
  ('cantinero', 'ne', '78');

-- Cantinero Business: k firemním formám i živnostníci — restauraci často
-- provozuje fyzická osoba a ta je tady plnohodnotný cíl.
insert into profil_formy (profil_kod, pravni_forma)
select 'cantinero-business', f from unnest(array[
  '101','102','103','104','105','106','107','108',
  '111','112','113','114','121',
  '141','161','701','706','736','751',
  '205','231','232','234',
  '301','325','331','332','421',
  '601','611','621','625','631','641',
  '651','661',
  '771','801','811'
]) f;

-- Cantinero Business: JEN stravování a školství (kvůli školním jídelnám).
insert into profil_obory (profil_kod, smer, nace_oddil) values
  ('cantinero-business', 'ano', '56'),
  ('cantinero-business', 'ano', '85'),
  -- Agentury práce nechceme ani tady.
  ('cantinero-business', 'ne', '78');
