# Paměť — obchodni-tym

> Always-load index (harness auto-injektuje prvních ~200 řádků / 25 KB). Drž KRÁTKÉ — index, ne obsah.
> Mechanika: `BOOTSTRAP.md` · Invarianty: `policies.md` · Plný katalog: `memory/INDEX.md` · Živý stav: `memory/context/project-context.md`

## Feedback (always-load pravidla chování)

<!-- AUTO:feedback — jeden řádek na soubor z auto-memory/feedback/*.md; formát: - [[slug]] — háček -->
- [[overuj-obrazovky-v-prohlizeci]] — frontend neodhaduj; řekni si o přihlášení a proklikej to
- [[agent-jde-z-predplatneho]] — rešerše Čmuchalem nic nestojí navíc, neblokuj ji dotazem na peníze
- [[pushuj-na-git-sam]] — `git push` dělej sám, nenechávej ho majiteli k odkliknutí
<!-- /AUTO:feedback -->

## ▶ Rozdělaná práce

Když majitel napíše jen **„pokračujeme"**, přečti
`_claude/memory/context/project-context.md` — hned nahoře je sekce
**„TADY POKRAČOVAT"** s celým kontextem a dvěma otázkami, které mu máš
položit. Nic jiného rozdělaného není.

## Jak používat tuto paměť

- Záznamy (decisions, bugs, patterns, …) jsou on-demand v `memory/` — najdi je přes `memory/INDEX.md`.
- Zapisuj event-triggered (triggery viz projektový CLAUDE.md). „Konec session" neřeš — neexistuje jako trigger.
