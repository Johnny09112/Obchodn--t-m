-- Partnerská jídelna je právní subjekt — a jako takový vyjde ze sweepu
-- rejstříku jako běžný zaměstnavatel se zaměstnanci.
--
-- Stalo se to v Tlučné: základní škola, která pro nás vaří, skončila
-- v kartotéce mezi kandidáty na oslovení. Sama sobě obědy prodávat nebude.
--
-- Řešení je IČO, ne název: názvy se v rejstříku píšou jinak než na vývěsce
-- („ZŠ a MŠ Tlučná" vs. „Základní škola s mateřskou školou Tlučná okres
-- Plzeň-sever"), takže porovnávat je by bylo nespolehlivé.
--
-- IČO je nepovinné: jídelna se smí založit dřív, než ho někdo dohledá.
-- Dokud chybí, filtr pro ni prostě neplatí.

alter table jidelny add column ico text check (ico ~ '^[0-9]{8}$');

comment on column jidelny.ico is
  'IČO provozovatele jídelny — firma se stejným IČO se nesmí stát kandidátem';

-- Nový důvod vyřazení do deníku.
alter table vyrazeni drop constraint vyrazeni_duvod_check;
alter table vyrazeni add constraint vyrazeni_duvod_check check (duvod in (
  'neplatne_ico',        -- nesedí kontrolní součet
  'neni_v_ares',         -- rejstřík firmu nezná
  'nesparovano',         -- název z mapy se nepodařilo přiřadit k subjektu
  'agentura',            -- agentura práce, nabírá pro někoho jiného
  'vylouceny_obor',      -- restaurace, agentury (CZ-NACE 56, 78)
  'bez_zamestnancu',     -- registr říká „bez zaměstnanců"
  'neuvedena_velikost',  -- velikost neuvedena a zdroj je slabý (sweep)
  'poloha_neznama',      -- adresu se nepodařilo zaměřit
  'mimo_zonu',           -- příliš daleko od jídelny
  'partnerska_jidelna'   -- je to náš partner, ne zákazník
));
