-- Sjednocení názvů velikostních segmentů se SPEC kap. 10.2:
-- mikropodnik (do 25) · střední (25–250) · korporát (nad 250).
-- Původní čtyřstupňová škála (mikro/mala/stredni/velka) vznikla dřív, než
-- byl k dispozici oficiální číselník počtu zaměstnanců ze statistického
-- registru, a neodpovídala segmentaci, podle které se opravdu obchoduje.

update companies set velikost_kategorie = 'mikro'    where velikost_kategorie = 'mala';
update companies set velikost_kategorie = 'korporat' where velikost_kategorie = 'velka';

alter table companies drop constraint if exists companies_velikost_kategorie_check;
alter table companies add constraint companies_velikost_kategorie_check
  check (velikost_kategorie in ('mikro', 'stredni', 'korporat'));
