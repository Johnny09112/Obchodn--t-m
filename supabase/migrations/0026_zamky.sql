-- Zámek na běh agenta.
--
-- K čemu: Čmuchal si bude objednávky z fronty brát sám, naplánovaným během
-- (rozhodnutí majitele 2026-07-31). Dva běhy nad toutéž objednávkou by si
-- ale rvaly úseky mezi sebou — `vyridPruzkum` si vyzvedává i úseky ve stavu
-- 'bezi', protože v tom stavu zůstane úsek po pádu procesu. Souběžný běh by
-- tedy druhému bral rozdělanou práci.
--
-- Proč vlastní tabulka a ne zámky Postgresu (`pg_advisory_lock`): připojení
-- jde přes pooler, kde se spojení sdílejí a session zámek nemusí patřit
-- tomu, kdo si myslí, že ho drží. Navíc tenhle zámek jde přečíst očima —
-- „kdo běh drží a od kdy" je otázka, kterou si člověk položí jako první.

create table zamky (
  jmeno text primary key,
  drzitel text not null,
  ziskano_at timestamptz not null default now(),
  -- Poslední známka života. Spadlý proces zámek neuvolní, jen se přestane
  -- ozývat — a po prodlevě si ho vezme někdo jiný.
  srdce_at timestamptz not null default now()
);

comment on table zamky is
  'Kdo právě drží běh agenta. Spadlý proces se pozná podle zastaralého srdce_at.';

alter table zamky enable row level security;

-- Přes API nemá se zámky nikdo co dělat — patří příkazové řádce, která
-- k databázi přistupuje přímo. Čtení se povoluje, ať jde v aplikaci
-- jednou ukázat „průzkum právě běží".
create policy zamky_cteni on zamky
  for select to authenticated using (true);
