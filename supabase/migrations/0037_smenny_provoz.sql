-- Přidání atributu „pracovní režim" — první atribut zavedený mimo původní
-- osmičku a prvotní ověření, že nastavitelnost atributů přes tabulky funguje.
--
-- Smysl: Tento atribut podtrhuje, že nový atribut se zavádí BEZ ZÁSAHU DO KÓDU.
-- Migrace se jen přidá, testy by měly projít, agent si ho vezme z tabulky
-- `atributy` a začne ho hledat na webu. Pokud toto funguje, funguje i přidávání
-- dalších atributů v budoucnosti.

insert into atributy (kod, nazev, popis, do_zpravy, hleda_agent)
values (
  'pracovni_rezim',
  'pracovní režim',
  'kolik směn denně se ve firmě pracuje — jednosměnná (9–17), dvousměnná (ranní a odpolední), třísměnná, nebo nepřetržitý provoz; hledej na kariérní stránce, v inzerátech na volné pozice a v popisech provozu nebo pracovního režimu',
  false,
  true
);

-- Přidej atribut jen do profilu Cantinero (firmy), ne do Cantinero Business.
insert into profil_atributy (profil_kod, atribut_kod)
values ('cantinero', 'pracovni_rezim');
