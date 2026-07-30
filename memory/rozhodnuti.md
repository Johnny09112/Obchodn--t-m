# Log rozhodnutí

Formát: datum · kdo · rozhodnutí · proč. Nové řádky nahoru.

- 2026-07-30 · majitel (recenze) + Claude · **O schválení kampaně rozhoduje
  jen nejnovější objednávka průzkumu** (`pozadano_at desc`, migrace 0021),
  ne existence jakékoli nehotové. Oprava pasti z migrace 0020: podmínka
  „existuje nehotový průzkum" blokovala schválení navždy, jakmile jednou
  selhal — i po úspěšném opakování. Kampaň musí jít po neúspěchu zopakovat,
  jinak se zablokuje natrvalo a ven vede jen ruční zásah do databáze.
- 2026-07-30 · Claude · **Zábrana proti stavům `bezi`/`uzavrena` je teď i
  v databázi** (trigger `kampan_faze3_zabrana`, migrace 0020), nejen v kódu
  `src/kampan.ts`. Důvod: webová aplikace (`app/src/data.ts`) zapisuje do
  `kampane` přímo, takže kód jádra pro ni neplatí — tvrdá pravidla se podle
  projektových pravidel vynucují v databázi. **Ve fázi 3, až se odesílání
  povolí, se tahle zábrana odstraní** — je to hranice fáze, ne trvalé pravidlo.
- 2026-07-30 · Claude · **`pruzkum objednej` má povinný `--pozadal <e-mail>`.**
  Fronta objednávek potřebuje vědět, kdo o průzkum požádal (sloupec
  `pruzkumy.pozadal not null`); hádat identitu z prostředí (např. z `.env`)
  by bylo tiché domýšlení, ne doložený údaj.

- 2026-07-29 · majitel · **Uživatelé aplikace a jejich role:**
  `janlaub@icloud.com` super-admin (i správa uživatelů) ·
  `laub@cantinero.cz` admin (vše kromě správy uživatelů) ·
  `sasek@cantinero.cz` a `prokop@cantinero.cz` uživatel (prohlížet, kreslit
  oblasti, chystat kampaně). Vlastní rozhraní pro zakládání uživatelů se
  nestaví — Supabase to umí sám a pro čtyři lidi by to byla zbytečná práce.
  **Role se čte z `app_metadata`, ne z `user_metadata`** — to druhé si smí
  uživatel přepsat sám a povýšil by se na admina.

- 2026-07-28 · majitel · **Sdílená databáze je Supabase projekt
  `Customer_finder`** (ref `sedjnwllzyeuiruxgoil`, eu-central-1 Frankfurt,
  0 Kč/měsíc). Ne „Cantinero" — ten název je použitý jinde a systém stejně
  obsluhuje víc projektů. Projekt Letitgoo (`exjrieuhvmzdkregajyh`)
  pozastaven, aby se vešel do limitu dvou aktivních; jde vrátit zpět.

- 2026-07-28 · majitel · **Systém je jeden, projektů bude víc.** Registr
  subjektů je společný a nic se z něj nezahazuje; **drahá práce (ověření,
  zaměření, rešerše) se dělá až po profilu projektu.** Pravidla „koho
  hledáme" proto přestala být v kódu a stala se daty (migrace 0014,
  `src/profil.ts`). Ověřeno na Plzni: `cantinero` propustí 1 449 firem,
  `cantinero-business` 1 662 restaurací a škol — stejný stroj, opačné zadání.
  Další projekty majitele: BeHere, Easist, MAS Copilot; z nich čtyři ze šesti
  hledají subjekty v ČR úplně stejně, jen jiné.
- 2026-07-28 · majitel · **Spolky jako vlastní kategorie.** Poznají se podle
  PRÁVNÍ FORMY, ne podle oboru — TJ Baník má „sportovní činnosti" stejně jako
  komerční fitness. Zemědělství k výrobě, opravny a kultura ke službám.

- 2026-07-28 · majitel · **Hosting: Vercel** (majitel ho má placený a má
  do něj přístup), ne Cloudflare Pages. ⚠ **Ale DNS zůstává problém:**
  `cantinero.cz` je vedená na Cloudflare a majitel do toho účtu přístup
  nejspíš nemá. Bez něj se `find.cantinero.cz` nerozběhne, ať je hosting
  kdekoli. Nutno vyřešit před krokem 4 — kdo ke Cloudflare přístup má.

- 2026-07-28 · majitel · **Aplikace má být použitelná i pro jiná odvětví**,
  ne jen pro jídelny. Nasazení pro jiný obor až later a úplně separátně.
  Důsledek už teď: **kategorie firem jsou data, ne kód** — tabulka, která
  jde upravit, ne pevně zadrátovaný seznam. Zbytek zobecňovat zatím ne.
- 2026-07-28 · majitel · **Adresa aplikace: `find.cantinero.cz`.**
  POZOR: doména je registrovaná u Forpsi, ale **DNS je delegované na
  Cloudflare** (`walt/dee.ns.cloudflare.com`) — záznamy se mění tam, ne
  ve Forpsi. `find.cantinero.cz` se dnes už překládá (nejspíš zástupný
  záznam `*`), takže ho bude potřeba přebít konkrétním záznamem.
- 2026-07-28 · majitel · **Sdílená databáze: pozastavit jeden Supabase
  projekt a založit třetí.** Pozor: v účtu jsou jen `mas-copilot`
  a `Johnny09112's Project` — **žádný „Letitgoo"**. Než se něco pozastaví,
  musí být jasné, co na tom běží. Plán je `free`, tedy limit 2 aktivní
  projekty; cena třetího je 0 Kč, ale limit je jiná věc než cena.

- 2026-07-28 · majitel · **Frontend přestává být jen na sledování a stává se
  ovládáním.** Mění tím rozhodnutí z 2026-07-26 („frontend slouží ke sledování
  a schvalování, ne jako hlavní ovládání"). Důvod: kreslení oblastí a výběr
  firem do kampaně se konverzačně dělat nedá. **Uživatelé: majitel i kolega**
  → sdílená databáze a přihlašování od začátku. Návrh v `docs/adr/0001-frontend.md`.
- 2026-07-28 · Claude (poznámka o sobě) · Majitel se zeptal, proč se frontendu
  bráním. Část důvodů byla věcná (mění zapsané rozhodnutí, stojí peníze), ale
  část ne: **vybíral jsem práci podle toho, co si umím sám ověřit** — CLI
  a testy ano, prohlížeč ne. Zapsáno i do osobního vaultu majitele.

- 2026-07-28 · majitel · **Firma je z hlediska kontaktu HOTOVÁ, když známe
  jméno konkrétní osoby A zároveň e-mail nebo telefon na ni.** Obecná adresa
  `info@` nestačí — personalizace je to, čím se chceme lišit. To je zároveň
  měřítko úspěšnosti rešerše.
- 2026-07-28 · majitel · **Firma smí být v dosahu VÍC jídelen zároveň.**
  Nepřeřazovat ji mezi nimi — zaznamenat, že ji mají v dosahu obě, a do
  statistiky každé jídelny ji započítat. Jde o obchodní potenciál oblasti,
  ne o vlastnictví firmy. → vztah mnoho k mnoha (tabulka `dosah`).
- 2026-07-28 · majitel · **Zóna se nastavuje ke každé oblasti zvlášť a vždy
  po doptání** — u odloučených vesnic může být větší, při překryvu jídelen
  menší. Před rozhodnutím ukázat, kolik firem přibude při 2/3/5/10 km.

- 2026-07-28 · majitel · **Postup pro novou oblast musí být zapsaný tak, aby
  stačilo říct název oblasti a práce začala.** → `docs/NOVA-OBLAST.md`,
  odkaz z `CLAUDE.md`. Dosud postup nikde souvisle nebyl a skládal se
  pokaždé znovu z hlavy.

- 2026-07-28 · majitel · **Pátá jídelna: 34. ZŠ Plzeň, Gerská 32** (IČO
  66362504, 49.7774414/13.3710132, obvod Plzeň 1 – Bolevec). Kapacita
  zatím neznámá. Kapacity ostatních: Bezdružice 10, Zbůch 20, Tlučná 20,
  **Hrádek 20** → známé celkem 70 obědů/den.
- 2026-07-28 · majitel · **Ke každému většímu výstupu chci HTML** — kartotéku
  i mapu, ne jen text v chatu. (Pravidlo v CLAUDE.md platilo, přestal jsem
  ho dodržovat a majitel to musel připomenout.) Mapa se posílá jako soubor,
  ne jako publikovaná stránka — ta má zakázané stahování dlaždic.
- 2026-07-28 · Claude · **`.env` se načítá automaticky** (`src/env.ts`).
  Dřív se `NOMINATIM_CONTACT` musel psát ke každému příkazu, což je zbytečné
  tření. Hodnoty z prostředí mají přednost před souborem.

- 2026-07-28 · majitel · **Klíčový úkol Čmuchala: dohledat konkrétní osobu**
  (jméno, pozice, telefon, e-mail — stačí jedno z nich). Jak se k tomu
  dostane, je na jeho vynalézavosti, ale **každý nový způsob musí předem
  odsouhlasit majitel.**
- 2026-07-28 · majitel · **Hranice: nesmíme oslovit vůbec nikoho, ani kvůli
  zjištění kontaktu.** Žádný telefon na centrálu, žádný dotaz na info@.
  Kontakty se smí jen dohledávat ve veřejně dostupných zdrojích. Sedí to
  na TP-8 (systém neodesílá nic).
- 2026-07-28 · majitel · **Odhadované e-maily se neukládají vůbec.**
  Odvozená adresa (`jmeno.prijmeni@firma.cz`) se v kartotéce tváří jako
  fakt a porušuje pravidlo doloženého zdroje (TP-2). Radši žádná adresa.
- 2026-07-28 · majitel · **Schválené zdroje kontaktů (všechny čtyři):**
  (1) kontaktní osoba z otevřených dat MPSV, (2) statutární orgán
  z obchodního rejstříku — **jen jméno a funkce, nikdy datum narození
  ani bydliště**, (3) registr smluv (nejdřív ověřit přínos), (4) hlubší
  průzkum webu včetně PDF a archivu, (5) učící se playbook.
  **LinkedIn zůstává zakázaný** — mění ho jen SPEC, ne tohle rozhodnutí.

- 2026-07-27 · majitel · **Cílem je postupně projít celou ČR**, ne jen okolní
  obce. Velká města (Praha, Brno, Ostrava, K. Vary) musí fungovat stejně jako
  vesnice. → vynutilo si přechod na kompletní registr ČSÚ (viz níž).
- 2026-07-27 · Claude · **Zdrojem seznamu firem je kompletní registr ČSÚ**
  (otevřená data `res_data.csv`), ne dotazy do vyhledávacího API ARES.
  Důvod: API vydá nejvýš 1 000 výsledků na dotaz, registr obsahuje všechny
  subjekty najednou a navíc nese velikost firmy, takže se malé firmy
  odfiltrují dřív, než se na ně sáhne. **TP-1 se nemění** — registr dává jen
  seznam kandidátů, firma pořád vzniká až po ověření IČO v ARES.
  Sweep ARES zůstal jako záloha. Otevřené: licence dat (viz `stav.md`).
- 2026-07-27 · majitel · **Kapacity: Zbůch 20, Tlučná 20 obědů/den.**
  Bezdružice 10 (beze změny), Hrádek zatím neznámý.

- 2026-07-27 · Claude · **Sweep rejstříku je nástroj pro obce, ne pro města.**
  Dotaz se zužuje na právní formy zaměstnavatelů (`FORMY_ZAMESTNAVATELU`),
  což vyřeší vše do velikosti Stříbra (1 580 → 285). Velká města se sweepem
  pokrývat nebudeme ani po dalším zúžení: zóna jídelny má 3 km, ne celé
  město, a sídlo v Plzni neříká, kde se pracuje. Pro města platí MPSV
  a OpenStreetMap. Neprojde-li sweep, zapíše se to viditelně do souhrnu.

- 2026-07-27 · majitel · **Bytová družstva (SVJ) se vyřazují, OSVČ ne.**
  Společenství vlastníků je dům, ne zaměstnavatel — pryč (s důvodem v deníku
  vyřazení). Živnostníci se ale **zachovají v samostatné kartotéce**: budou se
  oslovovat jinou formou než firmy. Stejná logika jako u mikropodniků
  (rozhodnutí z 2026-07-27): neukládat ≠ nezahazovat.

- 2026-07-27 · majitel · **Priorita: hloubka před šířkou.** Místo odblokování
  Plzně a Stříbra jdeme nejdřív dohledat kontakty u nejlepších ~20 firem.
  Důvod: dosud není ověřené, že konec procesu (rešerše) vůbec dá použitelné
  kontakty — zjistit to na 20 firmách je levnější než na 500. Limit 1 000
  výsledků ARES zůstává jako další krok.
- 2026-07-27 · Claude · **Partnerská jídelna se vyřazuje podle IČO, ne názvu**
  (migrace 0007, `jidelny.ico`, důvod vyřazení `partnerska_jidelna`). Názvy
  v rejstříku se liší od těch na vývěsce, porovnávat je by bylo nespolehlivé.
  Vyřazuje se proti IČO všech jídelen, ne jen právě zpracovávané.
- 2026-07-27 · Claude · **Fronta na rešerši se dá zúžit na velikost firmy**
  (`k-obohaceni --segmenty stredni,korporat`). Rešerše stojí čas agenta;
  u firmy s pěti lidmi se nevyplatí stejně jako u firmy s pěti sty. Firmy
  s neznámou velikostí zúžením propadnou — nevíme o nich dost.

- 2026-07-26 · majitel · **Prvních 5 jídelen** (Bezdružice, 34. ZŠ Plzeň,
  Zbůch, Tlučná, Hrádek u Rokycan). **Začínáme Bezdružicemi**, zbytek až po
  testu. Jídelna Bezdružice založena v DB (kodObce 560740, 49.90624/12.97442),
  kapacita zatím 0 — čeká na číslo od majitele.
- 2026-07-26 · majitel · **E-mail se bude posílat z Outlooku** (Microsoft 365).
  Ověřit způsob autentizace — Microsoft ruší Basic auth pro SMTP, půjde
  nejspíš přes Graph API. Detail do S0.7.
- 2026-07-27 · Claude · **Mapa vyřešena jako generovaný statický soubor**
  (`npm run cli -- mapa` → `docs/vizualizace/mapa.html`, Leaflet + dlaždice
  OpenStreetMap). Funguje pro oba scénáře spolupráce: při sdílené DB si každý
  vygeneruje mapu ze stejných dat, soubor jde i poslat. Přepnutí lokální ↔
  sdílená DB je jen `DATABASE_URL` — kód se nemění.
- 2026-07-27 · majitel · **Model spolupráce s kolegou:** sdílená databáze
  (Supabase), ale **každý používá své vlastní předplatné Claude** a spouští
  agenta u sebe. Nevyžaduje API tokeny ani server. Otevřeno, jestli to bude
  potřeba vůbec (možná zůstane jednouživatelské).
- 2026-07-26 · majitel · **Mapa má být na reálném mapovém podkladu**, aby byly
  vidět i malé obce. Pozor: publikované artifacty mají zakázané externí
  požadavky → dlaždice fungují jen v lokální verzi stránky.
- 2026-07-26 · majitel · **Frontend bude potřeba dřív — systém mají používat
  i kolegové.** ⚠ Mění architekturu: víc uživatelů = sdílená databáze
  (lokální nestačí) a agent běžící mimo majitelův Claude Code. Nutno
  rozhodnout rozsah (jen sledování vs. plné ovládání) — otevřeno v S0.2.
- 2026-07-26 · majitel · **Ke každému většímu výstupu vždy HTML vizualizace**
  (do `docs/vizualizace/`, publikovat jako artifact). Majitel si stav
  prohlíží vizuálně, ne v textu. → zapsáno do CLAUDE.md.
- 2026-07-26 · majitel · **Interaktivní mapa ČR** jako průběžný cíl: postupně
  se plní analyzovanými oblastmi (zóny jídelen, vyhodnocené firmy).
- 2026-07-26 · majitel · **Spouštění: nejdřív konverzačně, později
  s možností plánování.** Frontend (mapa, přehledy) slouží ke sledování
  a schvalování, ne jako hlavní ovládání.
- 2026-07-26 · majitel · **Provoz na předplatném, ne na API tokenech.** Majitel
  má Claude Max 5×; API se bude řešit až u případného externího klienta.
  Důsledek: Cantinero není samostatná bezobslužná aplikace — je to sada
  nástrojů (kód) + agent v Claude Code, který je používá. Enrichment tedy
  neběží přes Anthropic SDK, ale jako práce agenta v session.
- 2026-07-26 · majitel · **Cílový objem: 20–50 firem denně**, víc nemá smysl.
  Sedí na dávkový režim na předplatném; nevyžaduje 24/7 infrastrukturu.
- 2026-07-26 · Claude · **Databáze lokálně (PGlite v `data/pgdata`)**, žádný
  cloud. Stávající Supabase projekty majitele zůstávají nedotčené a nic se
  nepozastavuje. Migrace jsou idempotentní (tabulka `_migrace`), `data/` je
  v .gitignore. Přechod na cloudový Postgres = vyplnit DATABASE_URL.
- 2026-07-26 · majitel · **Před investicí do produktizace je potřeba analýza,
  zda má smysl systém prodávat dalším firmám.** → nová session S0.10.
- 2026-07-26 · majitel · **Před ostrým provozem proběhne fáze 0 (přípravná)** —
  workspace, agenti, skilly, paměť, obchodní příprava; teprve pak další postup.
  Technologie se může ještě změnit. → orchestrace v docs/FAZE-0.md.
- 2026-07-24 · Claude · **Local-first vývoj**: testy nad PGlite bez sítě,
  produkční DB se zakládá až po potvrzení majitelem (oba stávající Supabase
  projekty jsou obsazené jinými aplikacemi).
- 2026-07-24 · Claude · **Čeština všude** (kód-komentáře, dokumenty, commity;
  identifikátory bez diakritiky) — konzistence se SPEC.
- 2026-07-24 · Claude (navrženo, nepotvrzeno) · Doporučení technologie =
  hybrid: kódové jádro (tvrdá pravidla) + Claude Code agenti. **Čeká na S0.2.**
- 2026-07-27 · majitel · **Mikropodniky se NEZAHAZUJÍ, ale ukládají.** Bude se
  na ně cílit jinou formou reklamy než e-mailem. Práh `--min-zamestnancu`
  proto řídí jen zařazení do fronty na oslovení, ne uložení.
- 2026-07-27 · majitel · **U každého vyřazeného kandidáta se zapisuje důvod**
  (tabulka `vyrazeni`, migrace 0005). Majitel bude v prvních fázích seznamy
  procházet; postupným broušením pravidel se má systém dostat do autonomního
  režimu. Bez deníku vyřazení to nejde.
- 2026-07-27 · majitel · **Kartotéka se člení podle oblastí** (obcí jídelen),
  ne jako jeden plochý seznam.
- 2026-07-29 · Claude · **Aplikace stojí v `app/` jako samostatný projekt**
  (Vite + React + TypeScript, vlastní `package.json`). Proč: kořenový
  `npm test` běží nad PGlite offline a nesmí se o frontend zakopnout;
  Vercel dostane `app` jako kořen. Vratné technické rozhodnutí.
- 2026-07-29 · Claude · **Publishable klíč je v kódu aplikace**
  (`app/src/supabase.ts`, přebitelný přes `VITE_*`). Proč: klíč je veřejný
  ze své podstaty — hranici drží RLS, ne utajení klíče. Ušetří to nastavování
  při nasazení. `service_role` se do aplikace nedostane nikdy.
- 2026-07-29 · Claude · **Samoobslužná registrace v aplikaci není.** Účty
  i hesla zakládá správce. Proč: kdokoli s adresou by si jinak založil účet
  a role `host` sice nic nevidí, ale nemá smysl tu možnost vůbec nabízet.
- 2026-07-29 · Claude · **Výpočet tvaru oblasti se sdílí mezi jádrem
  a aplikací** (`src/oblast-tvar.ts`, importuje ho i `app/`). Proč: mapa musí
  ukazovat totéž číslo, jaké se pak uloží — dvě kopie ray castingu by se
  rozešly. Soubor proto nesmí sáhnout na nic, co běží jen v Node.
  Ověřeno: aplikace i nezávislý výpočet v SQL dají u „Průzkum Rokycansko"
  shodně 41 firem (12 km) a 144 (30 km).
- 2026-07-29 · Claude · **Aplikace nezapisuje `oblast_firmy`** — příslušnost
  firem k oblasti si počítá při každém zobrazení sama. Proč: tabulka je podle
  pravidel jen ke čtení (zapisuje agent) a odvodit se dá kdykoli. Důsledek
  k dořešení: oblast založená v aplikaci má tuhle tabulku prázdnou, dokud
  ji nepřepočítá příkazová řádka. **Čeká na majitele** (viz stav.md).
- 2026-07-29 · majitel + Claude · **Mapa jde přes celou šířku okna, ovládání
  kresleného tvaru je plovoucí panel nad mapou.** Majitel chtěl mapu na celou
  šířku a ovládání pod ni; panel pod mapou jsem rozmluvil a majitel na to
  přistoupil: při tažení posuvníku poloměru by nebylo vidět, jak se kruh mění,
  a to je celý smysl kreslení. Seznam uložených oblastí se přesunul nad mapu
  jako řádek štítků (při kreslení ho není potřeba vidět), seznam firem zůstal
  pod mapou — tam se vejdou i kampaně. Na úzké obrazovce panel spadne pod mapu.
- 2026-07-29 · majitel · **Uložené oblasti jsou volitelné vrstvy mapy, ne pruh
  štítků.** Důvod majitele: oblastí budou po ČR stovky a budou se překrývat,
  takže je potřeba je zapínat a vypínat a hlavně vidět, kde se překrývají.
  Kliknutí na oblast má do budoucna ukázat podrobnost kampaně včetně toho,
  kdy tam naposledy odešel e-mail (až budou kampaně existovat).
- 2026-07-29 · Claude · **Překryv oblastí se hlásí jako chyba, ne jako
  zajímavost.** Majitel popsal scénář, kdy jedna firma dostane dva e-maily
  ze dvou kampaní (obecná „západní Čechy" + konkrétní „Vary"). To ale
  **nedovoluje TP-5** — jedna firma, jedno iniciační oslovení. Aplikace proto
  firmy ve víc oblastech vyznačuje kroužkem a panel vrstev je počítá.
  Vyloučení oblasti z kampaně tedy není volba, ale jediný povolený tvar.
  **Změnit to může jedině změna SPEC — rozhoduje majitel.**
- 2026-07-29 · majitel · **Aplikace smí zapisovat `oblast_firmy`** (migrace
  0017). Zdůvodnění: není to údaj o firmě, ale odvozenina z tvaru oblasti,
  kterou lze kdykoli přepočítat týmž výpočtem — TP-2 se jí netýká. Kartotéka
  (`companies`, `contacts`, `evidence`) zůstává pro lidi dál jen ke čtení,
  ověřeno zkouškou: ani super-admin do ní nezapíše.
- 2026-07-29 · majitel · **Kampaň = pojmenovaný seznam firem, ne rozesílka.**
  Potvrzeno poté, co jsem upozornil, že SPEC kap. 10.2 kampaňový režim
  zrušil („individuální oslovení, ne kampaň"). Majitelův příklad se dvěma
  kampaněmi na jednu firmu tím zůstává, jen z toho neplynou dva e-maily.
- 2026-07-29 · Claude + majitel · **Krok 4 průvodce rozdělen** na posouzení
  seznamu (staví se teď) a oslovení (fáze 3). Majitel chtěl v kroku 4 reálné
  rozhraní pro e-mail; to TP-8 kódu fáze 0–2 zakazuje.
- 2026-07-29 · majitel · **Překryv kampaní jen upozorní, nebrání.** Tvrdá
  pojistka TP-5 sedí až u odesílání, podle `companies.osloveno_at`.
- 2026-07-29 · majitel · **Pořadí prací: kampaně → Spojka / Plzeň →
  naplánované běhy agenta → fáze 3.** Automatizace až bude co automatizovat;
  frontu práce vytvoří teprve kampaně.
- 2026-07-29 · majitel · **Kampaň smí schválit jen `admin` a `super-admin`;
  připravit ji smí i `uzivatel`.** Schválení je brána, za kterou ve fázi 3
  začne odcházet komunikace ven. Vynucují pravidla v databázi.
- 2026-07-29 · majitel · **Čmuchal zatím nenavrhuje tvar oblasti — odloženo
  do fáze 4.** Tam se poprvé měří, co funguje, takže se teprve pak pozná,
  jestli je návrh tvaru k něčemu, nebo ho člověk stejně překreslí.
  V první verzi kreslí tvar člověk.
