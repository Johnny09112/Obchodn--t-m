<!-- AUTO-GENEROVÁNO reindex.js — NEEDITUJ ručně. Zdroj pravdy = frontmatter souborů. -->
# Index paměti — obchodni-tym

> Plný katalog on-demand záznamů. Always-load vrstvu viz auto-memory/MEMORY.md.

## Context
- [[use-casy]] — Které use-casy dnes systém obsluhuje — stravování pro střední a větší firmy, docházkové systémy pro obce i firmy · active · 2026-08-10
- [[project-context]] — Živý stav projektu obchodni-tym (Cantinero) — fáze, milníky, aktuální focus · active · 2026-08-07

## Decisions
- [[produkt-neni-vazany-na-obor]] — Cantinero se prodává firmám z jakéhokoli oboru — jídelny jsou jen jeden z use-caseů, žádná data se nesmí odepsat jako nepotřebná · active · 2026-08-10
- [[dve-vrstvy-znalost-a-zprava]] — Whitelist váže obsah zprávy, ne sběr — SPEC kap. 5 rozdělena na znalost o firmě a obsah oslovení · active · 2026-08-06
- [[male-firmy-a-nezname-jde-pribrat]] — Firmy bez známé velikosti i firmy do 24 zaměstnanců jde do kampaně přibrat dodatečně, každé vlastním tlačítkem · active · 2026-08-04
- [[jidelna-se-nepriradi-rucne]] — Jídelna se k oblasti nevybírá ručně — ukazuje se, které v tom tvaru leží · active · 2026-08-03
- [[obrazovka-oblasti-a-listovani]] — Oblasti = mapa nahoře, jeden seznam pod ní ovládá vrstvy; kartotéka se listuje po stovkách · active · 2026-08-03
- [[kontakty-i-nad-oblasti]] — Doplňování kontaktů umí i firmy bez jídelny — sběr nad oblastí je zakládá mimo zónu · active · 2026-08-02
- [[oznameni-u-hodin]] — Dokončený průzkum hlásí bublina Windows; text skládá jádro, hlídka ho jen zobrazí · active · 2026-08-02
- [[resurse-agentem-zmereno]] — Rešerše Čmuchalem změřená na 20 firmách — 64 s na firmu, e-mail u 19 z 20 · active · 2026-08-02
- [[tvar-oblasti-u-pruzkumu]] — Průzkum si zapamatuje tvar oblasti, který skutečně prošel — zapisuje se při zahájení · active · 2026-08-02
- [[velikost-ze-souboru-a-slozeni]] — Velikost firem se ukládá ze souboru ČSÚ; složení území je v pohledu a v proužku · active · 2026-08-02
- [[hlidka-cmuchala-u-majitele]] — Naplánovaný běh Čmuchala je ikona u hodin na majitelově počítači · active · 2026-08-01
- [[kampan-nad-vice-oblastmi]] — Kampaň stojí na množině oblastí (kampan_oblasti); sloupec kampane.oblast_id zrušen · active · 2026-08-01
- [[mazani-oblasti]] — Kdo smí mazat oblasti a co jim v tom brání — kampaň a průzkum, ne firmy · active · 2026-08-01
- [[odesilani-zakazano-jen-docasne]] — Zákaz odesílání je bezpečnostní pojistka do fáze 3, ne trvalá zásada · active · 2026-08-01
- [[pamet-projektu-ve-vaultu]] — Paměť projektu se přestěhovala z memory/ do vaultu _claude/ · active · 2026-08-01
- [[prehled-oblasti-pohledem]] — Seznam oblastí čte databázový pohled oblasti_prehled, ne dopočet v prohlížeči · active · 2026-08-01
- [[sito-mezi-oblasti-a-kampani]] — Síto koho neoslovovat sedí na hranici oblast → kampaň, ne v přepočtu oblasti · active · 2026-08-01
- [[skore-bez-zname-vzdalenosti]] — Skóre bez vzdálenosti se přepočítává na stejnou stupnici, ne usekává · active · 2026-08-01
- [[zastup-spravce-a-zamceni-kampani]] — Kampaň upravuje správce, jeho zástup a admin; mazat smí jen admin · active · 2026-08-01

## Patterns
- [[dva-profily-sber-a-reserse]] — Profil se čte ze dvou míst — sběr bere globálně aktivní, rešerše profil kampaně; kdo ho čte, musí říct který · active · 2026-08-07
- [[tri-kopie-seznamu-atributu]] — Pevný seznam žil ve čtyřech kopiích — zrušit ho v jedné znamená ostrou dávku s nulou, která vypadá hotově · active · 2026-08-07
- [[tajemstvi-mimo-pracovni-slozku]] — Omezení nástrojů agenta není bezpečnostní hranice — tajemství musí ležet mimo pracovní složku · active · 2026-08-06
- [[zamykej-vyjmenovanim-zamcenych-stavu]] — Zámek psaný jako „otevřený je jen jeden stav" zamkne i pracovní stavy — vyjmenuj stavy zamčené · active · 2026-08-04
- [[ares-nedoplni-velikost]] — Dotaz do ARESu na velikost firmy nevrátí nic navíc proti souboru ČSÚ — je to tentýž registr · active · 2026-08-02
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
- [[pootocene-urovne-adres]] — Obrazovka i příkazová řádka hlásily úroveň 1 jako jmenovanou osobu, ačkoli TP-6 říká opak — a právě to číslo hlídá GDPR · fixed · 2026-08-06
- [[chybejici-index-na-contacts]] — Kartotéka se načítala 20+ s, protože contacts.ico neměl index — cizí klíč index nedělá · fixed · 2026-08-03
- [[sber-neukladal-velikost]] — Oprava velikosti byla jen zpětná — sběr ji dál nezapisoval, takže nová kampaň měla nula firem · fixed · 2026-08-03
- [[tazeni-bodu-prerusoval-react]] — Bod tvaru šel posunout jen o kousek — každý drag překreslil vrstvu a sebral úchyt zpod myši · fixed · 2026-08-03
- [[zapis-po-jedne-je-lokalne-neviditelny]] — Přepočet oblasti vkládal firmy po jedné — na PGlite rychle, přes síť minuty · fixed · 2026-08-01

## Research
- [[otevrene-pozadavky-majitele]] — Co majitel vyžádal nebo co čeká na jeho rozhodnutí, k 3. 8. 2026 · active · 2026-08-03

