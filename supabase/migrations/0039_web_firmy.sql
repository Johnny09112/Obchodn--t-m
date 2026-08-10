-- Web firmy se má hromadit v kartotéce, ne mizet mezi běhy.
--
-- Agent web firmy dřív našel (Hrobce: 10 z 25 firem), ale adresa přežila
-- jen jako `zdroj_url` u kontaktu — příští běh začínal od nuly, protože
-- `companies` neměla kam si ji uložit. Řešení jde přes existující
-- mechanismus atributů (0035, 0036), ne přes nový: nový atribut `web`
-- s vlastním sloupcem v `companies`, propsaným přes `ATRIBUTY_SLOUPCE`
-- (src/whitelist.ts) stejně jako `ma_vlastni_jidelnu` nebo
-- `zpusob_stravovani`.

alter table companies add column web text;

insert into atributy (kod, nazev, popis, do_zpravy, hleda_agent) values
  ('web', 'web firmy',
   'oficiální web firmy (adresa https://…), NE katalogový záznam o firmě ' ||
   '(ARES, ifirmy.cz, firmy.cz, epoptavka.cz a podobné weby nejsou web ' ||
   'firmy, i kdyby na nich firma měla svůj profil) — ulož adresu, na které ' ||
   'jsi informace o firmě skutečně našel', false, true);

-- `web` do zprávy nepatří (do_zpravy = false) — whitelist pro oslovení se
-- touhle migrací nemění, jen se rozšiřuje sběr.
insert into profil_atributy (profil_kod, atribut_kod) values
  ('cantinero', 'web'),
  ('cantinero-business', 'web');

comment on column companies.web is
  'Oficiální web firmy, propsaný z atributu `web` (viz atributy.kod = ''web''). Nepovinné.';
