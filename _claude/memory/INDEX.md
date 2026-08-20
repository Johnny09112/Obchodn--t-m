<!-- AUTO-GENEROVÁNO reindex.js — NEEDITUJ ručně. Zdroj pravdy = frontmatter souborů. -->
# Index paměti — obchodni-tym

> Plný katalog on-demand záznamů. Always-load vrstvu viz auto-memory/MEMORY.md.

## Context
- [[project-context]] — Živý stav projektu obchodni-tym (Cantinero) — fáze, milníky, aktuální focus · active · 2026-08-20
- [[revize-zari]] — K 1. září ověřit větu „od září vaříme" v šablonách — po začátku školního roku přestane platit · active · 2026-08-18
- [[use-casy]] — Které use-casy dnes systém obsluhuje — stravování pro střední a větší firmy, docházkové systémy pro obce i firmy · active · 2026-08-10

## Decisions
- [[druha-firma-vlastni-instance]] — Druhý zákazník dostane vlastní instanci (databáze, nasazení, tajemství), ne přestavbu na víc firem v jedné databázi — a tím se otevírá fáze 3 · active · 2026-08-20
- [[spadovy-bod-je-volitelny]] — Nabídka nemusí mít místo, ke kterému se počítá vzdálenost — profil nese příznak ma_spadovy_bod a bez něj se vzdálenost ani cena nevyžadují · active · 2026-08-20
- [[zkusebni-odeslani-na-vlastni-adresu]] — Zkušební zprávy chodí na vlastní adresu majitele, mají vlastní přepínač oddělený od ostrého odesílání a nepočítají se do TP-5 · active · 2026-08-20
- [[cena-v-osloveni]] — Cena patří ke konkrétní jídelně, ne do šablony ani na ceník — před spuštěním kampaně se odsouhlasí · active · 2026-08-18
- [[jedna-sablona-a-uplnost-blokuje]] — Jedna hlavní šablona pro všechny; chybějící jméno se nahradí „Dobrý den“, chybějící ostatní údaj firmu z kampaně vyřadí a je vidět v tabulce · active · 2026-08-18
- [[kdo-vari-a-co-se-neprozrazuje]] — Cantinero nevaří — zajišťuje spojení mezi jídelnou a strávníkem; a v oslovení se konkrétní jídelna nejmenuje, aby ji zákazník neobešel · active · 2026-08-18
- [[podobnost-podle-objemu]] — Kontrola podobnosti zpráv se zapíná až nad 20 mailů denně a segmenty vznikají z reakcí, ne z tabulky velikostí · active · 2026-08-18
- [[prah-povyseni-varianty-80]] — Práh pro automatické povýšení varianty šablony snížen ze 150 na 80 zpráv na rameno — se 165 firmami by test se 150 nikdy nedoběhl · active · 2026-08-18
- [[reserse-i-bez-jidelny]] — Rešerše smí i na firmy bez jídelny v dosahu — data se předpřipravují, tvrdá zábrana je až u odeslání · active · 2026-08-18
- [[sablona-ma-tri-vrstvy]] — Přenositelná je stavba zprávy, ne její slova — u nového zákazníka si tvrzení vyptá agent a slova z nich složí · active · 2026-08-18
- [[detail-firmy-ma-porad-sekci]] — Detail firmy má pevné pořadí sekcí od oboru po chybějící údaje a ukazuje pět nejbližších jídelen do 50 km · active · 2026-08-17
- [[firma-smi-byt-prilezitost-i-neoslovovat]] — Firma může mít současně příležitostní i vylučovací podnět — je to platný stav, ne chyba; podněty se netřídí podle firem a nic se neskrývá · active · 2026-08-17
- [[kapacita-se-upravuje-v-aplikaci]] — Volná kapacita jídelny se mění v aplikaci na obrazovce Jídelny a dělí se na „v provozu" a „v přípravě" — sečíst je dohromady by tvrdilo, že máme víc, než máme · active · 2026-08-17
- [[odesilaci-domena-a-adresa]] — Posílá se z adresy přihlášeného uživatele přes Resend a odesílací doména musí být nastavitelná per firma, protože se systém bude prodávat · active · 2026-08-17
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
- [[zalozni-adresa-databaze-je-past]] — Záložní („??") adresa databáze v kódu aplikace se u druhého nasazení mění v tiché připojení k cizím datům — nastavení musí chybět hlasitě · active · 2026-08-20
- [[cantinero-data-dir-vs-database-url]] — CANTINERO_DATA_DIR neplatí, když je nastavené DATABASE_URL · active · 2026-08-18
- [[js-hranice-slova-a-diakritika]] — \b v JavaScriptu nezná diakritiku — /\bvaší\b/ nenajde nic, protože „í" není slovní znak; použij hranice přes \p{L} · active · 2026-08-18
- [[ostra-data-jsou-v-cloudu]] — Ostrá data leží v cloudovém Postgresu za DATABASE_URL, ne v data/pgdata-v5 — lokální kopie zamrzla 29. 7. na 167 firmách a tiše odpoví na každý dotaz · active · 2026-08-18
- [[personalizace-jen-z-whitelistu]] — Podle čeho firmu vybíráme a co o ní smíme napsat jsou dvě různé množiny — směnný provoz je signál, ale do zprávy nesmí · active · 2026-08-18
- [[pravidlo-v-jadru-nehlida-obrazovku]] — Pravidlo napsané v src/ nehlídá obrazovku — aplikace zapisuje do Supabase přímo a na jádro nedosáhne; patří do databáze · active · 2026-08-18
- [[rls-bez-politiky-je-tiche-prazdno]] — Tabulka se zapnutým RLS a bez jediné politiky je pro aplikaci neviditelná — nevrátí chybu, vrátí nula řádků · active · 2026-08-18
- [[sklonovani-do-zpravy]] — Údaj do české věty potřebuje pád — skloňuj jen tam, kde je pravidlo jisté, jinak ustup na tvar, který je vždycky správně · active · 2026-08-18
- [[jsonb-se-serializuje-dvakrat]] — JSON.stringify do jsonb sloupce uloží v ostré databázi řetězec místo objektu — PGlite ho rozparsuje, postgres.js serializuje podruhé, takže testy mlčí · active · 2026-08-17
- [[nowrap-v-gridu-pretece-pres-sousedy]] — Popisek s white-space: nowrap uvnitř gridové buňky nezalomí, ale přeteče přes sousední sloupec — čísla se překryjí a nic to nenahlásí · active · 2026-08-17
- [[spojeni-neni-pocet-kontaktu]] — „Spojení" znamená kontakt s e-mailem nebo telefonem — počet kontaktů je jiné číslo a smíchat je znamená protimluv na jedné obrazovce · active · 2026-08-17
- [[dosah-je-tabulka-ne-sloupec]] — Dosah jídelen drží tabulka `dosah`, ne `companies.nejblizsi_jidelna_id` — dotaz na sloupec ukáže nulu i tam, kde dosah je · active · 2026-08-13
- [[firma-bez-razitka-se-vraci-navzdy]] — Firmu, kterou agent tiše přeskočí, nikdo nerazítkuje — vrací se do každé další dávky a fronta nikdy nedojde · active · 2026-08-13
- [[dva-profily-sber-a-reserse]] — Profil se čte ze dvou míst — sběr bere globálně aktivní, rešerše profil kampaně; kdo ho čte, musí říct který · active · 2026-08-07
- [[tri-kopie-seznamu-atributu]] — Pevný seznam žil ve čtyřech kopiích — zrušit ho v jedné znamená ostrou dávku s nulou, která vypadá hotově · active · 2026-08-07
- [[tajemstvi-mimo-pracovni-slozku]] — Omezení nástrojů agenta není bezpečnostní hranice — tajemství musí ležet mimo pracovní složku · active · 2026-08-06
- [[zamykej-vyjmenovanim-zamcenych-stavu]] — Zámek psaný jako „otevřený je jen jeden stav" zamkne i pracovní stavy — vyjmenuj stavy zamčené · active · 2026-08-04
- [[ares-nedoplni-velikost]] — Dotaz do ARESu na velikost firmy nevrátí nic navíc proti souboru ČSÚ — je to tentýž registr · active · 2026-08-02
- [[automaticka-uprava-textu-potrebuje-guard]] — Skript, který jen vypíše hotovo, nic nedokazuje — hlídej každou náhradu zvlášť · active · 2026-08-01
- [[hook-cjs-v-esm-projektu]] — Hooky ze šablon bývají CommonJS, ale tenhle projekt má type: module · active · 2026-08-01
- [[postgrest-strop-na-radky]] — Server má strop na počet řádků a .limit() ho nepřebije · active · 2026-08-01
- [[powershell-ps1-potrebuje-bom]] — PowerShell 5.1 čte .ps1 jako ANSI — soubory s diakritikou potřebují UTF-8 BOM · active · 2026-08-01
- [[rls-nejde-testovat-chovanim-lokalne]] — Pravidla přístupu se lokálně testují čtením textu, ne chováním · active · 2026-08-01
- [[typecheck-nekontroloval-app]] — Kořenový typecheck nesahal do app/ — ověř, co kontrola doopravdy kontroluje · active · 2026-08-01
- [[vercel-instaluje-jen-app-zavislosti]] — Vercel neinstaluje kořenové závislosti; aplikace si nesmí přitáhnout db.ts · active · 2026-08-01
- [[zamitnuty-zapis-bez-chyby]] — Zamítnutý zápis Supabase nehlásí jako chybu — jen změní nula řádků · active · 2026-08-01
- [[zelene-testy-nejsou-hotova-obrazovka]] — Testy a typy nechytí vady toku a pořadí — frontend se musí proklikat · active · 2026-08-01

## Bugs
- [[uroven1-merena-ze-spatneho-zakladu]] — Metrika „podíl kontaktů úrovně 1" počítala i jednatele bez adresy a agent dával jmenným adresám obchodníků jedničku — dvě různé chyby dávající totéž číslo · fixed · 2026-08-17
- [[pootocene-urovne-adres]] — Obrazovka i příkazová řádka hlásily úroveň 1 jako jmenovanou osobu, ačkoli TP-6 říká opak — a právě to číslo hlídá GDPR · fixed · 2026-08-06
- [[chybejici-index-na-contacts]] — Kartotéka se načítala 20+ s, protože contacts.ico neměl index — cizí klíč index nedělá · fixed · 2026-08-03
- [[sber-neukladal-velikost]] — Oprava velikosti byla jen zpětná — sběr ji dál nezapisoval, takže nová kampaň měla nula firem · fixed · 2026-08-03
- [[tazeni-bodu-prerusoval-react]] — Bod tvaru šel posunout jen o kousek — každý drag překreslil vrstvu a sebral úchyt zpod myši · fixed · 2026-08-03
- [[zapis-po-jedne-je-lokalne-neviditelny]] — Přepočet oblasti vkládal firmy po jedné — na PGlite rychle, přes síť minuty · fixed · 2026-08-01

## Research
- [[onboarding-dotaznik-pro-prodej]] — Při prodeji systému jinému podniku si musí agent nejdřív sám vyptat, čím zákazník podniká — jinak neví, co má psát do šablon · navrzeno · 2026-08-18
- [[podobnost-mailu-zmereno]] — Dva personalizované maily z jedné kostry se shodují na 80–88 %, různě stavěné varianty na 42–45 % — pravidlo o 70 % tedy u krátkých zpráv trestá stručnost · active · 2026-08-18
- [[otevrene-pozadavky-majitele]] — Co majitel vyžádal nebo co čeká na jeho rozhodnutí, k 3. 8. 2026 · active · 2026-08-03

