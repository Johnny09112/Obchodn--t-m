---
name: velikost-ze-souboru-a-slozeni
description: Velikost firem se ukládá ze souboru ČSÚ; složení území je v pohledu a v proužku
type: decision
status: active
created: 2026-08-02
updated: 2026-08-02
related: [ares-nedoplni-velikost, prehled-oblasti-pohledem]
---

**Kontext:** sloupec `KATPO` v souboru ČSÚ je vyplněný u 93 % subjektů,
Čmuchal ho při sběru čte a počítá z něj skóre — ale **nezapisoval ho**.
Do kartotéky šla velikost z ARESu, kde u běžného dotazu není. Následek:
12 630 z 12 762 plzeňských firem bez velikosti a síto mezi oblastí
a kampaní vyhazovalo z 12 762 firem dvě.

## Co se postavilo

- **`src/velikosti.ts`** — `doplnVelikosti(db, zdroj, { oblastId })`.
  Zdroj je oddělený rozhraním `ZdrojVelikosti`, aby testy nemusely číst
  půlgigabajtový soubor; ostrý zdroj je `zdrojVelikosti()` v `registr.ts`.
- Příkaz **`doplnit-velikosti [--oblast id]`**. Bez internetu.
- Zapisuje se přes `zapisAtribut`, takže ke každé velikosti vzniká evidence
  se zdrojem a doslovnou citací (TP-2).
- **Nic se nedomýšlí:** `000` (neuvedeno) i `110` (bez zaměstnanců) nechávají
  hodnotu prázdnou. Ani jedno není velikostní segment.

## Složení území (migrace 0032)

Pohled `oblasti_prehled` počítá `mikro`, `stredni`, `korporat`,
`bez_velikosti` a `se_spojenim`. V aplikaci to kreslí `ProuzekSlozeni` —
v seznamu oblastí u každého řádku a v druhém kroku průvodce za celý výběr.

**`bez_velikosti` je vlastní kategorie, ne nula.** „Nevíme" a „nula
zaměstnanců" jsou dvě různé věci a právě ten díl říká, kolik práce v území
ještě zbývá.

Proužek má **minimální šířku dílu** — cílový segment bývá kolem 5 % a při
čistě poměrné šířce by zmizel.

## Volba rozsahu ve druhém kroku

Průvodce se ptá, jestli vzít i firmy s neznámou velikostí, a ukazuje
u toho počet a odhad času (`src/odhady.ts`, `odhadKontaktu`). Výchozí je
**ne** — ale schovat je úplně by bylo horší, protože polovina z nich jsou
skutečná s.r.o. ([[ares-nedoplni-velikost]]).

**Mikro firmy se do kampaně neberou nikdy**, ani při zahrnutí neznámých.

## Odhady času jsou naměřené

`SEKUND_NA_FIRMU = 2,88` — změřeno 2. 8. na dávce 200 firem (576 s).
Dřívější odhad 300 ms vycházel z prodlevy v kódu a byl vedle o řád.
Kdo to číslo mění, ať ho změří znovu.
