# Stav projektu

_Aktualizováno: 2026-07-31_

> **DALŠÍ KROK: průvodce kampaní v aplikaci.** Mapa i kreslení oblastí
> jsou hotové, větev `cmuchal-oblasti` sloučená, filtrovací díra zavřená.
> Technické zadání a pasti:
> **[docs/DALSI-SESSION-FRONTEND.md](../docs/DALSI-SESSION-FRONTEND.md)**

## Aplikace (`app/`) — kde je

Vite + React + TypeScript, vlastní `package.json`, spouští se
`npm --prefix app run dev` (port 5173). Kořenový `npm test` se jí netýká.

- **Hotové:** přihlášení (Supabase Auth), lišta s rolí a odhlášením,
  kartotéka firem s hledáním a souhrnem (jen ke čtení).
- **Ověřené:** nepřihlášený nevidí nic (0 řádků), role `uzivatel` vidí
  167 firem a 144 kontaktů. Postup ověření bez hesla je v `poznatky.md`.
  **Přihlášení heslem ověřil majitel 2026-07-29** — projde dovnitř, vidí
  kartotéku i štítek role.
- **Aplikace běží na `https://cantinero-find.vercel.app`** (nasazeno 2026-07-29
  z GitHubu, sestavuje se samo při commitu). Ověřeno: stránka se načte,
  přihlašovací obrazovka naběhne, z veřejné adresy bez přihlášení nevydá
  databáze žádná data. Vlastní adresa `find.cantinero.cz` zatím připojená není.
- **Repozitář je na GitHubu:** `Johnny09112/Obchodn--t-m` (soukromý, `origin`).
  Ověřeno, že neobsahuje tajemství ani data o firmách. Vercel na něj majitel
  napojil 2026-07-29; nastavení sestavení je ve `vercel.json` v kořeni.
  **Kořenový adresář ve Vercelu musí zůstat kořen repozitáře, ne `app/`** —
  aplikace si bere sdílený výpočet z `src/`, tedy o adresář výš.
  Ověřeno, že čerstvý klon se stejnými příkazy sestaví.
- Konektor Vercelu z Claude Code vidí jen projekt `mas-copilot`, na nový
  projekt nedosáhne — nasazení tedy nekontroluju já, ale majitel.
- **Mapa hotová:** zobrazení uložených oblastí, kruh s posuvníkem poloměru,
  obkreslení vlastního tvaru, tažení bodů, živý počet firem uvnitř a seznam
  s filtry (velikost, zaměření, spojení). Výpočet je sdílený s jádrem
  (`src/oblast-tvar.ts`) — ověřeno, že dává stejná čísla jako SQL i jako
  uložená `oblast_firmy` (41 firem ve 12 km, 144 ve 30 km).
- **Chybí:** průvodce kampaní v aplikaci (jádro je hotové, viz níž); mazání
  oblastí (záměrně — mazání dat rozhoduje majitel).

## Jádro kampaní je hotové (2026-07-30)

Kampaň je pojmenovaný seznam firem k oslovení — **není to rozesílka**,
nic se neodesílá (to zůstává zakázané až do fáze 3). Hotovo a otestované:

- Kampaň vzniká, dostane správce a volitelně území (oblast), ze kterého se
  dá jedním příkazem naplnit firmami.
- Prochází povolenými stavy (rozpracovaná → k posouzení → čeká na průzkum →
  schválená → …); **pořadí přechodů hlídá kód** (`src/kampan.ts`), databáze
  hlídá jen podmínky schválení, povinný důvod zrušení, číselník stavů a
  (od migrace 0020) zábranu proti stavům `bezi`/`uzavrena` — ty padnou
  ve fázi 3, dnes do nich nesmí nikdo přejít, ani přímým zápisem.
- **Schválit jde jen tehdy, když má kampaň aspoň jednu firmu s doloženým
  kontaktem a nečeká na dokončení objednaného průzkumu.** Tuhle pojistku
  hlídá databáze, ne jen tlačítko ve formuláři — obejít se nedá ani ručním
  zápisem.
- Umí souhrn (kolik firem, kolik s kontaktem) a upozorní na překryv s jinou
  kampaní (stejná firma ve dvou seznamech) — je to jen upozornění, nebrání,
  protože e-maily samy stejně ještě neodcházejí.
- Fronta objednávek na průzkum oblasti (`pruzkumy`) — aplikace agenta
  spustit neumí, takže si o průzkum jen požádá a agent (Čmuchal) si práci
  vyzvedne, až poběží.
- Ovládání zatím jen z příkazové řádky: `cli kampan` a `cli pruzkum`.
- Kdo co smí: nepřihlášený nevidí nic, tým kampaň připraví a upraví,
  schválit smí jen admin a výš — ověřeno.

## Čmuchal umí prozkoumat nakreslenou oblast (2026-07-30)

Dřív uměl sbírat firmy jen v kruhu kolem jídelny. Teď zvládne i území,
které si nakreslíš sám. Hotovo a otestované:

- **Z tvaru si sám zjistí, které obce zabírá.** Rozseje do něj mřížku bodů
  a u každého se zeptá mapy, jaká obec na něm leží. Ty pak přeloží na obce
  v registru — podle jména **a PSČ**, protože Hrádek je v ČR šestkrát.
- **Rozhlédnutí napřed.** Než začne sbírat, spočítá kolik obcí a firem
  ho čeká a odhadne čas. Nic při tom nezaměřuje, takže je to rychlé.
- **Velké území se dělí na úseky po obcích.** Když běh spadne nebo ho
  zastavíš, hotové obce zůstanou hotové a další běh naváže. Rozdělaná obec
  se udělá znovu, ale levněji — firmy, které už mají zaměřenou adresu, se
  nezaměřují podruhé. Přepínačem jde říct „dnes zpracuj nejvýš pět obcí".
- **Firma mimo nakreslený tvar se neuloží** a důvod se zapíše do deníku
  vyřazení. Firmy uvnitř se ukládají **bez jídelny** — o přiřazení
  rozhoduje vzdálenost, ne oblast, a je to samostatná funkce.
- **Když tvar nezabírá žádnou obec, průzkum se sám neuzavře — zeptá se.**
  Odloučená fabrika uprostřed pole je pořád firma.
- Ovládání z příkazové řádky: `cli pruzkum rozhlednuti | vyrid | useky`.

**Kvalifikace je sdílená.** Obě cesty sběru — kolem jídelny i nad oblastí —
posuzují kandidáty podle týchž pravidel (`src/kvalifikace.ts`): platnost IČO,
partnerské jídelny, bytové domy, blacklist, obor podle profilu, firmy bez
zaměstnanců. Kdyby to měla každá po svém, přidání pravidla do blacklistu by
změnilo jednu a druhou ne — mlčky. Týž soubor drží i síto pro kampaně
(`duvodNeoslovovat`, viz níž) — jiná otázka, stejná pravidla.

**Co tím zatím nejde:** hledat firmy podle souřadnic tam, kde žádná obec
není. Stav „čeká na rozhodnutí" existuje a příkaz ho ohlásí, ale samotné
hledání ze souřadnicových zdrojů je následná práce.

## Větev sloučená a filtrovací díra zavřená (2026-07-31)

**Větev `cmuchal-oblasti` je v `main`** (18 commitů + slučovací), odesláno
na GitHub, 354 testů zelených. Vzdálená větev `origin/cmuchal-oblasti`
zůstala ležet jako kopie navíc — smazat ji může majitel na GitHubu.

**Filtrovací díra je zavřená.** Do kampaně se z oblasti nedoplní firma,
která je na blacklistu, je naše partnerská jídelna, je bytový dům, nebo má
**doloženou vlastní jídelnu**. Vynechané firmy se vypíšou i s důvodem —
tiché filtrování by bylo horší než žádné.

Kde to sedí: na hranici „oblast → kampaň" (`naplnZOblasti` v `src/kampan.ts`),
pravidlo samo je sdílené v `src/kvalifikace.ts` (`duvodNeoslovovat`).
`oblast_firmy` zůstává čistě geometrická — odpovídá na otázku „co leží uvnitř
tvaru", ne „koho oslovíme". Proto to pokryje i oblast nakreslenou v aplikaci,
i když si aplikace seznam plní sama.

**Obor podle profilu se schválně neuplatňuje** — firma posbíraná za starého
profilu by po přepnutí profilu z kampaně tiše zmizela. Obor a velikost si
člověk vybírá při schvalování kampaně (rozhodnutí majitele 2026-07-31).

## Obě překážky průvodce opravené (2026-07-31)

**Firmy z oblasti mají skóre.** Vzdálenost k jídelně se nevymýšlí — vypadne
z výpočtu a zbytek se přepočte na touž stupnici (skóre = podíl získaných
bodů z dosažitelných). Firma se známou vzdáleností má dosažitelných 100,
takže se jí nic nemění; uložená skóre v databázi zůstávají platná.

Při tom se našla **horší vada, než jaká byla hlášená**: `vzdalenostM` bylo
typované jako `number`, ale `null` prošlo a `Math.min(null, 3000)` je 0 —
firma bez jídelny by dostala **plných 30 bodů za blízkost, kterou nikdo
neměřil**. Teď je typ `number | null` a null se počítá jako „nevíme".

**Postupová čísla průzkumu sedí.** Dvě příčiny:
- „nová" znamenalo „prošla tvarem", ne „nově založená" — firma známá
  z dřívějška se hlásila jako nová. `VysledekFirmy` má teď příznak `nova`.
- `firemPrevzato` se bralo jako celkový počet firem v oblasti, takže při
  navazujícím běhu obsahoval i to, co tentýž průzkum našel minule. Teď se
  odvozuje odečtením: `převzaté = v oblasti celkem − nové`.

Test to hlídá rovnicí `nové + převzaté = počet firem v oblasti`.

## Etapa B SLOUČENÁ do main (2026-07-31)

12 commitů, **387 testů zelených**, typy čisté, migrace 0023–0025 nasazené
v ostré databázi (`cli migrate`, ne přes konektor — projekt si vede vlastní
evidenci `_migrace`).
Plán: `docs/superpowers/plans/2026-07-31-pruvodce-kampani-etapa-b.md`.

**Ověřeno naostro majitelovým přihlášením jako `sasek@` (role uživatel):**
cizí kampaň neupraví (0 řádků) ani nearchivuje, kampaň, kde je zástup, ano.
Zámek i zástup fungují v produkci.

**Navíc oproti plánu: archivace a mazání kampaní** (migrace 0025) —
majitel si je vyžádal při zkoušení. Archivace skryje z přehledu a jde
vrátit; mazat smí jen admin, ostatní archivují. Po smazané kampani zůstane
záznam v `smazane_kampane`.

Hotovo:
- **Evidence lidí** (`uzivatele`, migrace 0023) plněná spouští z `auth.users`,
  jen ke čtení. Slouží k výběru zástupu. Role se do ní nekopíruje.
- **Zástup a zamčení kampaní** (migrace 0024). Dosud směl do každé kampaně
  kdokoli přihlášený; nově správce, zástup a admin. Zamčený je i seznam firem
  kampaně a objednávky průzkumu na ni navázané.
- **Doplňky designu:** stupnice odstupů a písma, krokovník, klidná a hotová
  podoba hlášky, jména pro 6 natvrdo psaných barev. Vzhled beze změny.
- **Mapa vyříznutá do `MapaOblasti.tsx`** — používá ji obrazovka Oblasti
  i průvodce. Umí ohlásit vybranou oblast ven a obnovit ji při návratu.
- **Seznam kampaní** a **kroky 1 a 2 průvodce** (založení se zástupem,
  území se dvěma počty firem: kolik leží uvnitř a kolik projde sítem).
- **Hledání obce v mapě** (Nominatim, dotaz až po 600 ms odmlky).

**Poučení z prvního proklikání:** kontrola typů a zelené testy neodhalily
nic z toho, co majitel našel za pět minut — nenasazené migrace, neuložené
území, chybějící cestu k úpravě kampaně, rozhodovací tlačítko pod tabulkou
41 firem. Frontendovou práci **nelze prohlásit za hotovou bez proklikání**;
detaily v `poznatky.md`.

## Etapa B+ hotová — čeká na zapnutí úloh (2026-07-31)

**402 testů zelených**, migrace 0026–0027 nasazené. `cli pruzkum obsluz`
si vezme objednávky z fronty sám; zámek (`zamky`) hlídá jeden běh naráz
a spadlý běh se po 15 minutách dá převzít.

Běží **u majitele na počítači** — Čmuchal potřebuje 521 MB registru ČSÚ,
který je jen na jeho disku, takže server by znamenal ten soubor někam
dostávat a udržovat. Cena: běží, jen když je počítač zapnutý.

**ZBÝVÁ MAJITELI:** založit naplánované úlohy podle
`skripty/NAPLANOVANI.md` (3× denně + hlídka urgentů po 10 min).
Do nastavení systému nesahám.

**Urgentní objednávky:** databázová i agentní část hotová
(`pruzkumy.urgentni`, `cli pruzkum obsluz --jen-urgentni`). **Tlačítko
v aplikaci zatím není** — patří ke kroku 3 průvodce, kde se průzkum
objednává, tedy do etapy C. Tlačítko agenta nespustí, jen objednávku
označí; víc z prohlížeče udělat nejde.

## DALŠÍ KROK: kroky 3 a 4 průvodce (etapa C)

Krok 3 — průzkum (včetně tlačítka „spěchá"), krok 4 — seznam firem
s důvody vyřazení a schválení. Návrh obrazovek je hotový a odsouhlasený:
`docs/superpowers/specs/2026-07-31-pruvodce-kampani-obrazovky-design.md`.
Chybí v něm doplnit dialog a proužek postupu, které etapa B odložila.

## Průvodce kampaní: etapa A — návrh (2026-07-31)

Návrh pěti obrazovek (seznam kampaní + čtyři kroky), textů a doplňků
designového systému: **`docs/superpowers/specs/2026-07-31-pruvodce-kampani-obrazovky-design.md`**,
vizuálně `docs/vizualizace/pruvodce-kampani-navrh.html`.
Postup celé práce: `docs/PRUVODCE-KAMPANI-POSTUP.md`.

**Nic se nestaví, dokud majitel návrh neschválí.**

Tři zjištění, která zadání z 29. 7. znát nemohlo:
- kap. 12 (Čmuchal neumí oblasti) neplatí, kap. 8 (žádné plánované
  spouštění agenta) majitel otočil,
- mezi územím a kampaní je síto, takže se počty firem liší — krok 2 musí
  ukázat obě čísla, jinak vypadá krok 4 jako chyba,
- **správce kampaně nejde vybrat ze seznamu uživatelů: žádná evidence
  uživatelů neexistuje.** Návrh je, že správcem je zakladatel kampaně;
  čeká na potvrzení majitele.

Audit designového systému: 10 barev, 3 role písma, stav kódovaný tvarem
i barvou, prázdný stav i zaostření klávesnicí — základ je v pořádku.
Chybí krokovník, dialog, klidná a úspěšná hláška, proužek postupu,
stupnice odstupů a jména pro 4 natvrdo psané barvy.

**Zůstává otevřené:** firma, která v kampani **už je** a teprve potom se
dostane na blacklist, v ní zůstane — filtr se uplatní při doplňování, ne
zpětně. Není to nebezpečné (kampaň prochází schválením člověkem a nic se
neodesílá), ale před fází 3 to chce buď zpětnou kontrolu, nebo upozornění
v seznamu kampaně.

**Vyřešeno (byl tu zastaralý zápis):** oblast založená v aplikaci má
`oblast_firmy` naplněnou. Majitel 2026-07-29 rozhodl, že aplikace do ní psát
smí (migrace 0017 — není to údaj o firmě, jen odvozenina z tvaru), a
`app/src/Oblasti.tsx` to dělá. Přepočet z příkazové řádky už není potřeba.

## Kde jsme

> **Data jsou nově ve sdílené databázi** (Supabase projekt `Customer_finder`,
> ref `sedjnwllzyeuiruxgoil`, eu-central-1). Připojení řídí `DATABASE_URL`
> v `.env` — **přes pooler, ne přímo** (viz poznatky, přímá adresa je jen
> IPv6). Lokální `data/pgdata-v5` zůstává jako záloha, ale už se nepoužívá;
> `CANTINERO_DATA_DIR` se uplatní jen bez `DATABASE_URL`.

Fáze 0 (přípravná) běží, ale **Čmuchal už sbírá naostro** — kalibrujeme ho
na reálných datech dřív, než se pustí zbytek fáze 0.

**Hotovo a ověřené ostrým během:**
- Čmuchal v2 — obrácené hledání „kde se pracuje", ne „kdo je kde zapsaný".
  Tři zdroje: otevřená data MPSV (pracoviště), OpenStreetMap (fyzická místa),
  sweep rejstříku podle obce (nejúplnější, ale nutný filtr na zaměstnance).
- Filtry: bez zaměstnanců, agentury práce, nevhodné obory (CZ-NACE 56 a 78),
  práh velikosti (výchozí 10 zaměstnanců — jen značí, nevyhazuje).
- Deník vyřazení (`vyrazeni`) — u každého kandidáta důvod i detail.
- Rešerše přes agenta na předplatném (`k-obohaceni` → `zapis-nalezy`),
  definice agenta v `.claude/agents/cmuchal.md`.
- Kartotéka členěná po oblastech + mapa na podkladu OpenStreetMap.
- **264 testů zelených, náklady 0 USD** (placené API nikdy neběželo).
- **Zabezpečení a uživatelé hotové.** RLS na všech tabulkách, pravidla podle
  rolí (migrace 0015–0016). Čtyři účty ověřené: `janlaub@icloud.com`
  super-admin · `laub@cantinero.cz` admin · `sasek@` a `prokop@` uživatel.
  Role se mění příkazem `cli uzivatel role` — v dashboardu to pole není.
- **Profily projektu** (migrace 0014): pravidla „koho hledáme" jsou data.
  `cantinero` (firmy 10+, restaurace ven) a `cantinero-business` (restaurace,
  jídelny a školy, velikost se neposuzuje). Přepíná se `cli profil zvol <kod>`.
- **Spolky jako kategorie** podle právní formy. „Ostatní" spadly z 24 na 9.
- **Krok 2 frontendového plánu hotový: kategorie a blacklist** (migrace 0012).
  Kategorie jsou data, ne kód — dají se upravit bez zásahu do programu.
  167 firem zařazeno; „Restaurace a pohostinství" je zatím prázdná, protože
  stravování vyřazujeme už při sběru. Blacklist má povinný důvod a uplatní
  se při sběru (`vyrazeni.duvod = 'blacklist'`).
- **Krok 1 frontendového plánu hotový: oblast je samostatná věc.**
  Smí existovat bez jídelny (obrácený postup) a může být kruh i nakreslený
  tvar. Migrace 0011, `src/oblast.ts`, CLI `oblast nova|prirad|firmy`.
  Ověřeno naostro: „Průzkum Rokycansko“, kruh 12 km, 41 firem, bez jídelny.
- **Kontakty: 18 z 20 firem nad 25 zaměstnanců je hotových** (známe jméno
  osoby i spojení na ni). Zbývají dvě — I.U.STAVBY nemá vůbec webovou stopu,
  H.B. TEXTILIE má jméno i e-mail, ale na různých záznamech (viz poznatky).
- **Firma smí být v dosahu víc jídelen** (tabulka `dosah`, migrace 0010).
  Dnes 0 sdílených, ale Zbůch a Tlučná se zónami už překrývají.
- `cli zona` ukáže, kolik firem přibude při jakém poloměru. **Vidí ale jen
  do území jídelny** — na rozšíření zóny za hranice obce nestačí.
- **5 jídelen**, z toho 4 se známou kapacitou (70 obědů/den celkem).
  Pátá je 34. ZŠ Plzeň, Gerská — kapacita zatím neznámá.
- `.env` se načítá sám, `NOMINATIM_CONTACT` se už nemusí psát k příkazům.
- **Konkrétní osoba u firmy** — hlavní úkol Čmuchala. Kód sám zapisuje
  kontakt z otevřených dat MPSV (jméno, pozice, e-mail, telefon) a jednatele
  z veřejného rejstříku tam, kde jinak kontakt není. Měřeno: jméno by
  přibylo u 8 z 10 firem, které dosud neměly žádné. Detaily v `poznatky.md`.
- **Zdrojem seznamu firem je kompletní registr ČSÚ** (`src/registr.ts`,
  otevřená data, 541 MB v `data/cache/`). Limit 1 000 výsledků tím přestal
  platit — funguje stejně na vesnici i v Praze. Adresovatelný trh celé ČR:
  **35 138 firem nad 25 zaměstnanců** (Praha 9 337, Brno 2 091, Plzeň 719).
  Detaily a pasti v `poznatky.md`.
- Bytové domy (SVJ, bytová družstva) se nezařazují; živnostníci mají vlastní
  část kartotéky. Rozlišuje právní forma z rejstříku (`companies.pravni_forma`,
  migrace 0008), ne název. Data: 208 → **110 firem + 57 živnostníků**,
  41 bytových domů vyřazeno.
- Sweep rejstříku se u ARES rovnou zužuje na formy zaměstnavatelů →
  **Stříbro odblokované** (1 580 subjektů spadlo → 285 projde). Ověřeno
  naostro. Plzeň sweepem pokrytá nebude, a to záměrně (viz rozhodnutí).
- Partnerská jídelna se nemůže stát kandidátem (migrace 0007, `jidelny.ico`,
  důvod vyřazení `partnerska_jidelna`). IČO všech 4 jídelen doplněno z ARES.
- Fronta na rešerši jde zúžit podle velikosti: `k-obohaceni --segmenty …`.
- **První ostrá dávka rešerše — konec procesu ověřen.** 20 firem nad
  25 zaměstnanců napříč všemi 4 oblastmi: **17 z 20 má doložený kontakt**,
  z toho 10 na jmenovanou osobu a 4 přímo adresu pro obchodní nabídky.
  26 kontaktů, 5 nálezů, 0 odmítnutých zápisů, 0 USD. Shrnutí pro majitele:
  `docs/vizualizace/reserse-2026-07-27.html`, poznatky v `playbook-cmuchal.md`
  (běh `c12acbba-7f70-4972-ad30-24cc413e5972`).

**Data (v `data/pgdata-v5`):** 208 firem ve 4 oblastech, integrita ověřená.
Kapacita známá jen u Bezdružic (10 obědů/den). Všech 20 firem nad
25 zaměstnanců je prověřeno rešerší.

## Poučení z první dávky rešerše

- **Způsob stravování se z webu dohledat nedá** — 0 z 20 firem ho uvádí.
  Na personalizaci podle tohoto údaje se nedá stavět.
- **Vlastní jídelna se doložit dá** a je to stejně cenný nález jako kontakt:
  vyřadila Centrum pobytových služeb Zbůch a ZŠ Vejprnice z cílení.
- **U 3 firem je kontakt jen z katalogu třetí strany** (Živé firmy, Firmy.cz,
  RegionPlzeň), ne z webu firmy → údaj může být zastaralý, značit zvlášť.
- **SIGNUM není agentura práce**, ale žárová zinkovna (500–999 zam.) —
  podezření z dřívějška bylo záměnou s agenturami, které pro ni najímaly.

## Další krok (v tomto pořadí)

1. **Ostrý běh na Plzni** — jídelna je založená, čeká 719 firem nad 25 zam.
   v 10 obvodech. První zkouška velkého města; pozor na počet dotazů na
   geokódování (1 req/s → 719 firem je přes 12 minut jen na zaměřování).
2. **Stříbro** — technicky odblokované (285 subjektů projde), ale partnerská
   jídelna tam není. Majitel ho chce pustit; buď najít partnera, nebo obrátit
   postup a nechat systém napřed ukázat, kde jsou zaměstnanci.
3. **Projít vzorek subjektů „velikost neuvedena"** — celostátně jich je
   480 498, takže číslo 35 138 cílů je spodní odhad. Můžou se tam schovávat
   skuteční zaměstnavatelé.
4. Zbytek fáze 0 (tvrzení, šablony, doména, právník — viz `docs/FAZE-0.md`).

**Otevřené k dořešení:** licence otevřených dat ČSÚ není na stránkách
produktu výslovně uvedená (kontakt: michal.cigas@csu.gov.cz). Před ostrým
komerčním provozem to chce potvrdit — právní věc, rozhoduje majitel.

**Otevřené k dořešení:** skóre se po rešerši nepřepočítává — firma s doloženou
vlastní jídelnou si drží původní skóre z doby sběru. Před frontou na oslovení
(fáze 3) to bude potřeba srovnat.

## Co čeká na majitele

- **Dobrousit kategorie.** Do „ostatních" spadlo 24 firem, z toho spolky
  a sport (CZ-NACE 93, 94, 90 — 10 firem), opravny (95 — 2), zemědělství
  a rybolov (01, 03 — 2). Chce majitel pro ně vlastní kategorie, nebo je
  přiřadit do stávajících?

- **Návrh Čmuchala ke schválení:** u mikrofirem bez webu zkusit veřejné
  registry zadávacích řízení (profily zadavatelů, ISVZ/NEN) — pokud firma
  byla subdodavatelem na veřejné zakázce, bývá tam kontakt na statutárního
  zástupce. Agent to podle pravidel nezkusil a čeká na schválení.
- **Má se hledat spojení i u 81 mikrofirem?** Podle dřívějšího rozhodnutí
  se na ně cílí jinou formou než e-mailem, takže by ten čas šel spíš do Plzně.
- **Je firma „hotová", když je jméno na jednom záznamu a e-mail na druhém?**
  Přísně 18 z 20, na úrovni firmy 19 z 20 (viz poznatky).

- **Rozhodnutí o SVJ a OSVČ** — kartotéku zaplavují společenství vlastníků
  bytů (v Hrádku přes 15) a živnostníci vedení vlastním jménem. Formálně mají
  zaměstnance, ale obědy tam nikdo neodebírá. Vyřazení celé kategorie je
  změna pravidel → rozhoduje majitel. Detail v `memory/poznatky.md`.
- Skutečné kapacity Zbůchu, Tlučné a Hrádku (potřeba až před fází 3).
- Projít vyřazené kandidáty a říct, co tam nepatří → brousíme pravidla.
- Rozhodnutí o sdílené databázi, až bude systém používat i kolega.

## Kde co hledat

| Co | Kde |
|---|---|
| Závazné zadání | `SPEC.md` |
| Orchestrace fáze 0 | `docs/FAZE-0.md` |
| Lidský popis systému | `docs/JAK-TO-FUNGUJE.md` |
| Rozhodnutí (co, kdo, proč) | `memory/rozhodnuti.md` |
| Technické poznatky a pasti | `memory/poznatky.md` |
| Postřehy z rešerší | `playbook-cmuchal.md` |
| Vizuální výstupy | `docs/vizualizace/` (mapa a kartotéka se generují) |
| Výsledek první rešerše | `docs/vizualizace/reserse-2026-07-27.html` |
| Sloučení + filtr kampaní | `docs/vizualizace/kampan-filtr-2026-07-31.html` |

## Příkazy

```bash
npm test
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- stav
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- kartoteka
CANTINERO_DATA_DIR=data/pgdata-v5 npm run cli -- k-obohaceni --segmenty stredni,korporat
CANTINERO_DATA_DIR=data/pgdata-v5 NOMINATIM_CONTACT=… npm run cli -- run --jidelna <id>
```

**Pozor:** aktivní data jsou v `data/pgdata-v5`, ne ve výchozím `data/pgdata`
(starší běhy). Databázi smí otevřít jen jeden proces naráz — hlídá to zámek.
