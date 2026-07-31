-- Archivace a mazání kampaní.
--
-- MĚNÍ rozhodnutí ze zadání z 29. 7. kap. 5 („kampaně se nemažou, zrušení je
-- stav s důvodem"). Majitel 31. 7.: kampaň, která už se nebude používat,
-- nemá zabírat místo v přehledu — archivace ji skryje a jde vrátit; mazání
-- je pro případ, kdy má zmizet nadobro.
--
-- **Mazat smí jen admin, ostatní archivují.** Majitel původně chtěl, aby
-- při mazání ne-adminem přišel adminovi potvrzovací e-mail. To postavit
-- nejde — TP-8 zakazuje fázi 0–2 odesílání i implementovat. Vyhrazení
-- mazání adminovi řeší totéž a je věcně silnější: e-mail by dorazil až
-- potom, co jsou data pryč.

-- ── archivace

alter table kampane add column archivovana_at timestamptz;

comment on column kampane.archivovana_at is
  'Kdy byla kampaň uklizena z přehledu. NULL = aktivní. Archivace nic nemaže a jde vrátit.';

create index kampane_archiv_idx on kampane (archivovana_at);

-- ── co po smazané kampani zůstane
--
-- Projekt jinde trvá na doložitelnosti; mazání beze stopy by z toho
-- vybočovalo. Stopa musí kampaň přežít, proto samostatná tabulka, ne
-- sloupec v `kampane`.

create table smazane_kampane (
  id uuid primary key,
  nazev text not null,
  spravce text not null,
  smazal text,
  smazano_at timestamptz not null default now()
);

comment on table smazane_kampane is
  'Co zbylo po smazané kampani. Jen ke čtení — kdyby šla přepsat, ztratil by záznam smysl.';

alter table smazane_kampane enable row level security;

create policy smazane_kampane_cteni on smazane_kampane
  for select to authenticated using (true);

create or replace function public.zaznamenej_smazani() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.smazane_kampane (id, nazev, spravce, smazal)
  values (old.id, old.nazev, old.spravce, public.email_uzivatele());
  return old;
end $$;

create trigger kampan_zaznam_smazani
  before delete on kampane
  for each row execute function public.zaznamenej_smazani();

-- ── kdo smí mazat
--
-- Podmínka „jen když nic neodešlo" se hlídá přes STAV, ne přes tabulku
-- zpráv: `messages` nemá vazbu na kampaň (přidá se ve fázi 3 spolu
-- s odesíláním). Odesílat se ale smí jen z běžící kampaně, takže kampaň,
-- která nikdy nebyla `bezi` ani `uzavrena`, nic neodeslala. Do těch stavů
-- se navíc dnes nedá přejít vůbec (migrace 0020), takže je to podmínka
-- do budoucna, ne dnešní překážka.

create policy kampane_mazani on kampane
  for delete to authenticated
  using (
    public.role_uzivatele() in ('super-admin', 'admin')
    and stav not in ('bezi', 'uzavrena')
  );
