-- Urgentní objednávka průzkumu.
--
-- Rozhodnutí majitele 2026-07-31: naplánovaný běh stačí třikrát denně, ale
-- u spěchající objednávky se nedá čekat do večera.
--
-- **Tlačítko v aplikaci agenta NESPUSTÍ.** Aplikace běží v prohlížeči a na
-- počítač, kde Čmuchal běží, nedosáhne — to je totéž, co majitel vědomě
-- odmítl (dát webu právo spustit agenta). Tlačítko jen označí objednávku;
-- vedle řídkého denního běhu proto běží drobná hlídka, která se často ptá,
-- jestli něco urgentního nečeká. Prázdná fronta stojí jeden dotaz.

alter table pruzkumy add column urgentni boolean not null default false;

comment on column pruzkumy.urgentni is
  'Spěchá — hlídka ji vyzvedne mimo řádné denní okno. Nastavuje člověk z aplikace, agenta to nespouští.';

-- Hlídka se ptá často a jen na urgentní; bez indexu by pokaždé četla celou
-- frontu. Částečný index, protože urgentní bude menšina.
create index pruzkumy_urgentni_idx on pruzkumy (pozadano_at) where urgentni;
