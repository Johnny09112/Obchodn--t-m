---
name: vercel-instaluje-jen-app-zavislosti
description: Vercel neinstaluje kořenové závislosti; aplikace si nesmí přitáhnout db.ts
type: pattern
status: active
created: 2026-08-01
updated: 2026-08-01
related: []
---

**Co se stalo:** Sestavení na Vercelu padalo **od etapy B** a nikdo si toho
nevšiml — poslední úspěšné nasazení bylo o celou etapu starší. Aplikace si
přes `kvalifikace.ts` → `blacklist.ts` → `db.ts` tahala do typové kontroly
ovladače PGlite a Postgresu. `vercel.json` má
`installCommand: npm install --prefix app`, takže kořenové `node_modules`
tam nevzniknou. Doma to procházelo, protože tady kořenové závislosti jsou.

**Opraveno:** čistý modul `src/sito.ts` (+ `src/nace.ts`) bez vazby na
databázi; `blacklist.ts` i `kvalifikace.ts` z něj jen propouštějí dál, takže
zbytek jádra se měnit nemusel. Aplikace sahá jen na `sito`, `oblast-tvar`,
`geo` a `pruzkum-postup`.

**Hlídá to `test/hranice-aplikace.test.ts`** — projde importy aplikace a přes
další moduly ověří, že se nedá dojít na `db` ani `repo`.

**Jak to reprodukovat:** kopie `src/` a `app/` do prázdné složky,
`npm install --prefix app`, `npm run build --prefix app`. Když něco selhává
jen v cizím prostředí, postav si ho — je to levnější než třetí špatná oprava.
