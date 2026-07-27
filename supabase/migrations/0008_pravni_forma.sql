-- Právní forma subjektu z rejstříku (číselník ARES „PravniForma").
--
-- Proč: sweep rejstříku vrací všechno, co v obci sídlí. Dvě velké skupiny
-- nálezů nejsou zaměstnavatelé v našem smyslu:
--
--   1. Bytové domy (společenství vlastníků, bytová družstva) — formálně mají
--      zaměstnance, ale nikdo tam neobědvá. Jen v Hrádku jich bylo přes 15.
--   2. Živnostníci vedení vlastním jménem — jeden člověk, ne firma.
--
-- Rozhodnutí majitele (2026-07-27): bytové domy VYŘADIT, živnostníky
-- ZACHOVAT v samostatné kartotéce — budou se oslovovat jinou formou.
--
-- Ukládáme celý kód, ne odvozený příznak: kdyby se pravidla měla brousit
-- jinak, nemusí se kvůli tomu znovu obcházet rejstřík.

alter table companies add column pravni_forma text;

comment on column companies.pravni_forma is
  'Kód právní formy dle číselníku ARES „PravniForma"; NULL = rejstřík neuvedl';

create index companies_pravni_forma_idx on companies (pravni_forma);

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
  'partnerska_jidelna',  -- je to náš partner, ne zákazník
  'bytovy_dum'           -- společenství vlastníků / bytové družstvo
));
