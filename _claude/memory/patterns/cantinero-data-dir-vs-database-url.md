---
name: cantinero-data-dir-vs-database-url
description: CANTINERO_DATA_DIR neplatí, když je nastavené DATABASE_URL
type: pattern
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

`pripojDb()` v `src/cli.ts` se dívá na `DATABASE_URL` první a lokální cestu
pak ignoruje úplně. Pokus vyzkoušet příkaz na odkládací databázi se tak spustil
**na ostré**.

**Jak si vynutit lokální běh:** proměnnou dočasně vyprázdnit, ne jen nastavit
tu druhou — `DATABASE_URL= CANTINERO_DATA_DIR=… npm run cli -- …`.

První řádek výstupu příkazu říká, kam je připojený („vzdálený Postgres" vs
„lokální databáze") — přečíst si ho DŘÍV, než se něco stane.
