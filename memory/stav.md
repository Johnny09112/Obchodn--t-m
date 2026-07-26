# Stav projektu

_Aktualizováno: 2026-07-26_

## Kde jsme

- Běží **fáze 0 (přípravná)** — orchestrace je v `docs/FAZE-0.md`
  (sessions S0.1–S0.9). Probíhá S0.1 (workspace: CLAUDE.md, paměť).
- Kód fáze 1 (Čmuchal) je hotový a otestovaný (52 testů, PGlite offline),
  ale **neběží ostře** — čeká na dokončení fáze 0 a go/no-go (S0.9).
- Nasazení do produkce čeká na rozhodnutí o technologii (S0.2) a založení
  DB projektu (S0.6).

## Rozpracováno

- S0.1: CLAUDE.md doplněn o paměť/komunikaci/dokumentaci; paměť založena
  (tento adresář). Čeká na revizi majitele.
- `docs/JAK-TO-FUNGUJE.md` — lidský popis systému k potvrzení majitelem.

## Další krok

1. Majitel: potvrdit/doladit `docs/JAK-TO-FUNGUJE.md` a revidovat CLAUDE.md.
2. Session S0.2 — rozhodnutí o technologii (ADR).
3. Pak paralelně S0.3 (agenti+skilly) a proud B dle vstupů majitele.
