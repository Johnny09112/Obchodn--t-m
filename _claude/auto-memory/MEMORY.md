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

**S0.5 tvrzení a šablony — čeká na schválení majitelem.** Texty jsou hotové
a prošly kontrolou stylu; v databázi zatím nic (claims i templates 0 řádků).
Podrobnosti a seznam toho, co zbývá, jsou v souboru
`_claude/memory/context/project-context.md`, sekce „Tvrzení a šablony (S0.5)".

Když majitel napíše jen **„pokračujeme"**, začni tím souborem.

## Jak používat tuto paměť

- Záznamy (decisions, bugs, patterns, …) jsou on-demand v `memory/` — najdi je přes `memory/INDEX.md`.
- Zapisuj event-triggered (triggery viz projektový CLAUDE.md). „Konec session" neřeš — neexistuje jako trigger.
