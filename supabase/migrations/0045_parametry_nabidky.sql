-- Parametry nabídky — co o prodávané věci sledujeme.
--
-- Požadavek majitele (18. 8. 2026): „Pokud u docházkového systému budu
-- chtít nějakou část vždy měnit na základě dat, musí to jít nastavit
-- snadno přes user-friendly rozhraní — bez kódování." Jídelny jsou první
-- případ užití, ne jediný.
--
-- Proč `nabidky` vedle `jidelny`: docházkový systém ani on-line služba
-- nemají zónu ani polohu. Kdyby hodnoty visely na `jidelny`, druhý produkt
-- by si vynutil buď falešnou jídelnu, nebo přepis všeho, co dnes na
-- `jidelny` závisí (`dosah`, `zona`, `cmuchal`). Jídelně zůstávají jen
-- údaje, které jsou opravdu jen její: poloha, zóna, kapacita, stav.

create table nabidky (
  id uuid primary key default gen_random_uuid(),
  produkt_kod text not null,                    -- shodné s profily.kod
  nazev text not null,
  vytvoreno_at timestamptz not null default now()
);

comment on table nabidky is
  'Co prodáváme. Dnes školní obědy z jídelny, jindy docházkový systém.';

alter table jidelny add column nabidka_id uuid references nabidky(id);

-- Definice parametru. Visí na produktu, ne na jednotlivé nabídce —
-- „cena oběda" má smysl u všech jídelen, ne jen u té jedné.
create table parametry_nabidky (
  id uuid primary key default gen_random_uuid(),
  produkt_kod text not null,
  kod text not null,
  nazev text not null,
  druh text not null check (druh in ('cislo', 'text', 'ano_ne', 'vyber')),
  jednotka text,
  moznosti text[] not null default '{}',        -- jen u druhu 'vyber'
  poradi int not null default 0,
  vytvoreno_at timestamptz not null default now(),
  unique (produkt_kod, kod),
  -- Výběr bez možností by byl prázdný seznam k vybírání.
  check (druh <> 'vyber' or cardinality(moznosti) > 0)
);

comment on table parametry_nabidky is
  'Které údaje o nabídce sledujeme. Zavádí je majitel v aplikaci, ne kód.';

-- Hodnota je JEDEN textový sloupec pro všechny čtyři druhy; převod dělá
-- kód podle `druh`. Čtyři sloupce pro čtyři druhy by znamenaly, že tři
-- jsou u každého řádku prázdné, a pátý druh by si vynutil migraci.
create table hodnoty_parametru (
  nabidka_id uuid not null references nabidky(id) on delete cascade,
  parametr_id uuid not null references parametry_nabidky(id) on delete cascade,
  hodnota text not null,
  zmeneno_at timestamptz not null default now(),
  primary key (nabidka_id, parametr_id)
);

-- Každá jídelna má právě jednu nabídku. Spoušť schválně: kdyby ji zakládal
-- volající, dřív nebo později vznikne jídelna bez nabídky a ta pak tiše
-- vypadne ze všeho, co se o parametry opírá.
create or replace function public.zaloz_nabidku_k_jidelne()
returns trigger language plpgsql as $$
begin
  if new.nabidka_id is null then
    insert into nabidky (produkt_kod, nazev)
      values ('cantinero', new.nazev)
      returning id into new.nabidka_id;
  end if;
  return new;
end $$;

create trigger jidelny_nabidka
  before insert on jidelny
  for each row execute function public.zaloz_nabidku_k_jidelne();

-- Jídelny, které existovaly před touhle migrací. Páruje se přes dočasný
-- sloupec, ne přes název — dvě jídelny se stejným názvem by se jinak
-- navzájem přepsaly a jedna by zůstala bez nabídky.
alter table nabidky add column puvodni_jidelna_id uuid;

insert into nabidky (produkt_kod, nazev, puvodni_jidelna_id)
  select 'cantinero', nazev, id from jidelny where nabidka_id is null;

update jidelny j
   set nabidka_id = n.id
  from nabidky n
 where n.puvodni_jidelna_id = j.id;

alter table nabidky drop column puvodni_jidelna_id;

-- Výchozí parametry Cantinera. Majitel je smí přejmenovat i smazat —
-- je to výchozí obsah, ne pravidlo.
insert into parametry_nabidky (produkt_kod, kod, nazev, druh, jednotka, moznosti, poradi)
values
  ('cantinero', 'cena_obeda', 'Cena oběda', 'cislo', 'Kč', '{}', 1),
  ('cantinero', 'provize', 'Naše provize', 'cislo', 'Kč', '{}', 2),
  ('cantinero', 'moznosti_vydeje', 'Možnosti výdeje', 'vyber', null,
    array['na místě', 'do vlastního jídlonosiče', 'do jednorázového obalu',
          'hromadný odvoz nebo rozvoz'], 3),
  ('cantinero', 'vari_o_prazdninach', 'Vaří o prázdninách', 'ano_ne', null, '{}', 4);

-- Přístup: čte kdokoli přihlášený, mění admin a výš — stejně jako
-- u jídelen, kapacity a ostatních pravidel hry (migrace 0016).
alter table nabidky enable row level security;
alter table parametry_nabidky enable row level security;
alter table hodnoty_parametru enable row level security;

do $$
declare t text;
begin
  foreach t in array array['nabidky', 'parametry_nabidky', 'hodnoty_parametru'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_cteni', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.role_uzivatele() in (''super-admin'', ''admin''))
         with check (public.role_uzivatele() in (''super-admin'', ''admin''))',
      t || '_sprava', t);
  end loop;
end $$;

create index hodnoty_parametru_nabidka_idx on hodnoty_parametru (nabidka_id);
