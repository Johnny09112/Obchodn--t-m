-- Fronta objednávek AI průzkumu.
--
-- Postavená na vzoru `pruzkumy` (0018), ale s jedním podstatným rozdílem:
-- průzkum vyřizuje kód, rešerši dělá agent. Obsluha proto práci neudělá
-- sama — spustí Claude Code a počká na něj (viz src/cmuchal-spousteni.ts).
--
-- Firmy se do dávky vybírají až při vyřízení, ne při objednání. Objednávka
-- tak nemůže zestárnout, když se kampaň mezitím změní.

create table reserse (
  id uuid primary key default gen_random_uuid(),
  kampan_id uuid not null references kampane(id) on delete cascade,
  stav text not null default 'ceka' check (stav in ('ceka','bezi','hotovo','selhalo')),
  firem_zadano int not null check (firem_zadano > 0),
  -- Co hledat. Zatím jedna výchozí věta odkazující na playbook; po zavedení
  -- profilů produktu (ADR 0002) sem přijde profil kampaně.
  zadani text not null,
  pozadal text not null,
  pozadano_at timestamptz not null default now(),
  zahajeno_at timestamptz,
  dokonceno_at timestamptz,
  run_id uuid references agent_runs(id),
  firem_zpracovano int,
  firem_s_nalezem int,
  chyba text,
  constraint selhani_ma_chybu check (stav <> 'selhalo' or chyba is not null)
);

create index reserse_fronta_idx on reserse (stav, pozadano_at);

alter table reserse enable row level security;

create policy reserse_cteni on reserse
  for select to authenticated using (true);

-- Zapisovat smí správce kampaně, jeho zástup a admin — stejně jako
-- u firem v kampani.
create policy reserse_zapis on reserse
  for all to authenticated
  using (public.smi_do_kampane(kampan_id))
  with check (public.smi_do_kampane(kampan_id));
