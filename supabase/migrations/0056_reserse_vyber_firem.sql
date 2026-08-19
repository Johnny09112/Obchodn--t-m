-- Objednávka rešerše nese jmenovitý výběr firem.
--
-- Vyžádal si majitel 19. 8. 2026: „chci mít možnost tu rešerši udělat jen
-- částečnou — třeba kvůli času… odklikat počet, který mi časově dává
-- smysl (je to taková i dvojí kontrola, abych např. teď nedělal rešerši
-- pro Obec Běšiny)."
--
-- Do té doby objednávka nesla jen POČET a hlídka brala vršek fronty podle
-- skóre — majitel tedy nemohl vyloučit konkrétní firmu, u které rešerše
-- nedává smysl.
--
-- Objednávka bez řádků v téhle tabulce se chová jako dřív (vršek fronty)
-- — kvůli objednávkám pořízeným před touhle migrací i jako rozumný
-- výchozí stav.

create table reserse_firmy (
  reserse_id uuid not null references reserse(id) on delete cascade,
  ico text not null references companies(ico) on delete cascade,
  primary key (reserse_id, ico)
);

comment on table reserse_firmy is
  'Jmenovitý výběr firem k objednávce rešerše. Prázdno = vršek fronty podle skóre.';

-- Přístup zrcadlí tabulku `reserse`: čte tým, zapisuje správce kampaně,
-- jeho zástup a admin — přes kampaň mateřské objednávky.
alter table reserse_firmy enable row level security;

create policy reserse_firmy_cteni on public.reserse_firmy
  for select to authenticated using (true);

create policy reserse_firmy_zapis on public.reserse_firmy
  for all to authenticated
  using (exists (select 1 from reserse r
                  where r.id = reserse_id and public.smi_do_kampane(r.kampan_id)))
  with check (exists (select 1 from reserse r
                       where r.id = reserse_id and public.smi_do_kampane(r.kampan_id)));
