-- Aplikace smí zapisovat, které firmy do oblasti spadly.
--
-- Rozhodnutí majitele 2026-07-29. Dosud byla `oblast_firmy` mezi tabulkami
-- jen ke čtení, protože do kartotéky zapisuje agent, ne člověk. U téhle
-- tabulky to ale dávalo špatný výsledek: oblast založená v aplikaci měla
-- příslušnost firem prázdnou, dokud ji nepřepočítala příkazová řádka.
--
-- Proč to není obcházení pravidla: `oblast_firmy` **není údaj o firmě**.
-- Je to odvozenina z tvaru oblasti a souřadnic — spočítat se dá kdykoli
-- znovu ze stejných dat a stejným výpočtem (`src/oblast-tvar.ts`). Nevzniká
-- tu žádné nové tvrzení o firmě, takže se TP-2 (každý atribut se zdrojem)
-- netýká. Kartotéka sama — `companies`, `contacts`, `evidence` — zůstává
-- pro lidi dál jen ke čtení.
--
-- Kdo smí: stejné role jako u `oblasti`, protože jde o tutéž práci.
-- Kdo nesmí: nepřihlášený (žádné pravidlo pro `anon`) a role `host`.

create policy oblast_firmy_zapis on public.oblast_firmy
  for all
  to authenticated
  using (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'))
  with check (public.role_uzivatele() in ('super-admin', 'admin', 'uzivatel'));

comment on table public.oblast_firmy is
  'Odvozeno z tvaru oblasti — smí přepsat aplikace i agent, kdykoli se dá přepočítat';
