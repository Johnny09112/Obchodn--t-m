-- Přidání atributu „směnný provoz" — první atribut zavedený mimo původní
-- osmičku a prvotní ověření, že nastavitelnost atributů přes tabulky funguje.
--
-- Smysl: Tento atribut demonstruje, že `src/` se pro nový atribut nemění —
-- migrace se přidá, testy se srovnají (to je v pořádku), agent si ho vezme
-- z tabulky `atributy` a začne ho hledat. Pokud toto funguje, funguje i
-- přidávání dalších atributů v budoucnosti.

insert into atributy (kod, nazev, popis, do_zpravy, hleda_agent)
values (
  'smenny_provoz',
  'směnný provoz',
  'kolik směn denně se ve firmě pracuje — jednosměnná (9–17), dvousměnná (ranní a odpolední), třísměnná, nebo nepřetržitý provoz; hledej na kariérní stránce, v inzerátech na volné pozice a v popisech provozu nebo pracovního režimu',
  false,
  true
);

-- Přidej atribut jen do profilu Cantinero (firmy), ne do Cantinero Business.
insert into profil_atributy (profil_kod, atribut_kod)
values ('cantinero', 'smenny_provoz');
