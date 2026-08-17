---
name: kontrola-kvality
description: Ruční kontrola vzorku firem — použij, když je potřeba změřit podíl chybných záznamů podle SPEC fáze 1, nebo když majitel chce ověřit, jestli se datům dá věřit. Vybere vzorek, připraví ho k proklikání a zapíše výsledek.
---

# Kontrola kvality vzorku

SPEC kap. 12 žádá u fáze 1 „ruční kontrolu vzorku 30 firem" a metriku
**podíl chybných záznamů**. Tuhle metriku nespočítá žádný dotaz — jedině
člověk, který si údaj otevře a porovná se zdrojem.

## Kdy to použít

- Uzavírá se fáze 1 (poslední nesplněné kritérium).
- Změnil se způsob sběru nebo profil produktu a je potřeba vědět, jestli se
  kvalita nepropadla.
- Majitel se ptá „dá se těm datům věřit?".

## Postup

1. **Vygeneruj vzorek** — `npm run cli -- vzorek-kontroly --pocet 30`.
   Vzorek musí být **různorodý, ne nejlepších třicet**: mikro i korporát,
   firmy s kontaktem i bez něj, různé obce a různé zdroje. Kontrola nad
   samými povedenými záznamy nezměří nic.
2. **Nech to projít člověkem.** Výstup je HTML, kde je u každé firmy hodnota,
   doslovná citace a odkaz na zdroj. Kontrolor u každé odpovídá sedí / nesedí
   a u „nesedí" napíše proč.
3. **Spočítej podíl chybných** a zapiš ho i s datem do paměti
   (`_claude/memory/context/project-context.md`). Bez zápisu je kontrola
   jednorázový dojem, ne měřítko.
4. **Nálezy převeď na opravy** — každý chybný záznam je buď datová chyba
   (smazat a nechat dohledat znovu), nebo chyba postupu (opravit zadání
   agenta, ne jednotlivý řádek).

## Co znamená „chybný záznam"

Chybný je záznam, u kterého platí aspoň jedno:

- **hodnota neodpovídá citaci** — citace mluví o něčem jiném (typicky:
  v `obor` je počet volných míst, nalezeno 17. 8. 2026 u sedmi firem),
- **zdroj je mrtvý nebo nesouvisející** — odkaz nevede na stránku, kde údaj
  stojí, nebo vede na jinou firmu,
- **kontakt je zařazený do špatné úrovně podle TP-6** — jmenná adresa
  označená jako adresa pro nabídky a naopak,
- **firma je zjevně mimo** — jiné IČO, zaniklý subjekt, pobočka vedená jako
  samostatná firma.

**Chybný není:** prázdný údaj. Co není doložené, se nezapisuje — prázdno je
správný výsledek, ne chyba.

## Na co si dát pozor

- **Kontrolor musí vidět citaci i odkaz vedle hodnoty**, jinak nekontroluje
  data, ale svůj dojem z nich.
- **Nepočítej podíl z firem, ale ze záznamů.** Firma s deseti údaji a jednou
  chybou není „chybná firma" — je to jeden chybný záznam z deseti.
- Výsledek pod 5 % chybných je dobrý, nad 15 % znamená, že je něco špatně
  v zadání agenta, ne v jednotlivých nálezech.
