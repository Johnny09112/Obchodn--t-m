# Stav projektu

_Aktualizováno: 2026-07-26_

## Kde jsme

- Běží **fáze 0 (přípravná)** — orchestrace v `docs/FAZE-0.md` (S0.1–S0.10).
- **Režim provozu rozhodnut:** předplatné Claude Max 5×, ne API tokeny.
  Cantinero není samostatná appka — je to sada nástrojů (kód) + agent
  v Claude Code. Cílový objem 20–50 firem denně.
- **Databáze běží lokálně** v `data/pgdata` (PGlite), migrace idempotentní,
  `data/` mimo git. Supabase projekty majitele nedotčené, nic pozastaveno.
- Kód fáze 1 (Čmuchal) hotový, 53 testů zelených, ostře **neběží** — čeká na
  jídelny (S0.4) a go/no-go (S0.9).

## Rozpracováno / hotovo v S0.1 a S0.6

- CLAUDE.md doplněn o start session, paměť, komunikaci, doptávání.
- Projektová paměť založena (`memory/`).
- `docs/JAK-TO-FUNGUJE.md` — lidský popis; čeká na potvrzení majitele.
- Lokální DB + idempotentní migrace hotové a ověřené přes CLI.

## Další krok

1. **Majitel: seznam jídelen (S0.4)** — bez nich není území; blokuje fázi 1.
2. Přepsat `src/enrich.ts` z API cesty na nástroj pro agenta (dořešení S0.2)
   + sepsat ADR `docs/adr/0001-technologie.md`.
3. S0.3 — definice agentů a skillů.
4. Analýzu produktizace (S0.10) otevřít až po vyhodnocení fáze 1.
