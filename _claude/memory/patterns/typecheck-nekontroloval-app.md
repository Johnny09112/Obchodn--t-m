---
name: typecheck-nekontroloval-app
description: Kořenový typecheck nesahal do app/ — ověř, co kontrola doopravdy kontroluje
type: pattern
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

**Co se stalo:** Celou etapu B jsem se odvolával na „kontrola typů čistá" jako
důkaz, že frontend je v pořádku. Kořenový `tsconfig.json` má ale
`include: ["src/**/*.ts", "test/**/*.ts"]` — složka `app/` v něm není vůbec.
Přišlo se na to, až když se v prohlížeči rozsypala celá obrazovka na chybějícím
importu. Správná kontrola pak vypsala sedm chyb naráz.

**Opraveno:** kořenový skript pouští obojí —
`tsc --noEmit && tsc --noEmit -p app/tsconfig.json`.

**Pravidlo:** než se odvoláš na nějakou kontrolu jako na důkaz, ověř, co
doopravdy kontroluje. „Prošlo to" u nástroje, který se na daný soubor vůbec
nedívá, je horší než žádná kontrola — vzbudí to falešnou jistotu.
