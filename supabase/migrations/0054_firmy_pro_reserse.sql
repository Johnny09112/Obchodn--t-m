-- Výběr firem pro rešerši — jedno pravidlo v databázi.
--
-- Objeveno 18. 8. 2026: majitel objednal v aplikaci rešerši pro 20 firem
-- kampaně Hrobce, hlídka objednávku vyzvedla — a dávka skončila „hotovo,
-- 0 firem", bez jediného slova. Aplikace totiž nabídku počítala VLASTNÍM
-- pravidlem (razítko + spojení), zatímco jádro od 13. 8. filtruje i stav
-- firmy a počet pokusů. Dvě kopie téhož pravidla se rozešly přesně tak,
-- jak předpovídá past „tri-kopie-seznamu-atributu": všech 61 firem Hrobců
-- je „čekající na jídelnu", takže jádro po vyzvednutí vybralo nulu.
--
-- Odteď pravidlo sedí tady a obě strany ho čtou odtamtud: jádro
-- (`firmyProReserse` v src/reserse.ts) i aplikace (počítadlo „kolik firem
-- rešerši ještě potřebuje" před objednáním).

create or replace function public.firmy_pro_reserse(p_kampan_id uuid, p_limit int)
returns table (ico text, nazev text, skore numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select c.ico, c.nazev, c.skore
    from kampan_firmy kf
    join companies c on c.ico = kf.ico
   where kf.kampan_id = p_kampan_id
     and kf.stav = 'vybrana'
     and c.obohaceno_at is null
     -- Tři pokusy a dost — jinak se firma bez nálezu vrací do každé další
     -- dávky a fronta nikdy nedojde (13. 8. 2026, migrace 0042).
     and c.reserse_pokusu < 3
     -- Stavy, na které se agentní čas nevydává (rozhodnutí majitele
     -- 13. 8. 2026). Psáno jako výčet ZAKÁZANÝCH stavů, ne povolených —
     -- nový pracovní stav se nesmí tiše vyřadit z fronty.
     and c.stav not in ('cekajici_na_jidelnu', 'zamitnuty')
   order by c.skore desc nulls last, c.ico
   -- `limit null` v SQL znamená „bez limitu" — aplikace tak spočítá celou
   -- frontu jediným voláním.
   limit p_limit
$$;

comment on function public.firmy_pro_reserse is
  'Které firmy kampaně rešerši ještě potřebují. Jediný zdroj pravdy — čte ho jádro i aplikace.';
