<!-- Vlož jako sekci do projektového CLAUDE.md (<PROJECT_ROOT>\CLAUDE.md). -->

## Paměť (long-term memory)

Tento projekt má dlouhodobou paměť ve vaultu `<PROJECT_VAULT>\_claude\`. Spravuj ji podle pravidel.

**Na startu session** (po auto-injektovaném `auto-memory/MEMORY.md`):
1. Přečti `<PROJECT_VAULT>\_claude\memory\INDEX.md` — katalog záznamů.
2. Přečti `<PROJECT_VAULT>\_claude\memory\context\project-context.md` — živý stav.
3. Načti relevantní záznamy dle úkolu. Mechanika: `BOOTSTRAP.md`. Invarianty: `policies.md`.

**Zapiš OKAMŽITĚ (event-triggered, ne na „konec session" — ten nepoznáš) když:**
1. Učiníš architektonické rozhodnutí → `memory/decisions/`
2. Vyřešíš netriviální bug (root cause) → `memory/bugs/`
3. Objevíš projektovou konvenci / skrytou závislost / gotchu → `memory/patterns/`
4. Narazíš na chybu/varování/lint issue → `memory/code-issues/` (ihned; po opravě → `_archive/`)
5. Dokončíš milník / ucelený krok → přepiš `memory/context/project-context.md`
6. Dostaneš feedback „dělej / nedělej takhle" → `auto-memory/feedback/`

**Single source of truth:** pravidla paměti žijí ve vaultu (`policies.md`, `BOOTSTRAP.md`), ne tady. Tento blok je jen ukazatel + triggery.
