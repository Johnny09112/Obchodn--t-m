# Kampaň nad více oblastmi — plán

**Cíl:** kampaň se smí opírat o víc než jednu oblast. Firmy se sjednotí,
průzkum se objedná pro každou oblast zvlášť.

**Co se NESTAVÍ:** geometrické slučování tvarů. Majitel to potvrdil — chce
vybrat víc ploch, ne z nich udělat jednu. Slučování by navíc zničilo evidenci
o tom, které území se kdy analyzovalo.

**Architektura:** vazební tabulka `kampan_oblasti` místo sloupce
`kampane.oblast_id`. Jeden zdroj pravdy, ne dva — sloupec se ruší, ne nechává
„pro jistotu". Ochranu oblastí před smazáním přebírá cizí klíč vazební tabulky
(`on delete restrict`), takže platí dál to, co zavedla migrace 0028.

---

## Task 1 — Schéma (migrace 0030)

**Soubory:** `supabase/migrations/0030_kampan_oblasti.sql`,
`test/kampan-oblasti.test.ts`

- `kampan_oblasti (kampan_id, oblast_id, poradi)`, PK `(kampan_id, oblast_id)`.
- `kampan_id` → `on delete cascade` (vazba je součást kampaně).
- `oblast_id` → **`on delete restrict`** (oblast drží kampaň, i archivovaná).
- Převod dat z `kampane.oblast_id`, pak sloupec **drop**.
- Přepsat pohled `oblasti_prehled` — kampaně čte přes vazbu.
- Pravidla: čtení všem, zápis `smi_do_kampane(kampan_id)`.

**Testy:** převod zachová stávající vazby · smazání kampaně vazbu uklidí ·
oblast s kampaní nejde smazat · `oblasti_prehled` vyjmenuje kampaně dál.

## Task 2 — Jádro: území kampaně

**Soubory:** `src/kampan.ts`, `test/kampan-uzemi.test.ts`

- `nastavUzemi(db, kampanId, { oblastiIds, jidelnaId })` — nastaví celou
  množinu naráz (smaže staré, vloží nové). Prázdná množina je legitimní stav.
- `oblastiKampane(db, kampanId): Promise<UlozenaOblast[]>`.
- `Kampan.oblastId` mizí; kdo potřebuje území, zeptá se.

## Task 3 — Jádro: naplnění ze všech oblastí

**Soubory:** `src/kampan.ts`, `test/kampan-napln-vice.test.ts`

- `naplnZOblasti` projde všechny oblasti kampaně, přepočítá každou a firmy
  **sjednotí**. Firma ve dvou oblastech je jedna firma (TP-5).
- Vynechané se hlásí jednou, ne za každou oblast zvlášť.
- Síto zůstává na stejné hranici (viz rozhodnutí `sito-mezi-oblasti-a-kampani`).

## Task 4 — Průzkum pro víc oblastí

**Soubory:** `src/pruzkum.ts` nebo `src/kampan.ts`, `src/pruzkum-postup.ts`,
`test/pruzkum-kampane.test.ts`

- Objednávka pro kampaň = jedna objednávka **na každou oblast**, která ještě
  hotový průzkum nemá. Už prozkoumaná oblast se neobjednává znovu.
- Souhrn postupu přes víc objednávek: „Hotové 2 ze 3 oblastí, běží Klatovsko."

## Task 5 — Aplikace: krok 2 průvodce (výběr území)

**Soubory:** `app/src/SeznamOblasti.tsx`, `app/src/PruvodceKampani.tsx`,
`app/src/data.ts`

- Výběr se dělá **v seznamu oblastí zaškrtávátky**, ne klikáním do mapy.
  Seznam už ukazuje detail, který majitel chtěl vidět při rozhodování.
  Mapa zůstává pod ním na orientaci.
- **Varování na překryv:** když se vybrané oblasti překrývají, řekni to.
  Firma se sice započítá jednou, ale je to znamení, že výběr je nechtěný.

## Task 6 — Aplikace: kroky 3 a 4, seznam kampaní

**Soubory:** `app/src/PruvodceKampani.tsx`, `app/src/Kampane.tsx`,
`app/src/data.ts`

- Krok 3 objedná průzkum pro všechny oblasti a ukáže postup dohromady.
- Krok 4 (seznam firem) beze změny — čte kampaň, ne oblast.
- Sloupec „Území" v seznamu kampaní vypíše názvy oblastí, ne „vybrané".

## Task 7 — Uzavření

`npm test` · `npm run typecheck` · `npm run build --prefix app` ·
`npm run cli -- migrate` · proklikat v prohlížeči · zápis do paměti.
