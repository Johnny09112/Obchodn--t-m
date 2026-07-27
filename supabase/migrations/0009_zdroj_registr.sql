-- Nový zdroj kandidátů: kompletní registr ekonomických subjektů ČSÚ
-- (otevřená data, res_data.csv).
--
-- Proč přibyl: vyhledávací API ARES vydá nejvýš 1 000 výsledků na dotaz,
-- takže sweep podle obce padal všude nad velikost Stříbra a Prahu ani Brno
-- nešlo pokrýt vůbec. Registr obsahuje všechny subjekty v ČR najednou,
-- takže limit přestává platit — a navíc nese velikost firmy, takže se malé
-- firmy odfiltrují ještě před ověřováním.

alter table vyrazeni drop constraint vyrazeni_zdroj_check;
alter table vyrazeni add constraint vyrazeni_zdroj_check
  check (zdroj in ('mpsv', 'osm', 'ares', 'registr'));
