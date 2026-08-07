---
name: tri-kopie-seznamu-atributu
description: Pevný seznam žil ve čtyřech kopiích — zrušit ho v jedné znamená ostrou dávku s nulou, která vypadá hotově
type: pattern
status: active
created: 2026-08-07
updated: 2026-08-07
related: [dva-profily-sber-a-reserse, dve-vrstvy-znalost-a-zprava, zelene-testy-nejsou-hotova-obrazovka]
---

**Past:** při přesunu seznamu povolených atributů z kódu do tabulky
(7. 8. 2026) se ukázalo, že tentýž seznam žil na **čtyřech místech**, a
každé z nich by samo o sobě stačilo, aby nově zavedený atribut tiše
propadl — přičemž **všechny testy zůstanou zelené a ostrá dávka doběhne
s nulou, jako by se prostě nic nenašlo.**

| Kopie | Kde | Co by udělala |
|---|---|---|
| 1 | `src/whitelist.ts` (`POVOLENE_ATRIBUTY`) | ta zamýšlená — přesunuta do tabulky |
| 2 | podmínka `check` na `evidence.atribut` (`0001_init.sql`) | zabije zápis na posledním kroku |
| 3 | `OBOHACOVANE_ATRIBUTY` v zodu (`src/nalezy.ts`) | odmítne nález **dřív**, než se dostane k zápisu |
| 4 | tabulka „Co hledáš" v `.claude/agents/cmuchal.md` | agent to prostě nehledá |

A při závěrečné revizi se našly ještě dvě, které revize jednotlivých úkolů
nemohly vidět: `ZADANI_VYCHOZI` v `app/src/data.ts` (jde agentovi **doslova
do promptu**) a dvě věty ve `SPEC.md`, tedy v **závazném zadání**.

## Proč to nechytnou testy

Protože se atribut nezahodí chybou, ale **tím, že se nenajde**. Nulový
výsledek je legitimní výstup — sběr může doopravdy nic nenajít. Rozdíl mezi
„nenašlo se to" a „nikdy se to nehledalo" z výstupu nepoznáš.

## Co s tím

1. **Než zrušíš pevný seznam, najdi všechny jeho kopie** — a hledej i mimo
   `src/`: v migracích, v definicích agentů, v textech, které jdou do
   promptu, a v `SPEC.md`.
2. **Rozdíl mezi „je v rejstříku" a „agent to hledá" musí mít vlastní test.**
   Test s atributem, který v rejstříku vůbec není, se chytne na jiné
   kontrole a o té tvojí neřekne nic.
3. **Zdrojem pravdy o tom, jestli údaj máme, je evidence, ne sloupec** —
   nově zavedené atributy sloupec v `companies` nemají a mít nemají.
4. **Ověřuj sabotáží.** Zeslab kontrolu schválně a přesvědč se, že nový
   test spadne. Bez toho nevíš, jestli testuje, nebo jen prochází.

## Poučení do budoucna

**Doslovný kód v plánu není ověřený kód.** Tenhle plán prošel revizí předem
a čtyři vážné nálezy měl opravené — a přesto v jeho vzorovém kódu zůstalo
pět dalších vad, které našly až revize jednotlivých úkolů (test padající na
cizím klíči, na který nemířil; chybějící `hledaAgent` ve výběru; chybějící
`czNace` a `hleda_agent` v testovacích fixturách; `toThrow()` bez vzoru).
Když implementátor narazí na rozpor mezi plánem a kódem, **má se ozvat** —
tenhle cyklus fungoval právě proto, že se ozývali.
