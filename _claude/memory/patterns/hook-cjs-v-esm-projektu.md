---
name: hook-cjs-v-esm-projektu
description: Hooky ze šablon bývají CommonJS, ale tenhle projekt má type: module
type: pattern
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

`reindex.js` z šablony VZOR používá `require`, ale kořenový `package.json`
má `"type": "module"`, takže Node bere `.js` jako ES modul a hook spadne na
`require is not defined in ES module scope`.

**Opraveno:** přejmenováno na `.cjs` (`reindex.cjs`, `reindex.test.cjs`)
a upravena cesta v `.claude/settings.json`. Do kódu šablony se nesahalo.

**Obecně:** hook nebo skript převzatý zvenčí vždy jednou spustit, ne
předpokládat, že funguje. Tenhle by tiše selhal při každém startu session
a INDEX by se nikdy nepřegeneroval.
