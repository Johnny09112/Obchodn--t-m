---
name: rls-nejde-testovat-chovanim-lokalne
description: Pravidla přístupu se lokálně testují čtením textu, ne chováním
type: pattern
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

PGlite nemá Supabase Auth, takže `auth.jwt()` je náhrada vracející NULL —
přihlásit se v testu nejde. Pravidla se proto testují **čtením jejich textu**
z `pg_policies` (`test/pravidla.test.ts`, `test/kampan-prava.test.ts`).

Zvažoval jsem náhradu čtoucí z nastavení sezení, aby šla pravidla otestovat
doopravdy. Neudělal jsem to: testy běží jako vlastník tabulek, kterému se RLS
neuplatňuje vůbec — vznikla by **jiná** pravidla než v produkci, tedy falešná
jistota.

**Důsledek:** ke každé změně pravidel přístupu patří **ruční ověření po
nasazení**. Zapisovat ho do předávky, ne spoléhat na zelené testy.

## Jak to ověřit naostro, aniž se něco pokazí (1. 8.)

Na ostré databázi jde chování zahrát bez cizího hesla a beze stopy — v bloku,
který se na konci sám shodí, takže se všechno vrátí zpátky:

```sql
do $$
declare smazano int;
begin
  perform set_config('request.jwt.claims', '{"app_metadata":{"role":"uzivatel"}}', true);
  set local role authenticated;
  with x as (delete from oblasti where nazev = '…' returning 1)
  select count(*) into smazano from x;
  set local role postgres;
  raise exception 'zkouska: smazano %', smazano;   -- odvolá celou transakci
end $$;
```

Výsledek přijde textem chyby. Zamítnutý zápis **nehlásí chybu, jen smaže nula
řádků** ([[zamitnuty-zapis-bez-chyby]]) — proto se počítá `returning`, ne
úspěch. Po zkoušce ještě zkontroluj, že data opravdu zůstala.

Rozhraní se ověří zvlášť: přihlásit se jako někdo jiný nejde (heslo se nezadává),
takže se na dobu kontroly dočasně rozšíří seznam rolí v komponentě a **hned
vrátí** — s kontrolou grepem, že po zkoušce nic nezbylo.
