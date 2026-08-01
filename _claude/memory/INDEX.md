<!-- AUTO-GENEROVÁNO reindex.js — NEEDITUJ ručně. Zdroj pravdy = frontmatter souborů. -->
# Index paměti — obchodni-tym

> Plný katalog on-demand záznamů. Always-load vrstvu viz auto-memory/MEMORY.md.

## Context
- [[project-context]] — Živý stav projektu obchodni-tym (Cantinero) — fáze, milníky, aktuální focus · active · 2026-08-01

## Decisions
- [[hlidka-cmuchala-u-majitele]] — Naplánovaný běh Čmuchala je ikona u hodin na majitelově počítači · active · 2026-08-01
- [[mazani-oblasti]] — Kdo smí mazat oblasti a co jim v tom brání — kampaň a průzkum, ne firmy · active · 2026-08-01
- [[odesilani-zakazano-jen-docasne]] — Zákaz odesílání je bezpečnostní pojistka do fáze 3, ne trvalá zásada · active · 2026-08-01
- [[pamet-projektu-ve-vaultu]] — Paměť projektu se přestěhovala z memory/ do vaultu _claude/ · active · 2026-08-01
- [[prehled-oblasti-pohledem]] — Seznam oblastí čte databázový pohled oblasti_prehled, ne dopočet v prohlížeči · active · 2026-08-01
- [[sito-mezi-oblasti-a-kampani]] — Síto koho neoslovovat sedí na hranici oblast → kampaň, ne v přepočtu oblasti · active · 2026-08-01
- [[skore-bez-zname-vzdalenosti]] — Skóre bez vzdálenosti se přepočítává na stejnou stupnici, ne usekává · active · 2026-08-01
- [[zastup-spravce-a-zamceni-kampani]] — Kampaň upravuje správce, jeho zástup a admin; mazat smí jen admin · active · 2026-08-01

## Patterns
- [[automaticka-uprava-textu-potrebuje-guard]] — Skript, který jen vypíše hotovo, nic nedokazuje — hlídej každou náhradu zvlášť · active · 2026-08-01
- [[cantinero-data-dir-vs-database-url]] — CANTINERO_DATA_DIR neplatí, když je nastavené DATABASE_URL · active · 2026-08-01
- [[hook-cjs-v-esm-projektu]] — Hooky ze šablon bývají CommonJS, ale tenhle projekt má type: module · active · 2026-08-01
- [[postgrest-strop-na-radky]] — Server má strop na počet řádků a .limit() ho nepřebije · active · 2026-08-01
- [[powershell-ps1-potrebuje-bom]] — PowerShell 5.1 čte .ps1 jako ANSI — soubory s diakritikou potřebují UTF-8 BOM · active · 2026-08-01
- [[rls-nejde-testovat-chovanim-lokalne]] — Pravidla přístupu se lokálně testují čtením textu, ne chováním · active · 2026-08-01
- [[typecheck-nekontroloval-app]] — Kořenový typecheck nesahal do app/ — ověř, co kontrola doopravdy kontroluje · active · 2026-08-01
- [[vercel-instaluje-jen-app-zavislosti]] — Vercel neinstaluje kořenové závislosti; aplikace si nesmí přitáhnout db.ts · active · 2026-08-01
- [[zamitnuty-zapis-bez-chyby]] — Zamítnutý zápis Supabase nehlásí jako chybu — jen změní nula řádků · active · 2026-08-01
- [[zelene-testy-nejsou-hotova-obrazovka]] — Testy a typy nechytí vady toku a pořadí — frontend se musí proklikat · active · 2026-08-01

## Bugs
- [[zapis-po-jedne-je-lokalne-neviditelny]] — Přepočet oblasti vkládal firmy po jedné — na PGlite rychle, přes síť minuty · fixed · 2026-08-01

## Research
- [[otevrene-pozadavky-majitele]] — Co majitel vyžádal a k 1. 8. 2026 není postavené · active · 2026-08-01

