---
name: jsonb-se-serializuje-dvakrat
description: JSON.stringify do jsonb sloupce uloží v ostré databázi řetězec místo objektu — PGlite ho rozparsuje, postgres.js serializuje podruhé, takže testy mlčí
type: pattern
status: active
created: 2026-08-17
updated: 2026-08-17
related: [rls-nejde-testovat-chovanim-lokalne, zelene-testy-nejsou-hotova-obrazovka]
---

**Past:** `db.query("insert … values ($1)", [JSON.stringify(objekt)])` do jsonb
sloupce funguje v testech a mlčky selže naostro.

| Předaná hodnota | PGlite (testy) | Postgres přes postgres.js (ostrá) |
|---|---|---|
| objekt `{firem: 8}` | object ✅ | object ✅ |
| pole `[{…}]` | array ✅ | array ✅ |
| **`JSON.stringify({firem: 8})`** | **object** ✅ | **string** ❌ |
| `null` | null | null |

Ověřeno 17. 8. 2026 experimentem proti ostré databázi v **dočasné tabulce**
(`create temp table`, zanikne s relací, ostrých dat se nedotkne).

**Proč:** postgres.js si zjistí typ cílového sloupce a serializuje hodnotu
sám. Řetězec proto zabalí jako JSON řetězec — dojde k dvojité serializaci.
PGlite naopak text do jsonb vloží parsováním, takže tutéž chybu opraví za
běhu a **v testech není vidět**.

**Pravidlo:** do jsonb sloupců předávej **hodnotu, ne její JSON text**.
Serializaci nechej ovladači — jediný ví, jaký typ má cílový sloupec.

**Co to způsobilo:** `zacniBeh`/`ukonciBeh` (repo.ts) zapsaly takhle **72 ze
72 běhů**. Obrazovka Provoz proto u všech ukazovala prázdný Výsledek
(`typeof v !== "object"` → „—“) a chyby vypisovala jako text s uvozovkami.
Rok a půl práce agenta bez čitelného auditu, a testy celou dobu zelené.
Stejná mina čekala v `oblast.ts` (body oblasti) a v `prenos.ts`, kde
komentář dokonce tvrdil opak („objekty projdou jen jako JSON textu“).

**Test, který to hlídá** (`test/agent-runs-jsonb.test.ts`): chování ovladače
napodobit nejde, tak se přes falešné `Db` kontroluje, že se do dotazu
**předává hodnota, ne řetězec**.

**Stará data se nepřepisovala** — obrazovka si řetězec rozbalí sama
(`jakoHodnota` v Provoz.tsx). Migrace dat by šla taky, ale nebyla potřeba.
