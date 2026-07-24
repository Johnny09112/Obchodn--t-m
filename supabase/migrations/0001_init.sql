-- Cantinero — schéma dle SPEC.md kap. 8.
-- Tvrdá pravidla vynucená v DB: TP-1 (IČO formát, PK), TP-2 (evidence se zdrojem),
-- TP-7 (suppressions), TP-8 (system_state, sending_enabled default false),
-- TP-13 (agent_runs). Tabulky pozdějších fází jsou založené, logika přijde s fázemi.

create or replace function nastav_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------- jídelny
create table jidelny (
  id uuid primary key default gen_random_uuid(),
  nazev text not null,
  adresa text not null,
  lat numeric not null,
  lng numeric not null,
  kod_obce int,                                            -- RÚIAN kód obce pro hledání firem v ARES
  kapacita_volna int not null default 0 check (kapacita_volna >= 0),
  zona_metru int not null default 3000 check (zona_metru > 0),
  smlouva_od date,
  aktivni boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- companies
create table companies (
  ico text primary key check (ico ~ '^[0-9]{8}$'),         -- TP-1: formát; existence proti ARES vynucuje kód
  nazev text not null,
  adresa text,
  obec text,
  okres text,
  kraj text,
  psc text,
  lat numeric,
  lng numeric,
  cz_nace text[] not null default '{}',
  velikost_kategorie text check (velikost_kategorie in ('mikro','mala','stredni','velka')),
  zamestnanci_odhad int,                                   -- NULL dokud není zdroj (TP-2)
  ma_vlastni_jidelnu boolean,                              -- NULL = nevíme
  zpusob_stravovani text,
  nejblizsi_jidelna_id uuid references jidelny(id),
  vzdalenost_m int check (vzdalenost_m >= 0),
  v_zone boolean,
  skore int check (skore between 0 and 100),
  stav text not null default 'novy' check (stav in
    ('novy','kvalifikovany','cekajici_na_jidelnu','zamitnuty','osloveny','jednani','zakaznik')),
  osloveno_at timestamptz,                                 -- TP-5: jedno oslovení
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_updated_at before update on companies
  for each row execute function nastav_updated_at();

-- ---------------------------------------------------------------- contacts
create table contacts (
  id uuid primary key default gen_random_uuid(),
  ico text not null references companies(ico) on delete cascade,
  jmeno text,
  prijmeni text,
  pozice text,
  email text,
  uroven_adresy int check (uroven_adresy in (1,2,3)),      -- TP-6
  telefon text,
  linkedin_url text,
  zdroj_url text not null,                                 -- TP-2
  ziskano_at timestamptz not null default now(),
  overeno boolean not null default false,
  gdpr_info_odeslano_at timestamptz
);

-- ---------------------------------------------------------------- evidence
create table evidence (
  id uuid primary key default gen_random_uuid(),
  ico text references companies(ico) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  atribut text not null check (atribut in (
    'velikost_kategorie','zamestnanci_odhad','ma_vlastni_jidelnu',
    'zpusob_stravovani','ucel_adresy','kontakt','obor','adresa'
  )),                                                      -- TP-3: whitelist kap. 5
  hodnota text not null,
  zdroj_url text not null,                                 -- TP-2: zdroj, nebo NULL v companies
  citace text check (citace is null or char_length(citace) <= 200),
  ziskano_at timestamptz not null default now(),
  confidence numeric check (confidence between 0 and 1),
  check (ico is not null or contact_id is not null)
);

-- ---------------------------------------------------------------- souhlasy a suppressions
create table consents (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  typ text not null,
  ziskano_at timestamptz not null default now(),
  dukaz jsonb,
  platnost_do date
);

create table suppressions (
  email_nebo_domena text primary key,                      -- TP-7
  duvod text not null,
  vlozeno_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- obsah (fáze 0/3)
create table claims (
  id uuid primary key default gen_random_uuid(),
  tvrzeni text not null,
  doklad text,
  stav text not null default 'navrzeno' check (stav in ('navrzeno','schvaleno','zamitnuto')),
  schvaleno_at timestamptz
);

create table templates (
  id uuid primary key default gen_random_uuid(),
  verze int not null default 1,
  segment text not null,
  kanal text not null,
  predmet text,
  telo text not null,
  struktura_id text,
  stav text not null default 'navrzeno' check (stav in ('navrzeno','schvaleno','vyrazeno')),
  schvaleno_kym text,
  schvaleno_at timestamptz
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id),
  template_id uuid references templates(id),
  kanal text not null,
  finalni_text text not null,                              -- TP-13: text tak, jak odešel
  odeslano_at timestamptz,
  provider_id text,
  stav text not null default 'pripraveno'
);

create table events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id),
  typ text not null,
  at timestamptz not null default now(),
  raw jsonb
);

-- ---------------------------------------------------------------- partneři (fáze 2)
create table partneri (
  id uuid primary key default gen_random_uuid(),
  typ text not null,
  nazev text not null,
  obec text,
  kontakt text,
  stav text not null default 'novy',
  posledni_kontakt_at timestamptz
);

-- ---------------------------------------------------------------- provoz
create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  zacatek timestamptz not null default now(),
  konec timestamptz,
  vstup jsonb,
  vystup jsonb,
  naklady_usd numeric,
  chyby jsonb
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  typ text not null,
  popis text not null,
  oduvodneni text,
  data jsonb,
  stav text not null default 'ceka' check (stav in ('ceka','schvaleno','zamitnuto')),
  rozhodl text,
  rozhodnuto_at timestamptz
);

create table incidents (
  id uuid primary key default gen_random_uuid(),
  typ text not null,
  zavaznost text not null,
  popis text not null,
  detekovano_at timestamptz not null default now(),
  stav text not null default 'otevreny',
  opatreni text
);

-- TP-8: jediný řádek; odesílání defaultně vypnuté, zapíná jen člověk.
create table system_state (
  id boolean primary key default true check (id),
  sending_enabled boolean not null default false,
  denni_limit int not null default 10,
  zmeneno_kym text,
  zmeneno_at timestamptz not null default now()
);

insert into system_state (id) values (true);
