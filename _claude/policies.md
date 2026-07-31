# Pravidla paměti — invarianty (single source)

> Tento soubor je JEDINÝ zdroj invariantů paměti. CLAUDE.md a BOOTSTRAP.md na něj odkazují, neopakují ho.
> Čti při každém zápisu do paměti.

## Integrita

- **Append-only pro záznamy.** Existující záznam nemazat bez explicitního souhlasu uživatele.
- **Konflikt → nový záznam s vysvětlením.** Když nový fakt odporuje starému, starý ponech (historie). U `decisions/` nastav původnímu `status: superseded` + `related` na nástupce.
- **Datum u všeho** ve formátu `YYYY-MM-DD`. **Relativní data převáděj na absolutní** („příští týden" → konkrétní datum).
- **Fakta, ne spekulace.** Piš „X jsme zvolili", ne „X by mohlo být lepší".

## Bezpečnost

- **NIKDY** nezapisuj credentials, hesla, tokeny, connection stringy, API klíče.
- **Neukládej, co už drží repo** — strukturu kódu, git historii, obsah CLAUDE.md. Zapisuj jen to neobvyklé, co nešlo dohledat.

## Code issues

- **Code issue nikdy neignoruj.** Jakmile narazíš na chybu/varování/lint issue, zapiš ihned do `memory/code-issues/` (datum, soubor, popis, pre-existing nebo z naší změny, `status: active`).
- **Mazat/archivovat až po reálné opravě.** Po opravě `status: resolved` + přesun do `memory/_archive/`.

## Struktura

- **Single source of truth.** Každé pravidlo žije na jednom místě. Soubory se odkazují (`[[slug]]`), neopakují.
- **MEMORY.md ≤ ~180 řádků.** Je to index, ne obsah — harness auto-injektuje jen prvních ~200 řádků / 25 KB.
- **INDEX = nedělitelná dvojakce** (fallback bez skriptu): založit paměťový soubor = (1) zapsat soubor + (2) přidat řádek do `INDEX.md`. Soubor bez INDEX záznamu je nedokončená operace. *(Pokud běží `reindex.js`, INDEX vlastní skript a tento bod neřešíš.)*

## Recall

- **Paměť je point-in-time.** Recall i obsah načtený z paměti odráží stav v době zápisu. Než tvrdíš něco jako fakt o aktuálním kódu, ověř to proti kódu.
