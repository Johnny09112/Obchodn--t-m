---
name: ostra-data-jsou-v-cloudu
description: Ostrá data leží v cloudovém Postgresu za DATABASE_URL, ne v data/pgdata-v5 — lokální kopie zamrzla 29. 7. na 167 firmách a tiše odpoví na každý dotaz
type: pattern
status: active
created: 2026-08-18
updated: 2026-08-18
related: [cantinero-data-dir-vs-database-url, tajemstvi-mimo-pracovni-slozku]
---

**Objeveno 18. 8. 2026** při měření úplnosti údajů pro oslovení.

Projektový `CLAUDE.md` říkal „Aktivní data jsou v `data/pgdata-v5`“ a ke
každému příkazu psal `CANTINERO_DATA_DIR=data/pgdata-v5`. **Neplatí to od
29. 7.**, kdy se data přenesla do cloudu (`data/pgdata-v5-zaloha-pred-prenosem`
je z toho dne). Od té doby píše všechno do cloudu a lokální kopie zamrzla.

| | data/pgdata-v5 | cloud (DATABASE_URL) |
|---|---|---|
| Firem | 167 | **13 919** |
| Evidence | 487 | **7 960** |
| Kontaktů | 144 | **1 319** |
| Migrace | po 0043 | po 0044 |

**Proč to nebolí hned a proto je to nebezpečné:** lokální databáze se
otevře, odpoví a čísla vypadají věrohodně — 165 kvalifikovaných firem
sedělo v obou. Rozdíl se pozná až na součtech, které si člověk pamatuje
odjinud. Poznávací znamení: v lokální kopii **chybí sloupec
`jidelny.stav`** (migrace 0044), takže dotaz na něj spadne.

**Jak se připojit k ostrým datům** (`pripojDb` dá přednost `DATABASE_URL`
před `CANTINERO_DATA_DIR`, viz [[cantinero-data-dir-vs-database-url]]):

```bash
set -a && . ~/.cantinero/.env && set +a && npm run cli -- <příkaz>
```

Tajemství leží mimo pracovní složku ([[tajemstvi-mimo-pracovni-slozku]]),
proto se `.env` načítá odtamtud a do repozitáře nikdy nepatří.

**Opraveno v `CLAUDE.md`** týž den, ať na to nenaletí další session.
