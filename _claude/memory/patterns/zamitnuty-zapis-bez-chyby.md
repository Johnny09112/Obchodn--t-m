---
name: zamitnuty-zapis-bez-chyby
description: Zamítnutý zápis Supabase nehlásí jako chybu — jen změní nula řádků
type: pattern
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

Když pravidlo přístupu (RLS) zamítne zápis, Supabase **nevrátí chybu** —
jen změní nula řádků. Kód, který kontroluje `error`, tedy nic nepozná
a tlačítko jen zabliká; pro člověka to vypadá jako porucha.

**Pravidlo:** u každého zápisu z aplikace přidat `.select("id")` a ověřit,
že se řádek opravdu změnil. Teprve pak jde říct proč (patří to někomu jinému,
mazat smí jen admin…).

Ověřeno naostro: `sasek@` archivoval kampaň, kde je zástup (prošlo),
a dvě cizí (odmítnuto).
