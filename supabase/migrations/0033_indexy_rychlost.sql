-- Indexy, které chyběly od začátku.
--
-- Majitel 2. 8.: „kartotéka se načítá extrémně pomalu, cca 20+ vteřin".
-- Příčina se našla v plánu dotazu:
--
--   ->  Seq Scan on contacts k  (actual time=0.136..0.140 rows=0 loops=13000)
--         Rows Removed by Filter: 969
--
-- Seznam firem si u každé firmy nechává spočítat kontakty. Bez indexu na
-- `contacts.ico` se kvůli tomu **pro každou z 13 767 firem prošla celá
-- tabulka kontaktů** — přes dvanáct milionů porovnání na jedno načtení
-- seznamu. Jedna stránka po tisícovce trvala 1,9 s, čtrnáct stránek přes
-- dvacet vteřin.
--
-- Dokud měla kartotéka pár set firem a kontaktů pár desítek, nebylo to vidět.
-- Teprve ostrá data to ukázala — a je to poučení: cizí klíč index nedělá,
-- musí se založit ručně.

-- Počty kontaktů u firmy a detail firmy.
create index contacts_ico_idx on contacts (ico);

-- Evidence se čte po firmách (detail, metriky) a páruje se ke kontaktu.
create index evidence_ico_idx on evidence (ico);
create index evidence_contact_idx on evidence (contact_id) where contact_id is not null;

-- Filtr na cílovou velikost (kampaně, doplňování kontaktů, složení oblasti).
create index companies_velikost_idx on companies (velikost_kategorie)
  where velikost_kategorie is not null;

-- Stav se filtruje skoro v každém výběru firem.
create index companies_stav_idx on companies (stav);

-- Firmy v oblasti se hledají i opačným směrem, než pokrývá primární klíč
-- (`oblast_firmy_pkey` je (oblast_id, ico), tohle je zdola nahoru).
create index oblast_firmy_ico_idx on oblast_firmy (ico);
