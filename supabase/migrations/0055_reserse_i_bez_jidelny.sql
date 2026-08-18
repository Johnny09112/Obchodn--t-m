-- Rešerše smí i na firmy bez jídelny v dosahu.
--
-- Rozhodl majitel 18. 8. 2026 a ruší tím přísnější pravidlo z 13. 8.:
-- „Mohu dělat research i bez jídelny — až v případě odeslání e-mailu
-- nebude kam, tam se to musí zastavit. Ale předpřipravit data si
-- v oblasti přeci mohu."
--
-- Stav `cekajici_na_jidelnu` tedy z výběru mizí. Tvrdá zábrana zůstává
-- tam, kam patří: firma bez jídelny nemá vzdálenost ani cenu, takže ji
-- `nahled_kampane` vyřadí z oslovení — připravit data jde, napsat ne.
--
-- `zamitnuty` zůstává zakázaný: to není „zatím nemá jídelnu", ale
-- „tuhle neoslovovat" (rozhodnutí 4. 8. 2026) — agentní čas nedostane.
--
-- Razítko `obohaceno_at` a strop tří pokusů se nemění.

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
     and c.stav <> 'zamitnuty'
   order by c.skore desc nulls last, c.ico
   limit p_limit
$$;

comment on function public.firmy_pro_reserse is
  'Které firmy kampaně rešerši ještě potřebují. Jediný zdroj pravdy — čte ho jádro i aplikace. Od 18. 8. 2026 včetně firem čekajících na jídelnu.';
