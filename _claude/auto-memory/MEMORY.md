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

**Nastavení zprávy u kampaně — dodávky 1 a 2 hotové 18. 8.** Parametry
nabídky se zavádějí v aplikaci a kampaň má krok „Zpráva" s náhledem
hotového mailu na skutečné firmě. **Zbývá dodávka 3 — editor šablony.**

**S0.5 — texty schválené 18. 8. a uložené.** V ostré databázi je 8 tvrzení
a šablona `vsichni/email` v1. Zbývá **cena u jídelny** (čeká na majitelovo
ano) a **upozornění + vyřazení firem bez povinných údajů** (rozhodnuto,
nepostavené). Podrobnosti v `_claude/memory/context/project-context.md`,
sekce „Co zbývá v S0.5".

Když majitel napíše jen **„pokračujeme"**, začni tím souborem.

## Jak používat tuto paměť

- Záznamy (decisions, bugs, patterns, …) jsou on-demand v `memory/` — najdi je přes `memory/INDEX.md`.
- Zapisuj event-triggered (triggery viz projektový CLAUDE.md). „Konec session" neřeš — neexistuje jako trigger.
