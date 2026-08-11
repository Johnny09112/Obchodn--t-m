-- Obchodní signály: co se u firmy PRÁVĚ TEĎ děje.
--
-- Proč vlastní tabulka a ne další sloupec v `companies`: atribut je
-- vlastnost („má 30 zaměstnanců" platí pořád), signál je **událost
-- s platností** („minulý týden vypsala 4 místa na směny" za tři měsíce
-- vyprchá). Míchat obojí do jedné tabulky by znamenalo, že se buď mažou
-- fakta, nebo hromadí neplatné podněty.
--
-- Druhy signálů jsou v RESJTŘÍKU, ne v kódu — stejný princip, který se
-- osvědčil u atributů (0035): přidat signál má být nastavení, ne
-- programování. Náklad na údržbu má růst s počtem ZDROJŮ, ne signálů.

create table druhy_signalu (
  kod text primary key,
  nazev text not null,
  -- Co signál znamená. Jde na obrazovku obchodníkovi, tak se to i píše.
  popis text not null check (length(trim(popis)) > 0),
  -- Jak silný podnět to je, 0–1. Výchozí; konkrétní nález ji smí zpřesnit.
  sila_vychozi numeric not null check (sila_vychozi between 0 and 1),
  -- Za kolik dnů podnět vyprchá. NULL = neomezeně (typicky vylučovací
  -- signály — „vaří si sama" nepřestane platit za měsíc).
  platnost_dnu int check (platnost_dnu is null or platnost_dnu > 0),
  -- Vylučovací signál říká „tuhle NEoslovovat". Je stejně cenný jako
  -- kladný — ušetřený hovor se počítá jako nalezený.
  vylucovaci boolean not null default false,
  aktivni boolean not null default true,
  created_at timestamptz not null default now()
);

create table signaly (
  id uuid primary key default gen_random_uuid(),
  ico text not null references companies(ico) on delete cascade,
  druh text not null references druhy_signalu(kod) on delete restrict,
  -- Stabilní identita výskytu: druhý běh nad týmiž daty nesmí založit
  -- druhý řádek. Typicky měsíc dávky nebo id smlouvy.
  klic text not null,
  sila numeric not null check (sila between 0 and 1),
  -- Jedna věta pro obchodníka: PROČ zrovna teď zrovna tuhle firmu.
  popis text not null check (length(trim(popis)) > 0),
  zjisteno_at timestamptz not null default now(),
  -- NULL = nevyprší.
  plati_do timestamptz,
  -- TP-2 platí i tady: bez zdroje a doslovné citace žádný podnět.
  zdroj_url text not null check (length(trim(zdroj_url)) > 0),
  citace text not null check (length(trim(citace)) > 0),
  unique (ico, druh, klic)
);

-- Obrazovka se ptá „co je nového a ještě to platí". Podmínka `plati_do >
-- now()` se do indexu dát NEMŮŽE — `now()` není immutable a Postgres to
-- odmítne. Index je proto obyčejný nad oběma sloupci a filtr na platnost
-- řeší dotaz.
create index signaly_platnost on signaly (plati_do, zjisteno_at desc);
create index signaly_ico on signaly (ico);

insert into druhy_signalu (kod, nazev, popis, sila_vychozi, platnost_dnu, vylucovaci) values
  ('smenny_provoz_vice', 'vícesměnný provoz',
   'Firma jede na víc směn nebo nepřetržitě. Pro docházkové systémy je to hlavní důvod, proč je potřebuje — směny se ručně evidovat nedají. U stravování znamená, že se jí i mimo obvyklou dobu oběda.',
   0.7, null, false),
  ('nabira_lidi', 'nabírá zaměstnance',
   'Firma má právě teď otevřené inzeráty. Noví lidé znamenají nové potřeby — od obědů přes oděvy po zaškolení — a rozhoduje se o nich hned, ne za rok.',
   0.6, 90, false),
  ('vlastni_jidelna', 'má vlastní jídelnu',
   'Firma si vaří sama. Pro nabídku obědů ji NEOSLOVOVAT — ušetřený hovor se počítá stejně jako nalezený. Pro jiné use-casy je to naopak bezvýznamné.',
   0.9, null, true),
  ('nova_v_uzemi', 'nová firma v území',
   'Firma se v území objevila až teď — v minulém běhu tu nebyla. Dodavatele si vybírá při rozjezdu a pak to roky nemění, takže je to nejlepší možný okamžik.',
   0.8, 180, false);

-- RLS: bez ní by přes datové API mohl kdokoli s veřejným klíčem projektu
-- zakládat podněty k oslovení. `test/pravidla.test.ts` to hlídá na všech
-- tabulkách; `0015_rls.sql` zapnul RLS jen na tehdejších, každá pozdější
-- migrace si to musí udělat sama.
alter table druhy_signalu enable row level security;
alter table signaly enable row level security;

create policy druhy_signalu_cteni on druhy_signalu
  for select to authenticated using (true);
create policy druhy_signalu_zapis on druhy_signalu
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin'))
  with check (public.role_uzivatele() in ('super-admin', 'admin'));

create policy signaly_cteni on signaly
  for select to authenticated using (true);
create policy signaly_zapis on signaly
  for all to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin'))
  with check (public.role_uzivatele() in ('super-admin', 'admin'));

comment on table signaly is
  'Události s platností — proč zrovna teď zrovna tuhle firmu. Na rozdíl od `evidence`, která drží fakta, tohle vyprchává.';
comment on table druhy_signalu is
  'Rejstřík druhů signálů. Přidat signál má být nastavení, ne programování.';
