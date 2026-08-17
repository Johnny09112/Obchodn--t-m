---
name: kapacita-se-upravuje-v-aplikaci
description: Volná kapacita jídelny se mění v aplikaci na obrazovce Jídelny a dělí se na „v provozu" a „v přípravě" — sečíst je dohromady by tvrdilo, že máme víc, než máme
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
17. 8. 2026, ověřeno v prohlížeči). Předtím `NULL`. Volná kapacita celkem
tím vzrostla ze 70 na **120 obědů/den**.

## Stav jídelny: v provozu vs. příprava (17. 8., navazující požadavek)

Migrace **0044** přidala `jidelny.stav` s hodnotami `v_provozu` a `priprava`.
Součet volné kapacity se tím rozdělil na **„co jde prodat dnes"** a
**„potenciál v přípravě"**.

**Proč nový sloupec a ne přetížení `aktivni`:** `aktivni` rozhoduje, jestli
se s jídelnou vůbec pracuje — jestli se jí počítá dosah (`src/dosah.ts`)
a jestli na ni smí Čmuchal (`src/cmuchal.ts`). **Jídelna v přípravě se
používat musí** — právě sběrem firem v okolí se připravuje. Jsou to dvě
různé otázky: `aktivni` = pracujeme s ní? `stav` = má už co prodat?

**Výchozí hodnota `v_provozu`** schválně: zachovává dosavadní význam čísel.
Kdyby výchozí byla příprava, spadl by součet kapacity na nulu a vypadalo by
to jako porucha. Které jídelny se teprve chystají, ví jen majitel — přepíná
je na obrazovce.

Součet žije v **jednom** souboru `src/kapacita.ts` (`soucetKapacit`), který
používá příkazová řádka (`kartoteka`, `mapa`, `stav`) i aplikace. Dvě kopie
by se rozešly a majitel by viděl dvě různá čísla o tomtéž. Soubor je
schválně bez závislostí — aplikace ho importuje přímo a nesmí si přitáhnout
`db.ts` ([[vercel-instaluje-jen-app-zavislosti]]).
