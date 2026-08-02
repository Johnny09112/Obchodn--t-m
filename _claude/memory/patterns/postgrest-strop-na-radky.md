---
name: postgrest-strop-na-radky
description: Server má strop na počet řádků a .limit() ho nepřebije
type: pattern
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

**Co se stalo:** `nactiFirmy` měla `.limit(50_000)` a přesto vracela
**1 000 firem z 13 767**. PostgREST (Supabase) má vlastní strop a klientský
limit **mlčky přebije** — žádná chyba, jen kratší odpověď.

Projevovalo se to jako drobnosti, kterých si nikdo nevšiml: kartotéka
„1 000 firem", počet v oblasti přesně 1 000, seznam kampaně 156 z 532.

**Opraveno:** čtení po stránkách (`.range(od, od+999)`, dokud přijde plná
dávka). 13 767 firem za 4,3 s; třídění až v prohlížeči.

**Pravidlo:** u hromadného čtení ověřit počet proti `count: 'exact'`.
Zaokrouhlené číslo v přehledu (přesně 1 000, přesně 500) je podezřelé —
bývá to strop, ne náhoda.

## Strop zvednutý na 20 000 (3. 8.)

Majitel schválil zvýšení, aby se kartotéka nenačítala na čtrnáct kol:

```sql
alter role authenticator set pgrst.db_max_rows = '20000';
notify pgrst, 'reload config';
```

**Nastavení v roli je vidět, chování přes API ověřené NENÍ** — anonymní
čtení je zavřené a bez přihlášení se dotaz neudělá. Trvalejší místo je
nastavení projektu v Supabase (Settings → API → Max rows); kdyby platforma
při restartu roli přepsala, vrátí se strop na tisíc.

**Proto na velikosti dávky nesmí nic viset.** Cyklus v `nactiFirmy`
i `nactiIcaVOblastech` končí až **prázdnou dávkou**, ne dávkou menší, než
si řekl. Kdyby se spoléhal na velikost a strop klesl, kartotéka by se tiše
useknula — přesně chyba popsaná výš.
