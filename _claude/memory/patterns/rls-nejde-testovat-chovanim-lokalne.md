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
