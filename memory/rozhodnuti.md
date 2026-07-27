# Log rozhodnutí

Formát: datum · kdo · rozhodnutí · proč. Nové řádky nahoru.

- 2026-07-26 · majitel · **Provoz na předplatném, ne na API tokenech.** Majitel
  má Claude Max 5×; API se bude řešit až u případného externího klienta.
  Důsledek: Cantinero není samostatná bezobslužná aplikace — je to sada
  nástrojů (kód) + agent v Claude Code, který je používá. Enrichment tedy
  neběží přes Anthropic SDK, ale jako práce agenta v session.
- 2026-07-26 · majitel · **Cílový objem: 20–50 firem denně**, víc nemá smysl.
  Sedí na dávkový režim na předplatném; nevyžaduje 24/7 infrastrukturu.
- 2026-07-26 · Claude · **Databáze lokálně (PGlite v `data/pgdata`)**, žádný
  cloud. Stávající Supabase projekty majitele zůstávají nedotčené a nic se
  nepozastavuje. Migrace jsou idempotentní (tabulka `_migrace`), `data/` je
  v .gitignore. Přechod na cloudový Postgres = vyplnit DATABASE_URL.
- 2026-07-26 · majitel · **Před investicí do produktizace je potřeba analýza,
  zda má smysl systém prodávat dalším firmám.** → nová session S0.10.
- 2026-07-26 · majitel · **Před ostrým provozem proběhne fáze 0 (přípravná)** —
  workspace, agenti, skilly, paměť, obchodní příprava; teprve pak další postup.
  Technologie se může ještě změnit. → orchestrace v docs/FAZE-0.md.
- 2026-07-24 · Claude · **Local-first vývoj**: testy nad PGlite bez sítě,
  produkční DB se zakládá až po potvrzení majitelem (oba stávající Supabase
  projekty jsou obsazené jinými aplikacemi).
- 2026-07-24 · Claude · **Čeština všude** (kód-komentáře, dokumenty, commity;
  identifikátory bez diakritiky) — konzistence se SPEC.
- 2026-07-24 · Claude (navrženo, nepotvrzeno) · Doporučení technologie =
  hybrid: kódové jádro (tvrdá pravidla) + Claude Code agenti. **Čeká na S0.2.**
