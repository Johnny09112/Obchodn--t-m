# Fáze 1 — Čmuchal: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Postavit fázi 1 systému Cantinero — agenta Čmuchala: vyhledávání, ověřování (ARES), geolokace vůči zónám jídelen, obohacování s evidencí a skórování firem. Jen sběr, žádné odesílání.

**Architecture:** TypeScript/Node monorepo-lite. Datová vrstva = SQL migrace ve standardním Supabase layoutu (`supabase/migrations/`), lokálně testované přes PGlite (in-process Postgres). Tvrdá pravidla TP-1/TP-2/TP-5 vynucena v DB (constraints, triggery) a v repository vrstvě (whitelist atributů, transakce atribut+evidence). Deterministická část Čmuchala (ARES, geocoding, vzdálenost, skóre) je čistý kód; obohacování z webu (stravování, kontakty, účel adresy) je LLM krok přes Claude API (`claude-opus-4-8` + `web_search_20260209`) se structured outputs, jehož výstup projde stejnou repository vrstvou (bez zdroje → NULL).

**Tech Stack:** Node 22, TypeScript (strict, ESM), Vitest, @electric-sql/pglite (testovací DB), postgres (prod driver, Supabase), @anthropic-ai/sdk, zod.

## Global Constraints (ze SPEC.md — závazné)

- TP-1: záznam v `companies` jen po úspěšné validaci IČO proti ARES; IČO = PK.
- TP-2: každý dohledaný atribut má záznam v `evidence` (`zdroj_url` NOT NULL, doslovná `citace` max 200 znaků, `ziskano_at`). Bez zdroje NULL, nikdy odhad.
- TP-3/kap. 5: sbírat a personalizovat jen whitelist atributů; zakázané atributy se nesmí ani sbírat.
- TP-4: `nejblizsi_jidelna_id`, `vzdalenost_m`, `v_zone` — firma mimo zónu se do fronty nedostane; může být `cekajici_na_jidelnu`.
- TP-6: úroveň adresy 1=poptávková (`poptavky@`,`nabidky@`,`obchod@`, formulář), 2=obecná (`info@`), 3=jmenná; hledat explicitní účel a zapsat do evidence.
- TP-13: každý běh agenta do `agent_runs`.
- Čmuchal NESMÍ: zapsat firmu bez ARES nebo mimo zónu bez označení, vyplnit atribut bez zdroje, sbírat mimo whitelist, odesílat cokoli.
- Zdroje dat: respektovat robots.txt, rozumné tempo (Nominatim 1 req/s, ARES šetrně), žádný scraping LinkedInu.
- Zóny: pěší ≤ 800 m, krátký dojezd ≤ 3000 m (konfigurovatelné per jídelna přes `zona_metru`).
- Skóre kombinuje: vzdálenost, velikost, absenci vlastní jídelny, kancelářský obor (CZ-NACE), dostupnost poptávkové adresy.
- Kapacita jídelen je strop — CLI musí umět říct, kolik zón a kapacity vůbec je.
- Fáze 1 cíl: 200 ověřených firem v zónách; metriky: podíl polí se zdrojem, podíl chybných záznamů, podíl kontaktů úrovně 1.

## File Structure

```
package.json, tsconfig.json, vitest.config.ts, .gitignore, .env.example
supabase/migrations/0001_init.sql      – celé schéma + tvrdá pravidla v DB
src/db.ts                              – Db rozhraní (query/tx), adaptér postgres i PGlite, runner migrací
src/ico.ts                             – validace IČO (formát + mod-11 checksum) – čistá funkce
src/ares.ts                            – ARES REST klient: fetchSubjekt(ico), searchByObec(kodObce)
src/geo.ts                             – haversine, dobaChuzeMin, klasifikaceZony – čisté funkce
src/geocode.ts                         – Nominatim klient s rate-limitem 1 req/s
src/score.ts                           – spocitejSkore(vstup) → 0–100 – čistá funkce
src/whitelist.ts                       – povolené atributy (kap. 5) + typy
src/repo.ts                            – repository: createCompany (TP-1), setAttribute (TP-2, whitelist), kontakty (TP-6), agent_runs
src/enrich.ts                          – Claude web-research krok, structured output (nálezy s citacemi)
src/cmuchal.ts                         – orchestrátor: jídelna → kandidáti → ARES → geo → zóna → enrich → skóre
src/cli.ts                             – příkazy: migrate, seed-jidelna, run, stav, metriky
playbook-cmuchal.md                    – playbook agenta (sebezlepšování)
test/ico.test.ts, test/geo.test.ts, test/score.test.ts, test/ares.test.ts,
test/repo.test.ts (PGlite), test/cmuchal.test.ts (integrace, mock ARES/geocode/enrich)
```

### Task 1: Scaffold + git

**Files:** Create `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.env.example`.

- [ ] `git init`, vytvořit soubory, `npm install` (typescript, vitest, tsx, @electric-sql/pglite, postgres, @anthropic-ai/sdk, zod, @types/node)
- [ ] `npx vitest run` projde (0 testů OK → přidat smoke test)
- [ ] Commit `chore: scaffold projektu`

### Task 2: Validace IČO (`src/ico.ts`)

**Produces:** `jeValidniIco(ico: string): boolean` — 8 číslic + mod-11 checksum (váhy 8..2; zbytek: 0→1, 1→0, jinak 11−zbytek; poslední číslice = kontrolní).

- [ ] Test: `25596641` (Seznam.cz) valid, `00000001` invalid, `1234567` invalid (délka), `abcdefgh` invalid, `04620701` valid (leading zero).
- [ ] Implementace, testy zelené, commit.

### Task 3: Geo (`src/geo.ts`)

**Produces:** `vzdalenostM(a: {lat,lng}, b: {lat,lng}): number` (haversine, zaokrouhleno na m); `dobaChuzeMin(m: number): number` (rychlost 80 m/min, nahoru); `klasifikujZonu(m: number, zonaMetru: number): 'pesi'|'dojezd'|'mimo'` (pěší ≤ 800, dojezd ≤ zonaMetru, jinak mimo).

- [ ] Testy: known-distance dvojice (Praha centrum body, tolerance ±1 %), hranice 800/3000.
- [ ] Implementace, testy, commit.

### Task 4: Skóre (`src/score.ts`)

**Produces:** `spocitejSkore(v: SkoreVstup): number` (0–100), `SkoreVstup = { vzdalenostM, velikostKategorie: string|null, maVlastniJidelnu: boolean|null, czNace: string[], urovenAdresy: 1|2|3|null }`.

Váhy: vzdálenost max 35 (lineárně 0 m→35 b, ≥3000 m→0), velikost max 25 (mikro 10, malá 18, střední 25, velká 15; NULL 0), vlastní jídelna: false→15, NULL→7, true→0; kancelářský NACE (prefixy 58–66, 69–75, 77–82) max 15; úroveň adresy 1→10, 2→5, 3→2, NULL→0.

- [ ] Testy: ideální firma ≈100, firma bez dat jen za vzdálenost, monotónnost dle vzdálenosti.
- [ ] Implementace, testy, commit.

### Task 5: Schéma DB (`supabase/migrations/0001_init.sql` + `src/db.ts`)

Celé schéma z kap. 8 SPEC (všechny tabulky — i ty pro pozdější fáze, ať je model kompletní). DB-vynucená pravidla:

- `companies.ico` PK, `CHECK (ico ~ '^[0-9]{8}$')`, `stav` CHECK enum, `osloveno_at` (TP-5 základ).
- `evidence.zdroj_url` NOT NULL, `citace` `CHECK (char_length(citace) <= 200)`, `atribut` CHECK proti whitelistu.
- `contacts.zdroj_url` NOT NULL, `uroven_adresy` CHECK IN (1,2,3).
- `system_state` single-row (`id boolean PRIMARY KEY DEFAULT true CHECK (id)`), `sending_enabled DEFAULT false`.
- `suppressions`, `agent_runs`, `jidelny` (`zona_metru DEFAULT 3000`), trigger `updated_at`.

**`src/db.ts` produces:** `interface Db { query<T>(sql: string, params?: unknown[]): Promise<T[]>; tx<T>(fn: (db: Db) => Promise<T>): Promise<T> }`, `pripojPglite()`, `pripojPostgres(url)`, `spustMigrace(db)` (čte `supabase/migrations/*.sql` v pořadí).

- [ ] Test (PGlite): migrace projdou; INSERT company s ico `'abc'` selže; evidence bez zdroj_url selže; druhý řádek system_state selže; evidence s atributem mimo whitelist selže.
- [ ] Implementace, testy, commit.

### Task 6: Repository (`src/repo.ts` + `src/whitelist.ts`)

**Produces:**
- `POVOLENE_ATRIBUTY` (whitelist kap. 5): `ma_vlastni_jidelnu`, `zpusob_stravovani`, `zamestnanci_odhad`, `velikost_kategorie`, `ucel_adresy`.
- `zalozFirmu(db, ares: AresZaznam)` — jediná cesta jak vytvořit company; bere výhradně výstup ARES klienta (TP-1). Nastaví `stav='novy'`.
- `zapisAtribut(db, ico, atribut, hodnota, evidence: {zdrojUrl, citace, confidence?})` — transakce: evidence řádek + update sloupce; atribut mimo whitelist → výjimka; bez zdrojUrl → výjimka (TP-2).
- `zapisKontakt(db, ico, kontakt)` — vyžaduje `zdrojUrl`; `urovenAdresy` povinná.
- `nastavGeo(db, ico, {lat,lng,jidelnaId,vzdalenostM,vZone})`, `nastavSkore`, `nastavStav` (jen povolené přechody `novy→kvalifikovany|cekajici_na_jidelnu|zamitnuty`).
- `zacniBeh(db, agent, vstup)` / `ukonciBeh(db, id, vystup, chyby?, nakladyUsd?)` (TP-13).

- [ ] Testy (PGlite): zalozFirmu happy path; zapisAtribut vytvoří evidence i hodnotu atomicky; atribut mimo whitelist vyhodí; kontakt bez zdroje vyhodí; nepovolený přechod stavu vyhodí.
- [ ] Implementace, testy, commit.

### Task 7: ARES klient (`src/ares.ts`)

API: `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest`. **Produces:**
- `type AresZaznam = { ico, nazev, adresa, obec, okres?, kraj?, psc?, czNace: string[], velikostKategorie: string|null, kodObce?: number }`
- `overFirmu(ico): Promise<AresZaznam|null>` — GET `/ekonomicke-subjekty/{ico}`; 404 → null; validace IČO předem (`jeValidniIco`).
- `najdiFirmyVObci(kodObce: number, opts?): Promise<AresZaznam[]>` — POST `/ekonomicke-subjekty/vyhledat` body `{sidlo:{kodObce}, pocet, start}`, stránkování.
- Kategorie velikosti mapovaná z `kategoriePoctuPracovniku` (CZSO číselník) → `mikro|mala|stredni|velka|null`.
- Šetrné tempo: min 300 ms mezi požadavky, retry na 429/5xx (max 3, backoff).

- [ ] Testy s mockovaným `fetch` (vi.stubGlobal): parsing odpovědi, 404→null, nevalidní IČO → bez network callu, mapování velikosti.
- [ ] Implementace, testy, commit.

### Task 8: Geocoding (`src/geocode.ts`)

**Produces:** `geokoduj(adresa: string): Promise<{lat,lng}|null>` — Nominatim `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=cz&q=…`, User-Agent `cantinero-cmuchal/0.1 (kontaktní e-mail z env)`, tvrdý rate-limit 1 req/s, prázdný výsledek → null (nikdy odhad).

- [ ] Testy s mock fetch: parsing, null při prázdném poli, rate-limit (fake timers: 2 volání ≥1 s od sebe).
- [ ] Implementace, testy, commit.

### Task 9: Enrichment (`src/enrich.ts`)

Claude krok: vstup = firma (název, obec, web pokud známý z ARES). Výstup = structured output (zod → JSON schema):

```ts
type Nalez = { atribut: 'ma_vlastni_jidelnu'|'zpusob_stravovani'|'ucel_adresy',
               hodnota: string, zdrojUrl: string, citace: string }   // citace ≤200 zn., doslovná
type NalezenyKontakt = { email: string, urovenAdresy: 1|2|3, jmeno?: string,
                         prijmeni?: string, pozice?: string, zdrojUrl: string, citace: string }
type EnrichVysledek = { nalezy: Nalez[], kontakty: NalezenyKontakt[], poznamkaProPlaybook?: string }
```

- Model `claude-opus-4-8`, `thinking: {type:'adaptive'}`, tools `[{type:'web_search_20260209', name:'web_search', max_uses: 8}]`, `output_config.format` (json_schema). Prompt: jen whitelist, jen doslovné citace se zdrojem, priorita adres dle TP-6, max 2 kontaktní osoby (HR/office/provoz/jednatel), nic si nedomýšlet — raději prázdno.
- Zápis výsledků NEprovádí enrich, vrací data; zápis dělá orchestrátor přes `repo` (druhá obranná linie: whitelist + povinná evidence).
- `nakladyUsd` odhad z `usage` (ceník Opus 4.8: $5/M in, $25/M out) — vrací se pro `agent_runs`.

- [ ] Test: mock Anthropic klienta (inject přes parametr), ověřit že se výstup validuje zodem a nevalidní nález (bez citace/URL) se zahodí.
- [ ] Implementace, testy, commit.

### Task 10: Orchestrátor (`src/cmuchal.ts`)

**Produces:** `spustCmuchala(deps, jidelnaId, opts?: {limit?: number})` kde `deps = { db, ares, geokoduj, enrich }` (injektovatelné pro testy).

Postup (dle SPEC 10.1): načti jídelnu (aktivní, kapacita_volna>0, jinak konec s hláškou) → `najdiFirmyVObci` → pro každou: `overFirmu` (bez shody zahoď) → geokoduj adresu (null → zahoď, zapiš do playbook stats) → vzdálenost+zóna → mimo zónu: ulož jen pokud ≤ 2× zóna jako `cekajici_na_jidelnu`, jinak přeskoč → `zalozFirmu` + `nastavGeo` → atributy z ARES přes `zapisAtribut` (zdroj = ARES URL subjektu, citace = pole z odpovědi) → `enrich` → nálezy/kontakty přes repo → `spocitejSkore` → `nastavSkore` + `nastavStav('kvalifikovany')`. Celé v `zacniBeh`/`ukonciBeh` (TP-13), chyby jednotlivé firmy nezabijí běh (zapíší se do `chyby`).

- [ ] Integrační test (PGlite + mock ares/geokoduj/enrich): 3 kandidáti — 1 v pěší zóně (→ kvalifikovany, má evidence, skóre>0), 1 mimo zónu do 2× (→ cekajici_na_jidelnu), 1 neprojde ARES (→ neexistuje v DB); agent_runs má záznam se started/finished.
- [ ] Implementace, testy, commit.

### Task 11: CLI + playbook + README

**Produces:** `src/cli.ts` — příkazy:
- `migrate` (DATABASE_URL → postgres, jinak chyba s nápovědou),
- `seed-jidelna --nazev --adresa --lat --lng --kapacita [--zona]`,
- `run --jidelna <id> [--limit N]` (spustí Čmuchala; bez ANTHROPIC_API_KEY jen deterministická část, enrich přeskočí s varováním),
- `stav` (počty firem dle stavu, kapacita jídelen vs. kvalifikované firmy),
- `metriky` (fáze-1 metriky: podíl polí se zdrojem, podíl kontaktů úrovně 1, počet ověřených kontaktů na firmu).

`playbook-cmuchal.md` — kostra: strategie vyhledávání, co fungovalo (úspěšnost zdrojů), měřítka ze SPEC. `README.md` — jak spustit, co je hotové, co je fáze 2+.

- [ ] Smoke test CLI (`stav`, `metriky` nad PGlite přes env `CANTINERO_TEST_DB=pglite`).
- [ ] Implementace, testy, plný `npx vitest run` zelený, commit.

## Self-Review (provedeno)

- Pokrytí SPEC fáze 1: sběr ✓, ARES ✓ (TP-1), evidence ✓ (TP-2), whitelist ✓ (TP-3/kap.5), zóny ✓ (TP-4/kap.2), úrovně adres ✓ (TP-6), audit ✓ (TP-13), skóre ✓, playbook ✓, metriky ✓. Odesílání/šablony/suppression logika = fáze 3 (schéma připraveno, logika ne — správně mimo rozsah).
- Typová konzistence: `AresZaznam` (T7) konzumuje `zalozFirmu` (T6) — pozor na pořadí: T6 definuje typ v `src/ares.ts`? Ne — typ `AresZaznam` žije v `src/ares.ts`; T6 ho importuje jen typově, implementace T7 později doplní klienta. OK.
- Bez placeholderů: každý task má konkrétní rozhraní, testy a kritéria.
