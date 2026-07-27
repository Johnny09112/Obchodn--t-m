-- Název obce jídelny. Potřebný pro zdroje, které znají jen obec pracoviště
-- (otevřená data MPSV) a ne přesnou adresu — podle názvu se dá dohledat
-- střed obce jako doložitelná přibližná poloha pracoviště.
alter table jidelny add column obec text;
