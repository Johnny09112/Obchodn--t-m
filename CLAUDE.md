# Cantinero — pravidla práce na projektu

> DRAFT k revizi (fáze 0, session S0.1). Projektová pravidla pro Claude Code.
> Zdroj pravdy pro zadání je SPEC.md — při rozporu platí SPEC.md.

## Co je tento projekt

Agentní obchodní systém: prodej obědů z partnerských školních jídelen firmám
v dojezdové zóně. Fáze projektu viz SPEC.md kap. 12; aktuální stav a plán
fáze 0 viz docs/FAZE-0.md.

## Neporušitelná pravidla (TL;DR tvrdých pravidel ze SPEC kap. 3)

- Firma vzniká JEN po ověření IČO v ARES (TP-1). Jediná cesta: `zalozFirmu()`.
- Každý dohledaný atribut má evidenci se `zdroj_url` a doslovnou citací;
  bez zdroje zůstává NULL (TP-2). Jediná cesta: `zapisAtribut()` / `zapisKontakt()`.
- Sbírá a personalizuje se jen whitelist atributů (src/whitelist.ts, TP-3).
  Nikdy: sociální sítě, finanční údaje, inzeráty, recenze, odhady.
- Nic se neodesílá. `system_state.sending_enabled` je false a žádný kód fáze
  0–2 nesmí odesílání implementovat ani zapínat. Zapnout smí pouze člověk (TP-8).
- Jedna firma = jedno oslovení, žádné sekvence (TP-5) — platí od fáze 3.
- Každý běh agenta se zapisuje do `agent_runs` (TP-13).
- Tvrdá pravidla se vynucují v kódu/DB. Instrukce v promptu není záruka —
  nikdy neobcházej repository vrstvu přímými INSERTy do companies/evidence.

## Konvence

- Jazyk: čeština v kódu-komentářích, názvech domén (repo vrstva), dokumentech
  i commit messages. Identifikátory česky bez diakritiky (`zalozFirmu`).
- TDD: nejdřív test, pak implementace. Testy běží nad PGlite bez sítě —
  `npm test` musí projít vždy, bez env proměnných.
- Externí zdroje šetrně: Nominatim max 1 req/s, ARES s prodlevou; respektuj
  robots.txt; LinkedIn se nescrapuje nikdy.
- Migrace: pouze přidávat nové soubory do supabase/migrations/ (po nasazení
  produkce se 0001 needituje).
- Tajemství jen v .env (nikdy do gitu, nikdy do paměti/vaultu).

## Struktura

- `SPEC.md` — závazné zadání (v2)
- `docs/FAZE-0.md` — orchestrace přípravné fáze; `docs/adr/` — rozhodnutí
- `src/` — jádro (deterministická logika + repository + enrichment)
- `supabase/migrations/` — schéma; `test/` — testovací sada
- `playbook-cmuchal.md` — playbook agenta (smí si ho měnit sám)
- `memory/` — projektová paměť týmu (vznikne v S0.1; osobní věci patří do
  osobního vaultu, ne sem)

## Příkazy

```bash
npm test               # celá sada (PGlite, offline)
npm run typecheck
npm run cli            # nápověda: migrate | seed-jidelna | run | stav | metriky
```

## Role agentů (SPEC kap. 10)

Definice vzniknou v S0.3 (.claude/agents/). Aktivní ve fázi 1 je pouze
Čmuchal (sběr, kvalifikace — nikdy neodesílá). Obchodník, Spojka, Statistik,
Marketér a Ředitel se aktivují až v příslušných fázích; jejich smí/nesmí je
závazně ve SPEC.
