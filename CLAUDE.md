# Cantinero — pravidla práce na projektu

> Projektová pravidla pro Claude Code (fáze 0, session S0.1).
> Zdroj pravdy pro zadání je SPEC.md — při rozporu platí SPEC.md.

## Když majitel řekne jen název oblasti

„Pusť Stříbro“, „pojďme na Rokycany“ → **řiď se `docs/NOVA-OBLAST.md`**.
Je tam celý postup od ověření jídelny přes sběr a doplnění kontaktů až po
výstupy a zápis do paměti. Neptej se na nic, co se dá zjistit z dat; ptej
se jen na to, co ví jenom majitel (jestli tam máme partnera, kapacita).

## Start každé session (povinné, v tomto pořadí)

1. Přečti `memory/MEMORY.md` a `memory/stav.md` — kde jsme a co je další krok.
2. Podle tématu práce přečti `memory/rozhodnuti.md` / `memory/poznatky.md`
   a příslušný dokument v `docs/` (fáze 0: `docs/FAZE-0.md`).
3. Nezačínej práci, která je v rozporu se zapsaným rozhodnutím — pokud
   nesouhlasíš, navrhni změnu rozhodnutí, nerozhoduj mlčky jinak.

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

## Paměť a dokumentace (kdy a kam zapisovat)

Zápis je **event-triggered** — „konec session" nepoznáš, proto zapisuj hned:

- Dokončený milník / commit → aktualizuj `memory/stav.md` (stav + další krok).
- Jakékoli rozhodnutí (moje i majitelovo) → ihned řádek do
  `memory/rozhodnuti.md` (datum · kdo · co · proč).
- Technický či procesní poznatek/gotcha → ihned do `memory/poznatky.md`.
- Větší návrhy a plány → dokument do `docs/` (plány `docs/superpowers/plans/`,
  architektura `docs/adr/`), do paměti jen odkaz.
- Playbook Čmuchala (`playbook-cmuchal.md`) si agent doplňuje sám po bězích.
- Routing: týmové/projektové → `memory/` v gitu; osobní preference majitele
  napříč projekty → osobní vault (mimo git). Tajemství nikam mimo `.env`.
- Neudržuj totéž na dvou místech — paměť odkazuje, neopisuje.

## Komunikace s majitelem

Majitel **není programátor**. Z toho plyne:

- Shrnutí a vysvětlení piš lidsky, bez žargonu; technické detaily (názvy
  funkcí, SQL…) jen na vyžádání nebo v odkazovaném dokumentu.
- Vždy začni výsledkem („co se stalo / co jsem zjistil"), pak teprve detail.
- Po větším celku práce napiš krátké shrnutí: co se změnilo, co to znamená,
  co potřebuji od tebe (max pár odrážek).
- U velkých či nejednoznačných zadání nejdřív parafrázuj, jak jsem zadání
  pochopil, a teprve po potvrzení (nebo u jasných věcí rovnou) pracuj.
- Nepředstírej jistotu: co je hotové a ověřené, řekni napřímo; co je odhad
  nebo riziko, označ jako odhad nebo riziko.

## Vizualizace stavu v HTML (povinné)

Ke každému většímu výstupu — stav projektu, výsledek běhu, přehled, návrh
architektury, metriky — **vždy připrav HTML stránku s vizualizací**, ne jen
text v chatu. Majitel si výstupy prohlíží vizuálně.

- Soubory ukládej do `docs/vizualizace/` (verzované v gitu) a publikuj je
  jako artifact, aby šly otevřít v prohlížeči.
- Stav vždy kóduj i tvarem (barevný štítek, pruh, ikona), ne jen číslem —
  ať je na první pohled vidět, co je hotové, co čeká a co je problém.
- **Ukázková data označ jako ukázková.** Nikdy neprezentuj vymyšlená čísla
  jako reálná; prázdný stav je legitimní stav a takhle se má i zobrazit.
- Průběžný cíl: interaktivní mapa ČR, která se postupně plní analyzovanými
  oblastmi (zóny jídelen, oslovené a vyhodnocené firmy).

## Pravidla doptávání (kdy se ptát, kdy rozhodnout sám)

**Vždy se zeptej (rozhoduje majitel):**
- peníze a placené služby (založení projektů, API rozpočty, domény),
- cokoli směřující ven z firmy (odeslání, publikování, kontakt s partnery),
- právní věci, tvrzení o produktu (`claims`), šablony zpráv,
- změna rozsahu nebo pořadí fází, mazání dat, změna tvrdých pravidel (ta se
  ve skutečnosti nemění vůbec — jen SPEC je může změnit).

**Rozhodni sám a zapiš do `memory/rozhodnuti.md`:**
- technická, vratná rozhodnutí (knihovny, struktura kódu, pojmenování,
  pořadí prací uvnitř schválené session).

**Jak se ptát:** otázky dávkuj (ne po jedné), každá s doporučením a krátkým
zdůvodněním; pokud se dá pokračovat na jiné části práce, neblokuj se čekáním.

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
- `docs/DALSI-SESSION-FRONTEND.md` — **předávka: co stavět dál**
- `docs/NOVA-OBLAST.md` — **postup pro zpracování nové oblasti od A do Z**
- `docs/FAZE-0.md` — orchestrace přípravné fáze; `docs/adr/` — rozhodnutí
- `src/` — jádro (deterministická logika + repository + enrichment)
- `supabase/migrations/` — schéma; `test/` — testovací sada
- `playbook-cmuchal.md` — playbook agenta (smí si ho měnit sám)
- `memory/` — projektová paměť týmu (index `memory/MEMORY.md`; osobní věci
  patří do osobního vaultu, ne sem)
- `docs/JAK-TO-FUNGUJE.md` — lidský popis systému pro majitele

## Příkazy

```bash
npm test               # celá sada (PGlite, offline)
npm run typecheck
npm run cli            # nápověda ke všem příkazům
```

**Aktivní data jsou v `data/pgdata-v5`**, ne ve výchozím `data/pgdata`.
Ke každému příkazu proto patří `CANTINERO_DATA_DIR=data/pgdata-v5`.
Databázi smí otevřít jen jeden proces naráz — dva ji tiše rozbijí.

## Role agentů (SPEC kap. 10)

Definice vzniknou v S0.3 (.claude/agents/). Aktivní ve fázi 1 je pouze
Čmuchal (sběr, kvalifikace — nikdy neodesílá). Obchodník, Spojka, Statistik,
Marketér a Ředitel se aktivují až v příslušných fázích; jejich smí/nesmí je
závazně ve SPEC.
