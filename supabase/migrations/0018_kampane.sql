-- Kampaň = pojmenovaný seznam firem s vlastním kontextem.
--
-- NENÍ to rozesílka. SPEC kap. 10.2 kampaňový režim zrušil („individuální
-- oslovení, ne kampaň"); kampaň je tu seznam práce, ze kterého ve fázi 3
-- odchází oslovení po jedné firmě. Zadání:
-- docs/superpowers/specs/2026-07-29-kampane-design.md

create table kampane (
  id uuid primary key default gen_random_uuid(),
  nazev text not null,
  popis text,
  -- Čím se kampaň liší. Podklad pro člověka, ne šablona zprávy.
  kontext text,
  spravce text not null,
  -- Území, ze kterého kampaň vychází. `restrict`, aby se oblast nedala
  -- smazat zpod nohou kampani, která na ní stojí.
  oblast_id uuid references oblasti(id) on delete restrict,
  jidelna_id uuid references jidelny(id) on delete set null,
  stav text not null default 'rozpracovana' check (stav in (
    'rozpracovana', 'ceka_na_pruzkum', 'k_posouzeni',
    'schvalena', 'bezi', 'uzavrena', 'zrusena')),
  -- Na kterém kroku průvodce se skončilo, aby se dalo navázat.
  krok int not null default 1 check (krok between 1 and 4),
  duvod_zruseni text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zruseni_ma_duvod check (stav <> 'zrusena' or duvod_zruseni is not null)
);

-- Jedinečnost hlídá databáze, ne formulář: dva lidé mohou zakládat naráz.
create unique index kampane_nazev_idx on kampane (lower(nazev));

create trigger kampane_updated_at before update on kampane
  for each row execute function nastav_updated_at();

create table kampan_firmy (
  kampan_id uuid not null references kampane(id) on delete cascade,
  ico text not null references companies(ico) on delete cascade,
  stav text not null default 'vybrana' check (stav in ('vybrana', 'vyrazena')),
  duvod_vyrazeni text,
  zaradeno_at timestamptz not null default now(),
  primary key (kampan_id, ico),
  -- Stejně jako u deníku vyřazení při sběru: bez důvodu se pravidla nebrousí.
  constraint vyrazeni_ma_duvod check (stav <> 'vyrazena' or duvod_vyrazeni is not null)
);

create index kampan_firmy_kampan_idx on kampan_firmy (kampan_id);

-- Fronta objednávek průzkumu. Aplikace agenta spustit neumí (běží v Claude
-- Code, ne na serveru), takže si ho objedná a agent si práci vyzvedne.
-- `pruzkumy` je objednávka, `agent_runs` provedení — jedna objednávka může
-- mít i víc pokusů.
create table pruzkumy (
  id uuid primary key default gen_random_uuid(),
  oblast_id uuid not null references oblasti(id) on delete cascade,
  kampan_id uuid references kampane(id) on delete set null,
  stav text not null default 'ceka' check (stav in ('ceka', 'bezi', 'hotovo', 'selhalo')),
  pozadal text not null,
  pozadano_at timestamptz not null default now(),
  zahajeno_at timestamptz,
  dokonceno_at timestamptz,
  run_id uuid references agent_runs(id),
  firem_prevzato int,
  firem_novych int,
  chyba text,
  constraint selhani_ma_chybu check (stav <> 'selhalo' or chyba is not null)
);

create index pruzkumy_fronta_idx on pruzkumy (stav, pozadano_at);

-- ─────────────────────────────────────────── pojistky u schválení
--
-- Prostá podmínka (`check`) na tohle nestačí — musí se koukat do jiných
-- tabulek. Formulář tlačítko zašedne dřív, ale to je pohodlí, ne pojistka.

create or replace function public.kampan_pred_schvalenim() returns trigger
language plpgsql
as $$
begin
  -- Pojistky pro schválení platí na INSERT i UPDATE
  -- Na INSERT: rozlišit TG_OP, protože old není přiřazeno
  if new.stav = 'schvalena' and (
    TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and old.stav is distinct from 'schvalena')
  ) then
    if exists (
      select 1 from pruzkumy p
      where p.kampan_id = new.id and p.stav in ('ceka', 'bezi')
    ) then
      raise exception 'Kampaň nejde schválit, dokud neproběhl objednaný průzkum';
    end if;

    if not exists (
      select 1 from kampan_firmy kf
      join contacts c on c.ico = kf.ico
      where kf.kampan_id = new.id and kf.stav = 'vybrana'
    ) then
      raise exception 'Kampaň nejde schválit bez jediné firmy s doloženým kontaktem';
    end if;
  end if;
  return new;
end $$;

create trigger kampan_schvaleni before insert or update on kampane
  for each row execute function public.kampan_pred_schvalenim();

-- ─────────────────────────────────────────── kdo co smí
--
-- Ve stylu migrace 0016. Čtení kdokoli přihlášený, zápis tým.
-- Schválit smí jen admin a výš — je to brána, za kterou ve fázi 3 začne
-- odcházet komunikace ven. Pravidlo se dá zapsat přes `with check`, protože
-- to kouká na výslednou podobu řádku.

alter table kampane enable row level security;
alter table kampan_firmy enable row level security;
alter table pruzkumy enable row level security;

create policy kampane_cteni on kampane
  for select to authenticated using (true);

create policy kampane_zapis on kampane
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'))
  with check (
    public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel')
    and (stav <> 'schvalena' or public.role_uzivatele() in ('super-admin', 'admin'))
  );

create policy kampan_firmy_cteni on kampan_firmy
  for select to authenticated using (true);

create policy kampan_firmy_zapis on kampan_firmy
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'))
  with check (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'));

create policy pruzkumy_cteni on pruzkumy
  for select to authenticated using (true);

create policy pruzkumy_zapis on pruzkumy
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'))
  with check (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'));

comment on table kampane is
  'Pojmenovaný seznam firem s kontextem. Není to rozesílka — SPEC kap. 10.2.';
