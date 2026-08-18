# Cantinero — pravidla práce na projektu

> Projektová pravidla pro Claude Code (fáze 0, session S0.1).
> Zdroj pravdy pro zadání je SPEC.md — při rozporu platí SPEC.md.

## Když majitel řekne jen název oblasti

„Pusť Stříbro“, „pojďme na Rokycany“ → **řiď se `docs/NOVA-OBLAST.md`**.
Je tam celý postup od ověření jídelny přes sběr a doplnění kontaktů až po
výstupy a zápis do paměti. Neptej se na nic, co se dá zjistit z dat; ptej
se jen na to, co ví jenom majitel (jestli tam máme partnera, kapacita).

## Start každé session (povinné, v tomto pořadí)

1. Přečti `_claude/memory/context/project-context.md` — kde jsme a co je
   další krok. Mechanika paměti je v `_claude/BOOTSTRAP.md`.
2. Přečti `_claude/memory/INDEX.md` a podle tématu načti relevantní záznamy
   (ne všechny) — hlavně `patterns/`, ať nešlápneš do pasti, kterou už někdo
   objevil.
3. Podle tématu práce i příslušný dokument v `docs/` (fáze 0: `docs/FAZE-0.md`).
4. Nezačínej práci, která je v rozporu se zapsaným rozhodnutím — pokud
   nesouhlasíš, navrhni změnu rozhodnutí, nerozhoduj mlčky jinak.

## Co je tento projekt

Agentní obchodní systém: prodej obědů z partnerských školních jídelen firmám
v dojezdové zóně. Fáze projektu viz SPEC.md kap. 12; aktuální stav a plán
fáze 0 viz docs/FAZE-0.md.

## Neporušitelná pravidla (TL;DR tvrdých pravidel ze SPEC kap. 3)

- Firma vzniká JEN po ověření IČO v ARES (TP-1). Jediná cesta: `zalozFirmu()`.
- Každý dohledaný atribut má evidenci se `zdroj_url` a doslovnou citací;
  bez zdroje zůstává NULL (TP-2). Jediná cesta: `zapisAtribut()` / `zapisKontakt()`.
- **Do zprávy** smí jen whitelist atributů (src/whitelist.ts, TP-3).
  **Sběr** je širší — určuje ho profil produktu, ale pořád jen s doloženým
  zdrojem (SPEC kap. 5, dvě vrstvy). Nikdy nikam: sociální sítě, finanční
  údaje, recenze, odhady. Pracovní inzeráty se smějí číst, ale nesmějí do
  zprávy.
- Nic se neodesílá. `system_state.sending_enabled` je false a žádný kód fáze
  0–2 nesmí odesílání implementovat ani zapínat. Zapnout smí pouze člověk (TP-8).
- Jedna firma = jedno oslovení, žádné sekvence (TP-5) — platí od fáze 3.
- Každý běh agenta se zapisuje do `agent_runs` (TP-13).
- Tvrdá pravidla se vynucují v kódu/DB. Instrukce v promptu není záruka —
  nikdy neobcházej repository vrstvu přímými INSERTy do companies/evidence.

## Dokumentace (co nepatří do paměti)

Paměť má vlastní sekci na konci tohoto souboru; tady je zbytek:

- Větší návrhy a plány → dokument do `docs/` (plány `docs/superpowers/plans/`,
  architektura `docs/adr/`), do paměti jen odkaz.
- Playbook Čmuchala (`playbook-cmuchal.md`) si agent doplňuje sám po bězích.
- Routing: týmové/projektové → vault `_claude/` (je v gitu, kolega ho vidí);
  osobní preference majitele napříč projekty → osobní vault mimo tenhle
  repozitář. Tajemství nikam mimo `.env`.
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
- **Tajemství leží MIMO pracovní složku** — `~/.cantinero/.env`, ne `.env`
  v projektu. Čmuchal tu běží bez dozoru a omezení nástrojů mu ve čtení
  souborů nezabrání (ověřeno 6. 8. 2026). Nikdy do gitu, nikdy do paměti.

## Struktura

- `SPEC.md` — závazné zadání (v2)
- `_claude/` — **dlouhodobá paměť projektu (začni tady)**
- `docs/NOVA-OBLAST.md` — **postup pro zpracování nové oblasti od A do Z**
- `docs/FAZE-0.md` — orchestrace přípravné fáze; `docs/adr/` — rozhodnutí
- `src/` — jádro (deterministická logika + repository + enrichment)
- `supabase/migrations/` — schéma; `test/` — testovací sada
- `playbook-cmuchal.md` — playbook agenta (smí si ho měnit sám)
- `docs/JAK-TO-FUNGUJE.md` — lidský popis systému pro majitele

## Příkazy

```bash
npm test               # celá sada (PGlite, offline)
npm run typecheck
npm run cli            # nápověda ke všem příkazům
```

**Ostrá data jsou v cloudu za `DATABASE_URL`**, ne v `data/pgdata-v5` —
ta kopie zamrzla 29. 7. na 167 firmách a na dotazy tiše odpovídá dál
([[ostra-data-jsou-v-cloudu]]). Ke každému příkazu nad ostrými daty proto
patří načtení tajemství, které leží mimo pracovní složku:

```bash
set -a && . ~/.cantinero/.env && set +a && npm run cli -- <příkaz>
```

Lokální PGlite (`CANTINERO_DATA_DIR`) je jen pro pokusy a testy; smí ji
otevřít jen jeden proces naráz — dva ji tiše rozbijí.

## Role agentů (SPEC kap. 10)

Definice vzniknou v S0.3 (.claude/agents/). Aktivní ve fázi 1 je pouze
Čmuchal (sběr, kvalifikace — nikdy neodesílá). Obchodník, Spojka, Statistik,
Marketér a Ředitel se aktivují až v příslušných fázích; jejich smí/nesmí je
závazně ve SPEC.

## Paměť (long-term memory)

Tento projekt má dlouhodobou paměť ve vaultu `_claude/` (uvnitř repozitáře —
cesty proto relativní, ať přežijí přesun projektu). Spravuj ji podle pravidel.

**Na startu session** (po auto-injektovaném `auto-memory/MEMORY.md`):
1. Přečti `_claude/memory/INDEX.md` — katalog záznamů.
2. Přečti `_claude/memory/context/project-context.md` — živý stav.
3. Načti relevantní záznamy dle úkolu. Mechanika: `BOOTSTRAP.md`. Invarianty: `policies.md`.

**Zapiš OKAMŽITĚ (event-triggered, ne na „konec session" — ten nepoznáš) když:**
1. Učiníš architektonické rozhodnutí → `memory/decisions/`
2. Vyřešíš netriviální bug (root cause) → `memory/bugs/`
3. Objevíš projektovou konvenci / skrytou závislost / gotchu → `memory/patterns/`
4. Narazíš na chybu/varování/lint issue → `memory/code-issues/` (ihned; po opravě → `_archive/`)
5. Dokončíš milník / ucelený krok → přepiš `memory/context/project-context.md`
6. Dostaneš feedback „dělej / nedělej takhle" → `auto-memory/feedback/`

**Single source of truth:** pravidla paměti žijí ve vaultu (`policies.md`, `BOOTSTRAP.md`), ne tady. Tento blok je jen ukazatel + triggery.
