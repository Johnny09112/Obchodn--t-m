---
name: kapacita-se-upravuje-v-aplikaci
description: Volná kapacita jídelny se mění v aplikaci na obrazovce Jídelny, ne příkazem — a je to jediný údaj, který nejde zjistit z dat
type: decision
status: active
created: 2026-08-17
updated: 2026-08-17
related: [dosah-je-tabulka-ne-sloupec, zamitnuty-zapis-bez-chyby]
---

**Rozhodnutí majitele 17. 8. 2026:** volná kapacita jídelny se zadává
v aplikaci, ne příkazem na příkazové řádce.

Do té doby šla kapacita zadat **jedině při zakládání jídelny**
(`seed-jidelna --kapacita`). Žádný příkaz ani obrazovka ji neuměly později
změnit — proto zůstala u 34. ZŠ Plzeň prázdná (`NULL`) a nešla doplnit.
Přitom se kapacita během roku mění a je to číslo, o které se opírá celý
obchod: kolik obědů vůbec máme co prodat.

**Postaveno:** obrazovka `Jídelny` (app/src/Jidelny.tsx), nová položka
v rozcestníku. Ukazuje jídelnu, obec, zónu, **firem v dosahu** a volnou
kapacitu; kapacitu mění admin a výš přímo v řádku.

Podstatné detaily, které se nesmí ztratit:

- **Prázdné pole = „nevím", ne nula.** Nula tvrdí, že jídelna nemá volno —
  to je jiná informace a vymýšlet ji nesmíme. V databázi je to `NULL`
  (migrace 0006 kapacitu schválně zbavila `not null` i výchozí nuly).
- **Součet volné kapacity se počítá jen z jídelen, kde ji známe**, a
  obrazovka to říká nahlas. Jinak by chybějící údaj vypadal jako nula.
- **Kapacita nepřeřadí ani jednu firmu.** Nemá vliv na sběr ani na to,
  které firmy se najdou; tvrdou podmínkou se stane až u fronty na oslovení
  ve fázi 3.
- Zápis smí admin a super-admin (migrace 0016, `jidelny` je mezi
  správcovskými tabulkami). Migrace nebyla potřeba žádná nová.
- Počty firem v dosahu se čtou z tabulky `dosah` (`v_zone`), serverovým
  počítáním s `head: true` — 2 300 řádků na jednu jídelnu by stejně
  zastavil strop PostgRESTu.

**Zadaná hodnota:** 34. ZŠ Plzeň (Gerská) = **50 obědů/den** (majitel,
17. 8. 2026). Předtím `NULL`.
