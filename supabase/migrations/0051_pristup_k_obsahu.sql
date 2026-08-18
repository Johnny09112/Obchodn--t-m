-- Šablony a tvrzení potřebují pravidla přístupu.
--
-- Objeveno proklikáním 18. 8. 2026: krok „Zpráva" u kampaně byl prázdný —
-- žádná šablona, žádná pole, žádný náhled. Příkazová řádka přitom tytéž
-- údaje vypisovala správně.
--
-- Příčina: `templates` i `claims` mají od migrace 0015 zapnuté RLS, ale
-- **nikdy nedostaly jedinou politiku**. Do 0015 se dostaly proto, že RLS
-- se zapínalo plošně na všechny tabulky; do 0016, které politiky rozdávalo,
-- se nedostaly, protože tehdy byly prázdné a nikdo je nečetl. Tabulka
-- s RLS a bez politiky je pro datové API neviditelná — a mlčky: nevrátí
-- chybu, vrátí nula řádků.
--
-- Přístup stejný jako u ostatních „pravidel hry" (jídelny, blacklist,
-- profily): čte kdokoli přihlášený, mění admin a výš. Schvalovat text,
-- který půjde firmám, nesmí běžný uživatel.

do $$
declare t text;
begin
  foreach t in array array['templates', 'claims'] loop
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
