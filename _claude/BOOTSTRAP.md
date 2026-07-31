# Operating manual paměti — obchodni-tym

> JAK pracovat s pamětí tohoto projektu. Invarianty (CO musí platit) viz `policies.md`. Tady je mechanika.
> Plain Markdown — žádné Obsidian callouty. `[[slug]]` = textová reference na jiný paměťový soubor.

## Start session

1. `auto-memory/MEMORY.md` se načte automaticky (harness) — feedback + ukazatele.
2. Přečti `memory/INDEX.md` — plný katalog záznamů s `description`.
3. Přečti `memory/context/project-context.md` — živý stav projektu.
4. Podle úkolu načti relevantní záznamy z INDEXu (ne vše).
5. Hygiena: pokud běží `reindex.js` (SessionStart hook), INDEX je čerstvý. Jinak zkontroluj, že INDEX odpovídá souborům, a archivuj vyřešené/staré (viz „Životní cyklus").

## Routing — co kam

| Co zapisuju | Kam |
|---|---|
| Architektonické rozhodnutí (knihovna, pattern, struktura) | `memory/decisions/` |
| Vyřešený netriviální bug (root cause) | `memory/bugs/` |
| Projektová konvence / skrytá závislost / gotcha | `memory/patterns/` |
| Otevřená chyba/varování/lint issue | `memory/code-issues/` |
| Změna fáze/milníku/stavu | `memory/context/project-context.md` (přepis v místě) |
| User feedback „dělej / nedělej takhle" | `auto-memory/feedback/` |
| Session note | `memory/sessions/` |
| Audit / roadmapa / WIP design / analýza | `memory/research/` |

## Kdy zapsat

Triggery „zapiš TEĎ když…" jsou v projektovém CLAUDE.md (auto-injektované, aby fírovaly nevyžádaně). Připomínka: zápis je event-triggered, okamžitý — ne dávkový „na konec session" (ten Claude nepozná).

Nezapisuj: triviální operace (npm install, formátování), obsah souborů (jen referenci na cestu), spekulace, cokoli co drží repo.

## Jak založit záznam

1. Zkopíruj skeleton z `memory/_templates/<kategorie>.md`.
2. Vyplň frontmatter — `name` = jméno souboru bez `.md`, `description` informativně (jde do INDEXu).
3. Ulož jako `memory/<kategorie>/<slug>.md`.
4. INDEX se přegeneruje skriptem (nebo přidej řádek ručně — fallback dle `policies.md`).

### Formát frontmatteru (memory/)

```yaml
---
name: priklad-rozhodnuti
description: Jednořádkový popis, který uvidím v INDEXu
type: decision
status: active
created: 2026-06-22
updated: 2026-06-22
related: [jiny-slug]
---
```

### Příklad záznamu (decision)

```markdown
---
name: drift-na-atomicke-soubory
description: Paměť sjednocena na atomické soubory + frontmatter; zrušeny callouty
type: decision
status: active
created: 2026-06-22
updated: 2026-06-22
---

# Atomické paměťové soubory místo velkých append souborů

**Kontext:** Velké append soubory potřebovaly ruční kompakci a driftovaly.
**Rozhodnutí:** Jeden topik = jeden soubor v tematické podsložce.
**Důvod:** Recall po relevanci, archivace přesunem, jeden formát.
**Důsledky:** INDEX generuje reindex.js.
```

## Životní cyklus & hygiena

- Úklid event-triggered: code-issue vyřešen → `status: resolved` + přesun do `memory/_archive/` hned; rozhodnutí překonáno → `status: superseded` + `related` na nástupce.
- `project-context.md` přepisuj v místě — jediný živý soubor, neapenduj.
- Start-session: archivuj `sessions/` a `research/` nad práh (~20 souborů → nejstarší do `_archive/`).
- Duplicita: před zápisem projdi INDEX; existuje-li soubor o tomtéž → uprav existující, nezakládej druhý.
- „Konec session" neexistuje jako trigger — nahrazeno start-hygienou + event-zápisem + explicitními closure cues od uživatele („to je vše", „shrň").
