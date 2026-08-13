-- Kolikrát už firma rešerší prošla — i když z ní nic nevypadlo.
--
-- Proč: razítko `obohaceno_at` nastavuje `oznacProverenou`, a ta se volá
-- jen když agent u firmy něco vrátí (nález, kontakt, nebo aspoň položku
-- v `bezNalezu`). Firmu, kterou tiše vynechá, nikdo nerazítkuje — a protože
-- `firmyProReserse` vybírá podle `obohaceno_at is null`, vrátí se do každé
-- další dávky. Vynechá se ze stejného důvodu jako minule (nemá web, nemá
-- inzerát), takže **fronta nikdy nedojde**.
--
-- Zjištěno 13. 8. 2026: dvě dávky zpracovaly 13 firem z dvanácti a přesto
-- jich sedm zbývalo.
--
-- Řešení dvěma sloupci místo přepsání razítka: `obohaceno_at` si podrží
-- svůj význam („něco jsme u ní zjistili"), `reserse_pokusu` nese ten druhý
-- („zkoušeli jsme to"). Rozdíl mezi „nenašlo se" a „nezkusilo se" je tím
-- konečně vidět — a přesně na tenhle rozdíl už tenhle projekt jednou
-- doplatil nulovou dávkou, která vypadala jako hotová práce.

alter table companies add column reserse_pokusu int not null default 0
  check (reserse_pokusu >= 0);
alter table companies add column reserse_naposledy_at timestamptz;

-- Fronta se ptá „koho ještě zkusit" — bez indexu by to při 13 919 firmách
-- znamenalo projít celou kartotéku při každé dávce.
create index companies_reserse_fronta on companies (reserse_pokusu)
  where obohaceno_at is null;

comment on column companies.reserse_pokusu is
  'Kolikrát firma prošla dávkou rešerše, bez ohledu na výsledek. Po vyčerpání limitu se do fronty už nenabízí — jinak by se firma, u které agent nic nenajde, vracela donekonečna.';
comment on column companies.reserse_naposledy_at is
  'Kdy naposledy firma dávkou prošla. Slouží k rozlišení „nenašlo se" od „nezkusilo se".';
