-- Rejstřík atributů: co se o firmě smí vědět a co z toho smí do zprávy.
--
-- Nahrazuje pevný seznam na dvou místech (src/whitelist.ts a podmínka
-- `check` na evidence.atribut). Důvod je v ADR 0002: whitelist nově váže
-- OBSAH ZPRÁVY, ne sběr — co se sbírá, určuje profil produktu.
--
-- Záruka „vymyšlený atribut neprojde" zůstává v databázi, jen se stěhuje
-- z podmínky do cizího klíče. Je slabší v tom, že rejstřík jde rozšířit —
-- ale jen záměrně a jen člověkem, ne agentem.

create table atributy (
  kod text primary key,
  nazev text not null,
  -- Co se u tohohle atributu hledá. Jde ROVNOU AGENTOVI do zadání, takže
  -- se to píše pro něj: konkrétně a s příklady, ne definičně.
  popis text not null check (length(trim(popis)) > 0),
  -- Smí se objevit v oslovení? Tohle je whitelist z SPEC kap. 5.2.
  do_zpravy boolean not null default false,
  -- Hledá tenhle atribut AGENT na webu?
  --
  -- Nahrazuje pevný výčet `OBOHACOVANE_ATRIBUTY` v src/nalezy.ts. Bez toho
  -- by nový atribut nešlo zapsat vůbec — schéma nálezů ho odmítne dřív, než
  -- se dostane k `zapisAtribut`, a dávka by doběhla s nulou.
  --
  -- Vypnuté u toho, co plyne z rejstříků (velikost, adresa, obor) nebo se
  -- řeší jinou cestou (kontakt) — hledat to na webu je zbytečná práce.
  hleda_agent boolean not null default false,
  created_at timestamptz not null default now()
);

insert into atributy (kod, nazev, popis, do_zpravy, hleda_agent) values
  ('velikost_kategorie', 'velikost firmy',
   'kategorie podle počtu zaměstnanců (mikro do 24, střední 25–249, korporát 250+)', true, false),
  ('zamestnanci_odhad', 'počet zaměstnanců',
   'přibližný počet zaměstnanců, pokud ho firma sama uvádí', true, false),
  ('ma_vlastni_jidelnu', 'vlastní jídelna',
   'má firma vlastní závodní jídelnu nebo kantýnu? hledej v sekci o firmě, na kariérní stránce a mezi benefity', true, true),
  ('zpusob_stravovani', 'způsob stravování',
   'jak firma řeší obědy — stravenky, stravenkový paušál, příspěvek, dovoz, vlastní jídelna, nebo nic', true, true),
  ('ucel_adresy', 'účel zveřejněné adresy',
   'k čemu firma tu adresu zveřejnila — pro nabídky, pro dodavatele, obecné dotazy', true, true),
  ('kontakt', 'kontakt', 'jméno, pozice, e-mail nebo telefon na konkrétní osobu', true, false),
  ('obor', 'obor podnikání', 'čím se firma živí, obecně a vlastními slovy z jejího webu', true, false),
  ('adresa', 'adresa', 'adresa provozovny nebo sídla', true, false);

-- Cizí klíč místo dosavadní podmínky. Podmínku je nutné napřed zrušit —
-- jinak by platila obojí a rejstřík by šlo rozšířit jen naoko.
alter table evidence drop constraint if exists evidence_atribut_check;
alter table evidence add constraint evidence_atribut_fk
  foreign key (atribut) references atributy(kod);

-- RLS: bez tohohle je tabulka přes datové API čitelná i ZAPISOVATELNÁ
-- komukoli s veřejným klíčem projektu — kdokoli by si zavedl atribut a tím
-- rozšířil, co se o firmách sbírá. Obejití TP-3 bez zásahu do kódu.
-- (A `test/pravidla.test.ts` hlídá, že RLS je zapnuté na všech tabulkách.)
alter table atributy enable row level security;

create policy atributy_cteni on atributy
  for select to authenticated using (true);

-- Rejstřík mění jen admin. Není to nastavení kampaně, je to hranice systému.
create policy atributy_zapis on atributy
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin'))
  with check (public.role_uzivatele() in ('super-admin', 'admin'));

comment on table atributy is
  'Co se o firmě smí vědět. `do_zpravy` je whitelist pro oslovení (SPEC kap. 5.2); `hleda_agent` říká, co hledá Čmuchal; co se SBÍRÁ, určuje profil produktu.';
