-- Závěrečná revize jádra kampaní (před sloučením do main) našla dvě věci
-- k opravě. Obě patří do stejné migrace, protože obě mění, kdy a jak
-- databáze pouští kampaň dál — a obě nahrazují objekty z 0018/0019, které
-- už jsou nasazené a needitují se.

-- ─────────────────────────────────────────── 1) hranice fáze projektu
--
-- Stavy `bezi` a `uzavrena` jsou v číselníku (`kampane.stav check`) od
-- začátku jen kvůli fázi 3 (odesílání) — viz komentář u `PRECHODY` v
-- src/kampan.ts a kap. 5 v docs/superpowers/specs/2026-07-29-kampane-design.md.
-- Dosud to hlídal jen kód (`src/kampan.ts`), ale webová aplikace
-- (`app/src/data.ts`) čte i zapisuje přímo do databáze a přes tenhle kód
-- nikdy neprojde. Podle pravidla „tvrdá pravidla se vynucují v kódu/DB,
-- ne v promptu" patří zábrana i sem.
--
-- **Tahle zábrana je záměrně dočasná — padne ve fázi 3**, až se odesílání
-- povolí a stavy `bezi`/`uzavrena` začnou dávat smysl. Není to omyl ani
-- pozůstatek, který by šel při úklidu smazat beze čtení SPEC.

create or replace function public.kampan_blokuje_faze3_stavy() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.stav in ('bezi', 'uzavrena') then
    raise exception
      'Stav „%" patří až do fáze 3 (odesílání) — ve fázi 0–2 do něj kampaň nesmí přejít.',
      new.stav;
  end if;
  return new;
end $$;

comment on function public.kampan_blokuje_faze3_stavy() is
  'Dočasná zábrana proti stavům bezi/uzavrena (mimo rozsah fáze 0-2). '
  'Zruší se ve fázi 3, až se odesílání povolí — viz 0020_kampan_stavy_faze.sql.';

create trigger kampan_faze3_zabrana before insert or update on public.kampane
  for each row execute function public.kampan_blokuje_faze3_stavy();

-- ─────────────────────────────────────────── 2) schválení až po hotovém průzkumu
--
-- `kampan_pred_schvalenim` (naposledy 0019) blokovala schválení, jen když
-- byl objednaný průzkum ve stavu 'ceka' nebo 'bezi'. Zadání (kap. 4 designu)
-- ale žádá „požadavek je ve stavu hotovo" — takže kampaň s průzkumem, který
-- SELHAL, schválením dosud prošla, což nemělo. Podmínka se proto mění na
-- „žádný přidružený průzkum, který není hotovo" — chybí-li průzkum úplně,
-- schválení nic nebrání (kampaň se mohla obejít bez objednávky).
--
-- Zbytek beze změny oproti 0019: search_path pevná, tabulky se schématem,
-- rozlišení INSERT/UPDATE přes TG_OP.

create or replace function public.kampan_pred_schvalenim() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Pojistky pro schválení platí na INSERT i UPDATE
  -- Na INSERT: rozlišit TG_OP, protože old není přiřazeno
  if new.stav = 'schvalena' and (
    TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and old.stav is distinct from 'schvalena')
  ) then
    if exists (
      select 1 from public.pruzkumy p
      where p.kampan_id = new.id and p.stav <> 'hotovo'
    ) then
      raise exception 'Kampaň nejde schválit, dokud neproběhl objednaný průzkum';
    end if;

    if not exists (
      select 1 from public.kampan_firmy kf
      join public.contacts c on c.ico = kf.ico
      where kf.kampan_id = new.id and kf.stav = 'vybrana'
    ) then
      raise exception 'Kampaň nejde schválit bez jediné firmy s doloženým kontaktem';
    end if;
  end if;
  return new;
end $$;

comment on function public.kampan_pred_schvalenim() is
  'Pojistky před schválením kampaně (INSERT i UPDATE). Pevná search_path '
  '(nález Supabase „Function Search Path Mutable") — viz 0016 role_uzivatele. '
  'Průzkum musí být hotovo (ne jen mimo ceka/bezi) — selhalý průzkum blokuje.';
