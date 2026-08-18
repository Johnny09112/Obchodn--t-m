---
name: cantinero-data-dir-vs-database-url
description: CANTINERO_DATA_DIR neplatí, když je nastavené DATABASE_URL
type: pattern
status: active
created: 2026-08-01
updated: 2026-08-18
related: [ostra-data-jsou-v-cloudu, tajemstvi-mimo-pracovni-slozku]
---

**Stalo se podruhé 18. 8. 2026** — tentokrát se tím naostro nasadila migrace
0045, která měla jít na odkládací kopii. Dopadlo to dobře (migrace byla
otestovaná a jen přidávala), ale ten záznam tu už rok visel a nepomohl:
nebyl přečtený **před** spuštěním příkazu. Proto sem patří i to, že
`CANTINERO_DATA_DIR=… npm run cli` **samo o sobě nestačí**.

`pripojDb()` v `src/cli.ts` se dívá na `DATABASE_URL` první a lokální cestu
pak ignoruje úplně. Pokus vyzkoušet příkaz na odkládací databázi se tak spustil
**na ostré**.

**Proč nestačí nastavit jen tu druhou:** `nactiEnv()` v `src/cli.ts` si sám
načte `~/.cantinero/.env`, takže `DATABASE_URL` je nastavená, i když ji u
příkazu nikdo nezmínil. Přebít se dá jedině **prázdnou hodnotou** — ta je
„definovaná", takže ji soubor nedoplní, a zároveň je nepravdivá, takže
`pripojDb()` sáhne po lokální databázi:

```bash
DATABASE_URL= CANTINERO_DATA_DIR=data/pokus npm run cli -- <příkaz>
```

První řádek výstupu příkazu říká, kam je připojený („vzdálený Postgres" vs
„lokální databáze") — přečíst si ho DŘÍV, než se něco stane.
